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
echo "  RudraX CyberSec Platform Installer"
echo "  A Lalit Pandit Project"
echo "=============================================="
echo -e "${NC}"

INSTALL_DIR="/opt/rudrax"
DOMAIN="cybersec.rudrax.cloud"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash install.sh)${NC}"
    exit 1
fi

echo -e "${CYAN}[1/8] Installing system dependencies...${NC}"
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl git nodejs npm > /dev/null 2>&1
echo -e "${GREEN}  System dependencies installed${NC}"

echo -e "${CYAN}[2/8] Creating directory structure...${NC}"
mkdir -p $INSTALL_DIR/{backend,frontend,data,workspace}
echo -e "${GREEN}  Directories created${NC}"

echo -e "${CYAN}[3/8] Setting up backend...${NC}"
if [ -d "/tmp/rudrax-src/backend" ]; then
    cp -r /tmp/rudrax-src/backend/* $INSTALL_DIR/backend/
elif [ -d "$(dirname "$0")/../backend" ]; then
    cp -r "$(dirname "$0")/../backend/"* $INSTALL_DIR/backend/
else
    echo -e "${RED}  Backend source not found. Place project files in /tmp/rudrax-src/ first.${NC}"
    exit 1
fi

cd $INSTALL_DIR/backend
python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet poetry
.venv/bin/poetry config virtualenvs.create false
.venv/bin/poetry install --no-interaction --quiet 2>/dev/null || .venv/bin/pip install --quiet fastapi[standard] uvicorn pyjwt bcrypt python-multipart aiofiles httpx aiosqlite python-dotenv websockets
echo -e "${GREEN}  Backend configured${NC}"

echo -e "${CYAN}[4/8] Setting up frontend...${NC}"
if [ -d "/tmp/rudrax-src/frontend/dist" ]; then
    cp -r /tmp/rudrax-src/frontend/dist $INSTALL_DIR/frontend/
elif [ -d "$(dirname "$0")/../frontend/dist" ]; then
    cp -r "$(dirname "$0")/../frontend/dist" $INSTALL_DIR/frontend/
else
    echo -e "${YELLOW}  Pre-built frontend not found. Building from source...${NC}"
    if [ -d "/tmp/rudrax-src/frontend" ]; then
        cp -r /tmp/rudrax-src/frontend/* $INSTALL_DIR/frontend/
    elif [ -d "$(dirname "$0")/../frontend" ]; then
        cp -r "$(dirname "$0")/../frontend/"* $INSTALL_DIR/frontend/
    fi
    cd $INSTALL_DIR/frontend
    npm install --silent 2>/dev/null
    npm run build 2>/dev/null
fi
echo -e "${GREEN}  Frontend configured${NC}"

echo -e "${CYAN}[5/8] Configuring systemd service...${NC}"
cat > /etc/systemd/system/rudrax-backend.service << 'SERVICEEOF'
[Unit]
Description=RudraX CyberSec Backend
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rudrax/backend
Environment=PATH=/opt/rudrax/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin
Environment=DB_PATH=/opt/rudrax/data/rudrax.db
Environment=WORKSPACE_DIR=/opt/rudrax/workspace
Environment=OLLAMA_BASE_URL=http://localhost:11434
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
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /api/agent/ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
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

echo -e "${CYAN}[7/8] Setting up SSL (Let's Encrypt)...${NC}"
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email lalittheonly@gmail.com --redirect 2>/dev/null || echo -e "${YELLOW}  SSL setup skipped (ensure DNS points to this server first)${NC}"
echo -e "${GREEN}  SSL configured${NC}"

echo -e "${CYAN}[8/8] Verifying installation...${NC}"
sleep 3
if curl -s http://127.0.0.1:8000/healthz | grep -q "ok"; then
    echo -e "${GREEN}  Backend is running${NC}"
else
    echo -e "${YELLOW}  Backend may still be starting. Check: systemctl status rudrax-backend${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}=============================================="
echo "  Installation Complete!"
echo "=============================================="
echo -e "${NC}"
echo -e "  Platform: ${CYAN}https://$DOMAIN${NC}"
echo -e "  Backend:  ${CYAN}http://127.0.0.1:8000${NC}"
echo ""
echo -e "  Default Admin Login:"
echo -e "    Email:    ${CYAN}lalittheonly@gmail.com${NC}"
echo -e "    Password: ${CYAN}RudraX3#123nda${NC}"
echo ""
echo -e "  Service Commands:"
echo -e "    ${YELLOW}systemctl status rudrax-backend${NC}"
echo -e "    ${YELLOW}systemctl restart rudrax-backend${NC}"
echo -e "    ${YELLOW}journalctl -u rudrax-backend -f${NC}"
echo ""
echo -e "  ${BOLD}RudraX CyberSec - A Lalit Pandit Project${NC}"
echo ""
