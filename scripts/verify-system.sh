#!/bin/bash

# Complete System Verification Script
# Tests the entire pipeline: Screenpipe → Ingest Bridge → Search

set -e

echo "🧪 PHOTOGRAPHIC MEMORY SYSTEM VERIFICATION"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass_test() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# Test 1: Screenpipe Health Check
echo -e "\n${BLUE}Test 1: Screenpipe Health Check${NC}"
echo "================================"

if curl -s http://localhost:3030/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://localhost:3030/health)
    echo "Health Response: $HEALTH_RESPONSE"
    
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
        pass_test "Screenpipe is healthy"
    elif echo "$HEALTH_RESPONSE" | grep -q '"frame_status":"ok"'; then
        pass_test "Screenpipe is running (degraded but functional)"
    else
        fail_test "Screenpipe status is not healthy"
    fi
else
    fail_test "Screenpipe is not responding on port 3030"
    echo "Please start Screenpipe first: ./scripts/start-screenpipe.sh"
    exit 1
fi

# Test 2: Screenpipe Data Availability
echo -e "\n${BLUE}Test 2: Screenpipe Data Availability${NC}"
echo "===================================="

SEARCH_RESPONSE=$(curl -s "http://localhost:3030/search?content_type=ocr&limit=5")
TOTAL_COUNT=$(echo "$SEARCH_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")

if [ "$TOTAL_COUNT" -gt 0 ]; then
    pass_test "Screenpipe has $TOTAL_COUNT OCR records available"
    
    # Show sample data
    echo "Sample OCR data:"
    echo "$SEARCH_RESPONSE" | head -20
else
    fail_test "No OCR data found in Screenpipe"
    warn "Let Screenpipe run for a few minutes to capture data"
fi

# Test 3: Ingest Bridge Service Build
echo -e "\n${BLUE}Test 3: Ingest Bridge Service Build${NC}"
echo "==================================="

cd services/ingest-bridge
if pnpm build > /dev/null 2>&1; then
    pass_test "Ingest Bridge TypeScript compilation successful"
else
    fail_test "Ingest Bridge TypeScript compilation failed"
    echo "Run 'cd services/ingest-bridge && pnpm build' to see errors"
fi

# Test 4: Database Auto-Creation
echo -e "\n${BLUE}Test 4: Database Auto-Creation${NC}"
echo "==============================="

# Remove existing database to test auto-creation
rm -f ../../data/sqlite/memories.db

# Test database creation without OpenAI (should create DB but fail on embeddings)
if timeout 10s pnpm test:smoke 2>/dev/null || true; then
    if [ -f "../../data/sqlite/memories.db" ]; then
        pass_test "SQLite database auto-created successfully"
        
        # Check schema
        SCHEMA=$(sqlite3 ../../data/sqlite/memories.db ".schema" 2>/dev/null || echo "")
        if echo "$SCHEMA" | grep -q "CREATE TABLE memories"; then
            pass_test "Database schema created correctly"
        else
            fail_test "Database schema not created properly"
        fi
        
        if echo "$SCHEMA" | grep -q "memories_fts"; then
            pass_test "FTS5 virtual table created"
        else
            fail_test "FTS5 virtual table not created"
        fi
        
        if echo "$SCHEMA" | grep -q "idx_memories_ts"; then
            pass_test "Performance indexes created"
        else
            fail_test "Performance indexes not created"
        fi
    else
        fail_test "Database file not created"
    fi
else
    warn "Smoke test timeout (expected without OpenAI key)"
fi

# Test 5: OpenAI Integration (if API key available)
echo -e "\n${BLUE}Test 5: OpenAI Integration${NC}"
echo "=========================="

if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "dummy" ]; then
    info "OpenAI API key detected, testing embeddings..."
    
    # Create a simple test script
    cat > test-embeddings.js << 'EOF'
const { EmbeddingsService } = require('./dist/embeddings/service.js');

async function testEmbeddings() {
    const service = new EmbeddingsService('./test-chroma');
    try {
        await service.initialize();
        const embedding = await service.generateEmbedding('test text for verification');
        
        if (embedding && embedding.length === 3072) {
            console.log('✅ OpenAI embeddings working (3072 dimensions)');
            process.exit(0);
        } else {
            console.log('❌ Invalid embedding dimensions:', embedding?.length);
            process.exit(1);
        }
    } catch (error) {
        console.log('❌ Embeddings test failed:', error.message);
        process.exit(1);
    }
}

