#!/bin/bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}"
echo "=============================================="
echo "  RudraX CyberSec Platform v2.0 Installer"
echo "  A Lalit Pandit Product"
echo "=============================================="
echo -e "${NC}"

DOMAIN="${RUDRAX_DOMAIN:-cybersec.rudrax.cloud}"
EMAIL="${RUDRAX_EMAIL:-lalittheonly@gmail.com}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-docker}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash deploy/install.sh)${NC}"
    exit 1
fi

echo -e "  Domain:  ${CYAN}$DOMAIN${NC}"
echo -e "  Mode:    ${CYAN}$MODE${NC}"
echo -e "  Project: ${CYAN}$PROJECT_DIR${NC}"
echo ""

if [ "$MODE" = "docker" ]; then
    echo -e "${CYAN}[1/6] Installing Docker & dependencies...${NC}"
    apt-get update -qq
    apt-get install -y -qq docker.io docker-compose nginx certbot python3-certbot-nginx curl > /dev/null 2>&1
    systemctl enable docker && systemctl start docker
    echo -e "${GREEN}  Docker ready${NC}"

    echo -e "${CYAN}[2/6] Building and starting containers...${NC}"
    cd "$PROJECT_DIR"
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose build
    docker-compose up -d
    echo -e "${GREEN}  Containers started${NC}"

    echo -e "${CYAN}[3/6] Pulling default Ollama model...${NC}"
    sleep 5
    docker exec rudrax-ollama ollama pull llama3 2>/dev/null || echo -e "${YELLOW}  Model pull skipped (will pull on first use)${NC}"

    echo -e "${CYAN}[4/6] Configuring Nginx reverse proxy...${NC}"
    cat > /etc/nginx/sites-available/rudrax << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 100M;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:8000;
    }
}
NGINXEOF
    ln -sf /etc/nginx/sites-available/rudrax /etc/nginx/sites-enabled/rudrax
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo -e "${GREEN}  Nginx configured${NC}"

    echo -e "${CYAN}[5/6] Setting up SSL...${NC}"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>/dev/null || echo -e "${YELLOW}  SSL skipped (run: certbot --nginx -d $DOMAIN)${NC}"

    echo -e "${CYAN}[6/6] Setting up systemd service...${NC}"
    cat > /etc/systemd/system/rudrax.service << SERVICEEOF
[Unit]
Description=RudraX CyberSec Platform v2.0
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF
    systemctl daemon-reload
    systemctl enable rudrax

else
    echo -e "${CYAN}[1/8] Installing system dependencies...${NC}"
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl git nodejs npm nmap traceroute dnsutils whois > /dev/null 2>&1
    echo -e "${GREEN}  Dependencies installed${NC}"

    INSTALL_DIR="/opt/rudrax"
    echo -e "${CYAN}[2/8] Creating directory structure...${NC}"
    mkdir -p $INSTALL_DIR/{backend,frontend,data,workspace}

    echo -e "${CYAN}[3/8] Setting up backend...${NC}"
    cp -r "$PROJECT_DIR/backend/"* $INSTALL_DIR/backend/
    cd $INSTALL_DIR/backend
    python3 -m venv .venv
    .venv/bin/pip install --quiet --upgrade pip
    .venv/bin/pip install --quiet poetry
    .venv/bin/poetry config virtualenvs.create false
    .venv/bin/poetry install --no-interaction --quiet 2>/dev/null || .venv/bin/pip install --quiet fastapi[standard] uvicorn pyjwt bcrypt python-multipart aiofiles httpx aiosqlite python-dotenv websockets celery redis
    echo -e "${GREEN}  Backend configured${NC}"

    echo -e "${CYAN}[4/8] Setting up frontend...${NC}"
    if [ -d "$PROJECT_DIR/frontend/dist" ]; then
        cp -r "$PROJECT_DIR/frontend/dist" $INSTALL_DIR/frontend/
    else
        cp -r "$PROJECT_DIR/frontend/"* $INSTALL_DIR/frontend/
        cd $INSTALL_DIR/frontend
        npm install --silent 2>/dev/null
        npm run build 2>/dev/null
    fi
    echo -e "${GREEN}  Frontend configured${NC}"

    echo -e "${CYAN}[5/8] Configuring systemd service...${NC}"
    cat > /etc/systemd/system/rudrax-backend.service << 'SERVICEEOF'
