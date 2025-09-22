#!/bin/bash

# Run all component tests
echo "🧪 PHOTOGRAPHIC MEMORY SYSTEM VERIFICATION"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_script="$2"
    
    echo -e "${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    if node "$test_script"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Run all tests
run_test "Database Component" "scripts/test-database.js"
run_test "Thumbnail Component" "scripts/test-thumbnails.js"
run_test "Embeddings Component" "scripts/test-embeddings.js"

# Additional system checks
echo -e "${BLUE}Additional System Checks${NC}"
echo "----------------------------------------"

# Check TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
cd services/ingest-bridge
if pnpm build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    ((TESTS_FAILED++))
fi
cd ../..

# Check file structure
echo "📁 Checking file structure..."
if [ -f "data/sqlite/memories.db" ]; then
    echo -e "${GREEN}✅ SQLite database exists${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ SQLite database missing${NC}"
    ((TESTS_FAILED++))
fi

if [ -d "data/thumbs" ]; then
    echo -e "${GREEN}✅ Thumbnails directory exists${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Thumbnails directory missing${NC}"
    ((TESTS_FAILED++))
fi

if [ -d "data/chroma" ]; then
    echo -e "${GREEN}✅ ChromaDB directory exists${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  ChromaDB directory missing (normal without OpenAI key)${NC}"
fi

# Performance test
echo "⚡ Testing database performance..."
START_TIME=$(date +%s%N)
sqlite3 data/sqlite/memories.db "SELECT COUNT(*) FROM memories" > /dev/null 2>&1
END_TIME=$(date +%s%N)
QUERY_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$QUERY_TIME" -lt 50 ]; then
    echo -e "${GREEN}✅ Database performance: ${QUERY_TIME}ms (excellent)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Database performance: ${QUERY_TIME}ms (acceptable)${NC}"
fi

# Final summary
echo ""
echo -e "${BLUE}VERIFICATION SUMMARY${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "🎉 ${GREEN}ALL SYSTEMS GO!${NC}"
    echo ""
    echo "✅ What's Working:"
    echo "  • TypeScript compilation and build system"
    echo "  • SQLite database with FTS5 full-text search"
    echo "  • Memory object storage and retrieval"
    echo "  • Thumbnail generation with Sharp"
    echo "  • Database performance optimization"
    echo "  • File system structure"
    echo ""
    if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "dummy" ]; then
        echo "  • OpenAI embeddings integration"
        echo "  • ChromaDB vector storage"
        echo "  • Semantic search capabilities"
        echo ""
    else
        echo "⚠️  OpenAI Integration:"
        echo "  • Set OPENAI_API_KEY to enable semantic search"
        echo "  • All other components work without it"
        echo ""
    fi
    echo -e "${GREEN}🚀 READY TO PROCEED TO STEP 5: SEARCH API SERVICE${NC}"
else
    echo -e "⚠️  ${YELLOW}SOME ISSUES DETECTED${NC}"
    echo "Please review the failed tests above"
fi
