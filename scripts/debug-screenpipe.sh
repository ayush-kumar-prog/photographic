#!/bin/bash
# Simple Screenpipe Debug Tool
# 
# This script provides manual debugging commands for Screenpipe integration.
# Use this to quickly test API endpoints and troubleshoot issues.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCREENPIPE_URL="http://localhost:3030"

echo -e "${BLUE}🔧 Screenpipe Debug Tool${NC}"
echo "========================="

# Function to check if Screenpipe is running
check_screenpipe() {
    echo -e "${BLUE}🏥 Checking Screenpipe health...${NC}"
    
    if curl -s "$SCREENPIPE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Screenpipe is running at $SCREENPIPE_URL${NC}"
        
        # Get health details
        echo -e "${BLUE}📊 Health Status:${NC}"
        curl -s "$SCREENPIPE_URL/health" | jq '.' 2>/dev/null || curl -s "$SCREENPIPE_URL/health"
        echo ""
    else
        echo -e "${RED}❌ Screenpipe is not running or not accessible at $SCREENPIPE_URL${NC}"
        echo "   Start it with: ./scripts/start-screenpipe.sh --background"
        exit 1
    fi
}

# Function to test basic search
test_search() {
    echo -e "${BLUE}🔍 Testing basic search...${NC}"
    
    echo "Testing with content_type=ocr, limit=3:"
    curl -s "$SCREENPIPE_URL/search?content_type=ocr&limit=3" | jq '.' 2>/dev/null || {
        echo -e "${RED}❌ Search failed or returned invalid JSON${NC}"
        echo "Raw response:"
        curl -s "$SCREENPIPE_URL/search?content_type=ocr&limit=3"
        echo ""
    }
}

# Function to test different content types
test_content_types() {
    echo -e "${BLUE}🧪 Testing different content types...${NC}"
    
    for content_type in "all" "ocr" "audio" "ui"; do
        echo -e "${YELLOW}Testing content_type=$content_type:${NC}"
        response=$(curl -s "$SCREENPIPE_URL/search?content_type=$content_type&limit=1")
        
        if echo "$response" | jq '.' > /dev/null 2>&1; then
            count=$(echo "$response" | jq '.data | length' 2>/dev/null || echo "0")
            total=$(echo "$response" | jq '.pagination.total' 2>/dev/null || echo "unknown")
            echo -e "  ${GREEN}✅ Success: $count results (total: $total)${NC}"
        else
            echo -e "  ${RED}❌ Failed: $response${NC}"
        fi
    done
    echo ""
}

# Function to show recent activity
show_recent() {
    echo -e "${BLUE}📅 Recent activity (last 10 minutes)...${NC}"
    
    # Calculate timestamp for 10 minutes ago
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        start_time=$(date -u -v-10M '+%Y-%m-%dT%H:%M:%S.000Z')
    else
        # Linux
        start_time=$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%S.000Z')
    fi
    
    echo "Searching from: $start_time"
    
    response=$(curl -s "$SCREENPIPE_URL/search?content_type=ocr&limit=5&start_time=$start_time")
    
    if echo "$response" | jq '.' > /dev/null 2>&1; then
        echo "$response" | jq '.data[] | {
            timestamp: .timestamp,
            app: .app_name,
            window: .window_name,
            ocr_preview: (.ocr_text // "" | .[0:100])
        }' 2>/dev/null || echo "$response"
    else
        echo -e "${RED}❌ Failed to get recent activity${NC}"
        echo "Response: $response"
    fi
    echo ""
}

# Function to check logs
check_logs() {
    echo -e "${BLUE}📝 Checking Screenpipe logs...${NC}"
    
    log_file=$(ls -t /Users/kumar/Documents/Projects/memories/logs/screenpipe-*.log 2>/dev/null | head -1)
    
    if [[ -f "$log_file" ]]; then
        echo "Latest log file: $log_file"
        echo -e "${YELLOW}Last 10 lines:${NC}"
        tail -10 "$log_file"
    else
        echo -e "${YELLOW}No Screenpipe log files found${NC}"
    fi
    echo ""
}

# Function to show process info
show_process() {
    echo -e "${BLUE}⚙️  Screenpipe process info...${NC}"
    
    pids=$(pgrep -f screenpipe || true)
    if [[ -n "$pids" ]]; then
        echo -e "${GREEN}✅ Screenpipe processes found:${NC}"
        for pid in $pids; do
            echo "  PID: $pid"
            ps -p "$pid" -o pid,ppid,pcpu,pmem,etime,command 2>/dev/null || true
        done
    else
        echo -e "${RED}❌ No Screenpipe processes running${NC}"
    fi
    echo ""
}

# Main menu
show_menu() {
    echo -e "${YELLOW}Choose a debug option:${NC}"
    echo "1. Check health status"
    echo "2. Test basic search"
    echo "3. Test all content types"
    echo "4. Show recent activity"
    echo "5. Check logs"
    echo "6. Show process info"
    echo "7. Run all checks"
    echo "8. Exit"
    echo ""
}

# Run specific test based on argument
if [[ $# -gt 0 ]]; then
    case "$1" in
        "health") check_screenpipe ;;
        "search") test_search ;;
        "types") test_content_types ;;
        "recent") show_recent ;;
        "logs") check_logs ;;
        "process") show_process ;;
        "all") 
            check_screenpipe
            test_content_types
            show_recent
            check_logs
            show_process
            ;;
        *) 
            echo "Usage: $0 [health|search|types|recent|logs|process|all]"
            exit 1
            ;;
    esac
    exit 0
fi

# Interactive mode
while true; do
    show_menu
    read -p "Enter your choice (1-8): " choice
    
    case $choice in
        1) check_screenpipe ;;
        2) test_search ;;
        3) test_content_types ;;
        4) show_recent ;;
        5) check_logs ;;
        6) show_process ;;
        7) 
            check_screenpipe
            test_content_types
            show_recent
            check_logs
            show_process
            ;;
        8) 
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *) 
            echo -e "${RED}❌ Invalid choice. Please enter 1-8.${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done
