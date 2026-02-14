#!/bin/bash
# RudraX CyberSec - Startup Script
# A Lalit Pandit Product

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   RudraX CyberSec - AI Agent System                          ║"
echo "║   A Lalit Pandit Product                                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE_DIR="${RUDRAX_WORKSPACE:-./workspace}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
PORT="${RUDRAX_PORT:-8000}"

# Create workspace
mkdir -p "$WORKSPACE_DIR"

# Check Python
echo -e "${BLUE}Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed!${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed!${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"

# Check Ollama
echo -e "${BLUE}Checking Ollama...${NC}"
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is running at $OLLAMA_URL${NC}"
else
    echo -e "${YELLOW}⚠ Ollama is not running. Starting Ollama...${NC}"
    ollama serve &
    sleep 5
    if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start Ollama. Please start it manually.${NC}"
        echo -e "${YELLOW}  Run: ollama serve${NC}"
    fi
fi

# Setup Python environment
echo -e "${BLUE}Setting up Python environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Build frontend if needed
echo -e "${BLUE}Checking frontend build...${NC}"
if [ ! -d "app/dist" ] || [ "app/package.json" -nt "app/dist" ]; then
    echo -e "${BLUE}Building frontend...${NC}"
    cd app
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}✓ Frontend built${NC}"
else
    echo -e "${GREEN}✓ Frontend already built${NC}"
fi

# Start server
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Starting RudraX CyberSec Server...                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  • Web Interface: ${GREEN}http://localhost:$PORT${NC}"
echo -e "  • API: ${GREEN}http://localhost:$PORT/api${NC}"
echo -e "  • Health Check: ${GREEN}http://localhost:$PORT/api/health${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Export environment variables
export OLLAMA_URL
export RUDRAX_WORKSPACE
export RUDRAX_PORT="$PORT"

# Start the server
exec python server.py
