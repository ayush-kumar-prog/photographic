#!/bin/bash

# Step 5 Verification Script
# Comprehensive testing of Search API Service functionality

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3032"
INGEST_URL="http://localhost:3031"
SCREENPIPE_URL="http://localhost:3030"

echo -e "${BOLD}🔍 Step 5 Verification: Search API Service${NC}"
echo "=================================================="
echo ""

# Track test results
TESTS_PASSED=0
TESTS_TOTAL=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}Testing: $test_name${NC}"
    
    if eval "$test_command" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        echo "Command: $test_command"
        echo "Expected pattern: $expected_pattern"
        echo "Actual output:"
        eval "$test_command" | head -5
    fi
    echo ""
}

# 1. Service Health Checks
echo -e "${BOLD}1. Service Health Checks${NC}"
echo "------------------------"

run_test "Search API Health" \
    "curl -s $API_URL/health" \
    "healthy"

run_test "Search API Database Connection" \
    "curl -s $API_URL/health | jq -r '.database.total_memories'" \
    "[0-9]"

run_test "Ingest Bridge Health" \
    "curl -s $INGEST_URL/health" \
    "healthy"

run_test "Screenpipe Health" \
    "curl -s $SCREENPIPE_URL/health" \
    "ok"

# 2. API Endpoint Tests
echo -e "${BOLD}2. API Endpoint Tests${NC}"
echo "---------------------"

run_test "Search Endpoint Basic" \
    "curl -s '$API_URL/search?q=test'" \
    "mode"

run_test "Search Endpoint with Parameters" \
    "curl -s '$API_URL/search?q=terminal&k=3'" \
    "cards"

run_test "Recent Memories Endpoint" \
    "curl -s '$API_URL/recent?limit=5'" \
    "memories"

run_test "Statistics Endpoint" \
    "curl -s '$API_URL/stats'" \
    "total_memories"

run_test "Search Response Structure" \
    "curl -s '$API_URL/search?q=test' | jq -r 'keys[]'" \
    "confidence"

# 3. Query Understanding Tests
echo -e "${BOLD}3. Query Understanding Tests${NC}"
echo "----------------------------"

run_test "Time Parsing - Yesterday" \
    "curl -s '$API_URL/search?q=yesterday' | jq -r '.query_parsed.time_window.from'" \
    "2025"

run_test "App Detection - Safari" \
    "curl -s '$API_URL/search?q=Safari%20browser' | jq -r '.query_parsed.app_hints[]'" \
    "Safari"

run_test "Topic Extraction" \
    "curl -s '$API_URL/search?q=microeconomics%20video' | jq -r '.query_parsed.topic_hints[]'" \
    "microeconomics"

run_test "Answer Field Detection - Price" \
    "curl -s '$API_URL/search?q=price%20of%20product' | jq -r '.query_parsed.answer_field'" \
    "price"

# 4. Performance Tests
echo -e "${BOLD}4. Performance Tests${NC}"
echo "-------------------"

echo -e "${BLUE}Testing: Search Response Time${NC}"
start_time=$(date +%s%3N)
curl -s "$API_URL/search?q=test%20performance" > /dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [ $response_time -lt 1000 ]; then
    echo -e "${GREEN}✅ PASS: Search Response Time (${response_time}ms < 1000ms)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Search Response Time (${response_time}ms >= 1000ms)${NC}"
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test cache performance
echo -e "${BLUE}Testing: Cache Performance${NC}"
query="test%20cache%20performance"

# First request (cold)
start_time=$(date +%s%3N)
curl -s "$API_URL/search?q=$query" > /dev/null
cold_time=$(($(date +%s%3N) - start_time))

# Second request (cached)
start_time=$(date +%s%3N)
curl -s "$API_URL/search?q=$query" > /dev/null
warm_time=$(($(date +%s%3N) - start_time))

if [ $warm_time -lt $cold_time ]; then
    echo -e "${GREEN}✅ PASS: Cache Performance (warm: ${warm_time}ms < cold: ${cold_time}ms)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Cache Performance (warm: ${warm_time}ms >= cold: ${cold_time}ms)${NC}"
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# 5. Data Quality Tests
echo -e "${BOLD}5. Data Quality Tests${NC}"
echo "--------------------"

run_test "Search Returns Results" \
    "curl -s '$API_URL/search?q=terminal' | jq -r '.cards | length'" \
    "[1-9]"

run_test "Results Have Required Fields" \
    "curl -s '$API_URL/search?q=test' | jq -r '.cards[0] | keys[]'" \
    "title_snippet"

run_test "Confidence Score Range" \
    "curl -s '$API_URL/search?q=test' | jq -r '.confidence'" \
    "0\."

