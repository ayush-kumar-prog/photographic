#!/bin/bash
# Start Screenpipe for Photographic Memory MVP Development
#
# This script starts Screenpipe with optimal settings for development and testing.
# It includes debug logging and creates the necessary directory structure.
#
# Usage: ./scripts/start-screenpipe.sh [--background]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Screenpipe for Photographic Memory MVP${NC}"
echo "=================================="

# Check if Screenpipe is installed
if ! command -v screenpipe &> /dev/null && ! command -v ~/.local/bin/screenpipe &> /dev/null; then
    echo -e "${RED}❌ Screenpipe not found. Please run the install script first.${NC}"
    exit 1
fi

# Use the correct screenpipe path
SCREENPIPE_CMD="screenpipe"
if [[ -f ~/.local/bin/screenpipe ]]; then
    SCREENPIPE_CMD="~/.local/bin/screenpipe"
fi

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${PROJECT_ROOT}/data"

# Create necessary directories
echo -e "${BLUE}📁 Creating data directories...${NC}"
mkdir -p "${DATA_DIR}/sqlite"
mkdir -p "${DATA_DIR}/media"
mkdir -p "${DATA_DIR}/thumbs"
mkdir -p "${PROJECT_ROOT}/logs"

echo -e "${GREEN}✅ Data directories created:${NC}"
echo "   • SQLite: ${DATA_DIR}/sqlite"
echo "   • Media: ${DATA_DIR}/media"
echo "   • Thumbnails: ${DATA_DIR}/thumbs"
echo "   • Logs: ${PROJECT_ROOT}/logs"

# Check for background flag
BACKGROUND_MODE=false
if [[ "$1" == "--background" ]]; then
    BACKGROUND_MODE=true
    echo -e "${YELLOW}🔄 Running in background mode${NC}"
fi

# Screenpipe configuration for MVP
echo -e "${BLUE}⚙️  Configuring Screenpipe for MVP...${NC}"

# MVP Settings:
# - FPS: 0.5 (30 GB/month, good for testing)
# - Port: 3030 (default)
# - OCR: Apple Native (best for macOS)
# - Audio: Disabled for MVP focus on vision
# - Debug: Enabled for development
# - Data dir: Our project data directory
# - UI monitoring: Enabled for better metadata
# - Frame cache: Enabled for thumbnails

SCREENPIPE_ARGS=(
    --fps 0.5
    --port 3030
    --data-dir "${DATA_DIR}"
    --ocr-engine apple-native
    --disable-audio
    --debug
    --enable-ui-monitoring
    --enable-frame-cache
    --capture-unfocused-windows
)

echo -e "${GREEN}✅ MVP Configuration:${NC}"
echo "   • FPS: 0.5 (optimized for development)"
echo "   • Port: 3030"
echo "   • OCR Engine: Apple Native"
echo "   • Audio: Disabled (MVP focuses on vision)"
echo "   • Debug: Enabled"
echo "   • UI Monitoring: Enabled"
echo "   • Frame Cache: Enabled"
echo "   • Data Directory: ${DATA_DIR}"

# Check macOS permissions
echo -e "${YELLOW}🔐 Checking macOS permissions...${NC}"
echo "   ⚠️  Screenpipe will request the following permissions:"
echo "   • Screen Recording (required for capture)"
echo "   • Accessibility (required for window metadata)"
echo "   • File System Access (for data storage)"
echo ""
echo "   Please grant these permissions when prompted by macOS."
echo "   You may need to go to System Settings > Privacy & Security"
echo "   to manually grant permissions if they're not requested."

# Log file for debugging
LOG_FILE="${PROJECT_ROOT}/logs/screenpipe-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}📝 Logs will be written to: ${LOG_FILE}${NC}"

# Function to handle cleanup on exit
cleanup() {
    if [[ "$BACKGROUND_MODE" == false ]]; then
        echo -e "\n${YELLOW}🛑 Stopping Screenpipe...${NC}"
        if [[ -n $SCREENPIPE_PID ]]; then
            kill $SCREENPIPE_PID 2>/dev/null || true
            wait $SCREENPIPE_PID 2>/dev/null || true
            echo -e "${GREEN}✅ Screenpipe stopped${NC}"
        fi
    fi
}

if [[ "$BACKGROUND_MODE" == true ]]; then
    # Set up signal handlers only for foreground mode
    trap cleanup SIGINT SIGTERM
    
    echo -e "${GREEN}🎬 Starting Screenpipe in background...${NC}"
    
    # Start in background
    eval "$SCREENPIPE_CMD" "${SCREENPIPE_ARGS[@]}" > "$LOG_FILE" 2>&1 &
    SCREENPIPE_PID=$!
    
    echo -e "${GREEN}✅ Screenpipe started in background (PID: $SCREENPIPE_PID)${NC}"
    echo "   • API: http://localhost:3030"
    echo "   • Logs: $LOG_FILE"
    echo "   • Stop with: kill $SCREENPIPE_PID"
    
    # Wait a moment to check if it started successfully
    sleep 3
    if ! kill -0 $SCREENPIPE_PID 2>/dev/null; then
        echo -e "${RED}❌ Screenpipe failed to start. Check logs: $LOG_FILE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Screenpipe is running successfully${NC}"
    echo ""
    echo "To test the client, run:"
    echo "  cd services/ingest-bridge && pnpm tsx src/screenpipe/test-client.ts"
    
else
    # Set up signal handlers for foreground mode
    trap cleanup SIGINT SIGTERM EXIT
    
    echo -e "${GREEN}🎬 Starting Screenpipe...${NC}"
    echo "   Press Ctrl+C to stop"
    echo ""
    
    # Start in foreground with live output
    echo "Starting: $SCREENPIPE_CMD ${SCREENPIPE_ARGS[*]}"
    echo "========================================"
    
    eval "$SCREENPIPE_CMD" "${SCREENPIPE_ARGS[@]}" 2>&1 | tee "$LOG_FILE"
fi
