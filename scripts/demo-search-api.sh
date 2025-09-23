#!/bin/bash

# Demo Search API Script
# Shows the search API functionality with sample queries

set -e

API_URL="http://localhost:3032"
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}🔍 Search API Demo${NC}"
echo "=================================="
echo ""

# Check if service is running
echo -e "${BLUE}Checking service health...${NC}"
if curl -s "$API_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Search API is running${NC}"
    curl -s "$API_URL/health" | jq '.status, .database.total_memories'
else
    echo -e "${YELLOW}❌ Search API is not running. Start it with:${NC}"
    echo "  cd services/search-api && pnpm dev"
    exit 1
fi

echo ""

# Test search queries
echo -e "${BLUE}Testing search queries...${NC}"
echo ""

queries=(
    "test query"
    "terminal command"
    "code editor"
    "browser window"
    "error message"
)

for query in "${queries[@]}"; do
    echo -e "${BOLD}Query: \"$query\"${NC}"
    
    response=$(curl -s "$API_URL/search?q=$(echo "$query" | sed 's/ /%20/g')&k=3")
    
    if echo "$response" | jq -e '.cards' > /dev/null 2>&1; then
        mode=$(echo "$response" | jq -r '.mode')
        confidence=$(echo "$response" | jq -r '.confidence')
        count=$(echo "$response" | jq -r '.cards | length')
        timing=$(echo "$response" | jq -r '.timing.total_ms // "N/A"')
        
        echo -e "  Mode: ${GREEN}$mode${NC}"
        echo -e "  Confidence: ${GREEN}$confidence${NC}"
        echo -e "  Results: ${GREEN}$count${NC}"
        echo -e "  Timing: ${GREEN}${timing}ms${NC}"
        
        # Show first result if available
        if [ "$count" -gt 0 ]; then
            title=$(echo "$response" | jq -r '.cards[0].title_snippet')
            app=$(echo "$response" | jq -r '.cards[0].app')
            score=$(echo "$response" | jq -r '.cards[0].score')
            echo -e "  Top Result: ${YELLOW}$title${NC} (${app}, score: $score)"
        fi
    else
        echo -e "  ${YELLOW}Error or no results${NC}"
        echo "$response" | jq -r '.error.message // "Unknown error"'
    fi
    
    echo ""
done

# Test recent memories
echo -e "${BLUE}Testing recent memories...${NC}"
recent_response=$(curl -s "$API_URL/recent?limit=5")

if echo "$recent_response" | jq -e '.memories' > /dev/null 2>&1; then
    count=$(echo "$recent_response" | jq -r '.count')
    echo -e "${GREEN}✅ Retrieved $count recent memories${NC}"
    
    # Show recent memory details
    echo "$recent_response" | jq -r '.memories[] | "  - \(.app): \(.title_snippet)"' | head -3
else
    echo -e "${YELLOW}❌ Failed to get recent memories${NC}"
fi

echo ""

# Test statistics
echo -e "${BLUE}Testing statistics...${NC}"
stats_response=$(curl -s "$API_URL/stats")

if echo "$stats_response" | jq -e '.total_memories' > /dev/null 2>&1; then
    total=$(echo "$stats_response" | jq -r '.total_memories')
    apps=$(echo "$stats_response" | jq -r '.unique_apps')
    cache_size=$(echo "$stats_response" | jq -r '.cache_stats.search_cache_size')
    
    echo -e "${GREEN}✅ Statistics retrieved${NC}"
    echo -e "  Total memories: ${GREEN}$total${NC}"
    echo -e "  Unique apps: ${GREEN}$apps${NC}"
    echo -e "  Cache size: ${GREEN}$cache_size${NC}"
    
    # Show top apps
    echo -e "  Top apps:"
    echo "$stats_response" | jq -r '.app_distribution[:3][] | "    - \(.app): \(.count)"'
else
    echo -e "${YELLOW}❌ Failed to get statistics${NC}"
fi

echo ""

# Test query parsing features
echo -e "${BLUE}Testing advanced query features...${NC}"
echo ""

advanced_queries=(
    "Amazon product 2 weeks ago"
    "YouTube video last month"
    "Apex score yesterday"
    "Safari error dialog"
    "terminal command today"
)

for query in "${advanced_queries[@]}"; do
    echo -e "${BOLD}Advanced Query: \"$query\"${NC}"
    
    response=$(curl -s "$API_URL/search?q=$(echo "$query" | sed 's/ /%20/g')&k=2")
    
    if echo "$response" | jq -e '.query_parsed' > /dev/null 2>&1; then
        app_hints=$(echo "$response" | jq -r '.query_parsed.app_hints[]?' | tr '\n' ',' | sed 's/,$//')
        topic_hints=$(echo "$response" | jq -r '.query_parsed.topic_hints[:3][]?' | tr '\n' ',' | sed 's/,$//')
        answer_field=$(echo "$response" | jq -r '.query_parsed.answer_field // "none"')
        time_window=$(echo "$response" | jq -r '.query_parsed.time_window.from // "none"')
        
        echo -e "  App hints: ${GREEN}$app_hints${NC}"
        echo -e "  Topics: ${GREEN}$topic_hints${NC}"
        echo -e "  Answer field: ${GREEN}$answer_field${NC}"
        echo -e "  Time window: ${GREEN}${time_window:0:10}${NC}"
        
        # Show nuggets if available
        nugget_type=$(echo "$response" | jq -r '.cards[0].nugget.type // "none"')
        nugget_value=$(echo "$response" | jq -r '.cards[0].nugget.value // "none"')
        if [ "$nugget_type" != "none" ]; then
            echo -e "  Nugget: ${YELLOW}$nugget_type = $nugget_value${NC}"
        fi
    else
        echo -e "  ${YELLOW}No parsing info available${NC}"
    fi
    
    echo ""
done

echo -e "${BOLD}🎉 Search API Demo Complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Start the ingest bridge service to populate more data"
echo "2. Test with real screen capture data"
echo "3. Integrate with SwiftUI overlay (Step 7)"
echo ""
echo -e "${BLUE}API Endpoints:${NC}"
echo "  Health: $API_URL/health"
echo "  Search: $API_URL/search?q=your+query"
echo "  Recent: $API_URL/recent?limit=10"
echo "  Stats:  $API_URL/stats"