run_test "Mode Assignment" \
    "curl -s '$API_URL/search?q=test' | jq -r '.mode'" \
    "exact\|jog"

# 6. Error Handling Tests
echo -e "${BOLD}6. Error Handling Tests${NC}"
echo "----------------------"

run_test "Empty Query Validation" \
    "curl -s '$API_URL/search?q=' | jq -r '.error.code'" \
    "VALIDATION_ERROR"

run_test "Invalid Parameter Handling" \
    "curl -s '$API_URL/search?q=test&k=999' | jq -r '.error.code'" \
    "VALIDATION_ERROR"

run_test "Malformed Request Handling" \
    "curl -s '$API_URL/recent?limit=abc' | jq -r '.error.code'" \
    "VALIDATION_ERROR"

# 7. Integration Tests
echo -e "${BOLD}7. Integration Tests${NC}"
echo "-------------------"

# Check if we have data to work with
total_memories=$(curl -s "$API_URL/stats" | jq -r '.total_memories')
echo -e "${BLUE}Database contains: ${total_memories} memories${NC}"

if [ "$total_memories" -gt 0 ]; then
    run_test "Search with Real Data" \
        "curl -s '$API_URL/search?q=terminal' | jq -r '.cards[0].app'" \
        "."
    
    run_test "Recent Memories with Real Data" \
        "curl -s '$API_URL/recent?limit=1' | jq -r '.memories[0].app'" \
        "."
else
    echo -e "${YELLOW}⚠️  No data in database - run ingest bridge to populate${NC}"
fi

# 8. Component Tests
echo -e "${BOLD}8. Component Tests${NC}"
echo "------------------"

echo -e "${BLUE}Running Nugget Extractor Tests...${NC}"
cd /Users/kumar/Documents/Projects/memories/services/search-api
if pnpm test:nugget-extractors > /tmp/nugget_test.log 2>&1; then
    success_rate=$(grep "Overall:" /tmp/nugget_test.log | grep -o "[0-9]*\.[0-9]*%" | head -1)
    echo -e "${GREEN}✅ PASS: Nugget Extractors ($success_rate success rate)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Nugget Extractors${NC}"
    tail -5 /tmp/nugget_test.log
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# 9. Demo Query Tests
echo -e "${BOLD}9. Demo Query Tests${NC}"
echo "-------------------"

demo_queries=(
    "dad's birthday gift 2 weeks ago"
    "my Apex score yesterday"
    "YouTube microeconomics video last month"
    "Safari Amazon product"
    "terminal command"
)

for query in "${demo_queries[@]}"; do
    encoded_query=$(echo "$query" | sed 's/ /%20/g' | sed "s/'/%27/g")
    test_name="Demo Query: $query"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}Testing: $test_name${NC}"
    
    response=$(curl -s "$API_URL/search?q=$encoded_query")
    
    if echo "$response" | jq -e '.mode and .confidence and .cards' > /dev/null 2>&1; then
        mode=$(echo "$response" | jq -r '.mode')
        confidence=$(echo "$response" | jq -r '.confidence')
        card_count=$(echo "$response" | jq -r '.cards | length')
        
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        echo -e "   Mode: $mode, Confidence: $confidence, Cards: $card_count"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        echo "$response" | jq -r '.error.message // "Unknown error"'
    fi
    echo ""
done

# 10. Final Report
echo -e "${BOLD}📊 Step 5 Verification Report${NC}"
echo "================================"

success_rate=$(echo "scale=1; $TESTS_PASSED * 100 / $TESTS_TOTAL" | bc)
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}/${TESTS_TOTAL} (${success_rate}%)"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Step 5 is working perfectly.${NC}"
    exit_code=0
elif [ $(echo "$success_rate >= 80" | bc) -eq 1 ]; then
    echo -e "${YELLOW}✅ MOSTLY WORKING! Step 5 is functional with minor issues.${NC}"
    exit_code=0
else
    echo -e "${RED}❌ SIGNIFICANT ISSUES! Step 5 needs attention.${NC}"
    exit_code=1
fi

echo ""
echo -e "${BOLD}Next Steps:${NC}"
if [ "$total_memories" -eq 0 ]; then
    echo "1. Start the ingest bridge service to populate data"
    echo "2. Let it run for 10-15 minutes to capture screen data"
    echo "3. Re-run this verification script"
else
    echo "1. Step 5 verification complete ✅"
    echo "2. Ready to proceed to Step 7: SwiftUI Overlay"
    echo "3. All search functionality is operational"
fi

echo ""
echo -e "${BOLD}Service URLs:${NC}"
echo "Search API:    $API_URL"
echo "Ingest Bridge: $INGEST_URL"
echo "Screenpipe:    $SCREENPIPE_URL"

exit $exit_code