[Unit]
Description=RudraX CyberSec Backend v2.0
After=network.target ollama.service redis.service
Wants=ollama.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rudrax/backend
Environment=PATH=/opt/rudrax/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=DB_PATH=/opt/rudrax/data/rudrax.db
Environment=WORKSPACE_DIR=/opt/rudrax/workspace
Environment=OLLAMA_BASE_URL=http://localhost:11434
Environment=REDIS_URL=redis://localhost:6379/0
Environment=REPORTS_DIR=/opt/rudrax/data/reports
Environment=UPLOAD_DIR=/opt/rudrax/data/uploads
Environment=SECRET_KEY=rudrax-prod-secret-change-this-in-production
ExecStart=/opt/rudrax/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF
    systemctl daemon-reload
    systemctl enable rudrax-backend
    systemctl start rudrax-backend
    echo -e "${GREEN}  Backend service started${NC}"

    echo -e "${CYAN}[6/8] Configuring Nginx...${NC}"
    cat > /etc/nginx/sites-available/rudrax << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    root $INSTALL_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 300s;
        client_max_body_size 100M;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location /healthz {
        proxy_pass http://127.0.0.1:8000;
    }
}
NGINXEOF
    ln -sf /etc/nginx/sites-available/rudrax /etc/nginx/sites-enabled/rudrax
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl restart nginx
    echo -e "${GREEN}  Nginx configured${NC}"

    echo -e "${CYAN}[7/8] Setting up SSL...${NC}"
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email "$EMAIL" --redirect 2>/dev/null || echo -e "${YELLOW}  SSL skipped (ensure DNS points to this server)${NC}"

    echo -e "${CYAN}[8/8] Verifying...${NC}"
    sleep 3
    if curl -s http://127.0.0.1:8000/healthz | grep -q "ok"; then
        echo -e "${GREEN}  Backend is running${NC}"
    else
        echo -e "${YELLOW}  Backend may still be starting. Check: systemctl status rudrax-backend${NC}"
    fi
fi

echo ""
echo -e "${GREEN}${BOLD}=============================================="
echo "  Installation Complete!"
echo "=============================================="
echo -e "${NC}"
echo -e "  Platform: ${CYAN}https://$DOMAIN${NC}"
echo -e "  API Docs: ${CYAN}https://$DOMAIN/api/docs${NC}"
echo ""
echo -e "  Default Admin Login:"
echo -e "    Email:    ${CYAN}lalittheonly@gmail.com${NC}"
echo -e "    Password: ${CYAN}RudraX3#123nda${NC}"
echo ""
if [ "$MODE" = "docker" ]; then
echo -e "  Docker Commands:"
echo -e "    ${YELLOW}docker-compose ps${NC}                - Status"
echo -e "    ${YELLOW}docker-compose logs -f${NC}            - Logs"
echo -e "    ${YELLOW}docker-compose down${NC}               - Stop"
echo -e "    ${YELLOW}docker-compose up -d --build${NC}      - Rebuild"
echo ""
echo -e "  Pull Ollama models:"
echo -e "    ${YELLOW}docker exec rudrax-ollama ollama pull llama3${NC}"
echo -e "    ${YELLOW}docker exec rudrax-ollama ollama pull mistral${NC}"
echo -e "    ${YELLOW}docker exec rudrax-ollama ollama pull codellama${NC}"
else
echo -e "  Service Commands:"
echo -e "    ${YELLOW}systemctl status rudrax-backend${NC}"
echo -e "    ${YELLOW}systemctl restart rudrax-backend${NC}"
echo -e "    ${YELLOW}journalctl -u rudrax-backend -f${NC}"
fi
echo ""
echo -e "  ${BOLD}RudraX CyberSec v2.0 - A Lalit Pandit Product${NC}"
echo ""