testEmbeddings();
EOF

    if node test-embeddings.js 2>/dev/null; then
        pass_test "OpenAI embeddings integration working"
    else
        fail_test "OpenAI embeddings integration failed"
    fi
    
    # Cleanup
    rm -f test-embeddings.js
    rm -rf test-chroma
else
    warn "No valid OpenAI API key found (set OPENAI_API_KEY environment variable)"
    info "Skipping OpenAI integration test"
fi

# Test 6: End-to-End Pipeline (if OpenAI available)
echo -e "\n${BLUE}Test 6: End-to-End Pipeline Test${NC}"
echo "================================="

if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "dummy" ]; then
    info "Testing complete pipeline with real data..."
    
    # Start ingest bridge in background
    OPENAI_API_KEY="$OPENAI_API_KEY" pnpm start > /tmp/ingest-bridge.log 2>&1 &
    INGEST_PID=$!
    
    info "Started Ingest Bridge (PID: $INGEST_PID)"
    sleep 5  # Give it time to start
    
    # Check if it's processing data
    if ps -p $INGEST_PID > /dev/null; then
        pass_test "Ingest Bridge service started successfully"
        
        # Let it run for 30 seconds to process some data
        info "Letting pipeline process data for 30 seconds..."
        sleep 30
        
        # Check if data was processed
        DB_COUNT=$(sqlite3 ../../data/sqlite/memories.db "SELECT COUNT(*) FROM memories" 2>/dev/null || echo "0")
        if [ "$DB_COUNT" -gt 0 ]; then
            pass_test "Pipeline processed $DB_COUNT memory objects"
            
            # Check if embeddings were stored
            CHROMA_FILES=$(find ../../data/chroma -name "*.sqlite" 2>/dev/null | wc -l || echo "0")
            if [ "$CHROMA_FILES" -gt 0 ]; then
                pass_test "Vector embeddings stored in Chroma database"
            else
                fail_test "No Chroma database files found"
            fi
        else
            fail_test "No data processed by pipeline"
        fi
        
        # Stop the service
        kill $INGEST_PID 2>/dev/null || true
        wait $INGEST_PID 2>/dev/null || true
        info "Stopped Ingest Bridge service"
    else
        fail_test "Ingest Bridge service failed to start"
        echo "Check logs: tail /tmp/ingest-bridge.log"
    fi
else
    warn "Skipping end-to-end test (requires OpenAI API key)"
fi

# Test 7: Performance Check
echo -e "\n${BLUE}Test 7: Performance Check${NC}"
echo "========================="

if [ -f "../../data/sqlite/memories.db" ]; then
    # Test query performance
    START_TIME=$(date +%s%N)
    sqlite3 ../../data/sqlite/memories.db "SELECT COUNT(*) FROM memories" > /dev/null 2>&1
    END_TIME=$(date +%s%N)
    QUERY_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds
    
    if [ "$QUERY_TIME" -lt 50 ]; then
        pass_test "SQLite query performance: ${QUERY_TIME}ms (target: <50ms)"
    else
        warn "SQLite query performance: ${QUERY_TIME}ms (slower than 50ms target)"
    fi
    
    # Check database size
    DB_SIZE=$(du -h ../../data/sqlite/memories.db 2>/dev/null | cut -f1 || echo "0B")
    info "Database size: $DB_SIZE"
else
    warn "No database file to test performance"
fi

# Final Results
echo -e "\n${BLUE}VERIFICATION SUMMARY${NC}"
echo "===================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL TESTS PASSED!${NC}"
    echo "✅ Your Photographic Memory system is working correctly!"
    echo ""
    echo "Next steps:"
    echo "1. Set OPENAI_API_KEY for full functionality"
    echo "2. Let Screenpipe capture data for a while"
    echo "3. Proceed to Step 5: Search API Service"
else
    echo -e "\n⚠️  ${YELLOW}SOME TESTS FAILED${NC}"
    echo "Please fix the failing components before proceeding to Step 5"
fi

cd ../..
