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
echo "  RudraX CyberSec v2.0 - Update Script"
echo "=============================================="
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}[1/4] Pulling latest code from GitHub...${NC}"
git stash 2>/dev/null || true
git pull origin main
git stash pop 2>/dev/null || true
echo -e "${GREEN}  Code updated${NC}"

OLLAMA_HOST_URL="${OLLAMA_BASE_URL:-}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "ollama"; then
    OLLAMA_CONTAINER=$(docker ps --format '{{.Names}}' | grep ollama | head -1)
    OLLAMA_PORT=$(docker port "$OLLAMA_CONTAINER" 11434 2>/dev/null | head -1 | cut -d: -f2)
    if [ -n "$OLLAMA_PORT" ]; then
        OLLAMA_HOST_URL="http://host.docker.internal:${OLLAMA_PORT}"
        echo -e "${GREEN}  Found existing Ollama container: $OLLAMA_CONTAINER (port $OLLAMA_PORT)${NC}"
    fi
fi

if [ -z "$OLLAMA_HOST_URL" ] && curl -s http://localhost:11434/ >/dev/null 2>&1; then
    OLLAMA_HOST_URL="http://host.docker.internal:11434"
    echo -e "${GREEN}  Found Ollama running on host at port 11434${NC}"
fi

echo -e "${CYAN}[2/4] Rebuilding Docker containers...${NC}"
docker-compose down --remove-orphans 2>/dev/null || true

if [ -n "$OLLAMA_HOST_URL" ]; then
    echo -e "${YELLOW}  Using existing Ollama at: $OLLAMA_HOST_URL${NC}"
    OLLAMA_BASE_URL="$OLLAMA_HOST_URL" docker-compose up -d --build rudrax-backend rudrax-frontend redis celery-worker
else
    echo -e "${YELLOW}  Starting full stack including Ollama...${NC}"
    docker-compose up -d --build
fi
echo -e "${GREEN}  Containers rebuilt and started${NC}"

echo -e "${CYAN}[3/4] Verifying services...${NC}"
sleep 5
if curl -s http://127.0.0.1:8000/healthz 2>/dev/null | grep -q "ok"; then
    echo -e "${GREEN}  Backend is running${NC}"
else
    echo -e "${YELLOW}  Backend may still be starting...${NC}"
fi

echo -e "${CYAN}[4/4] Checking Ollama connection...${NC}"
if curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | grep -q "models"; then
    echo -e "${GREEN}  Ollama reachable on host - models available${NC}"
elif docker exec rudrax-ollama ollama list 2>/dev/null | grep -q ":"; then
    echo -e "${GREEN}  Ollama running in Docker - models available${NC}"
else
    echo -e "${YELLOW}  Ollama not reachable yet.${NC}"
    echo -e "${YELLOW}  If Ollama runs in a separate container, use:${NC}"
    echo -e "${YELLOW}    OLLAMA_BASE_URL=http://host.docker.internal:11434 docker-compose up -d --build${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}  Update complete!${NC}"
echo -e "  Platform: ${CYAN}https://cybersec.rudrax.cloud${NC}"
echo ""
