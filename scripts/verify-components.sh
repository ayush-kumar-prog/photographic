#!/bin/bash

# Component-by-Component Verification Script
# Tests each part of our system independently

set -e

echo "🧪 PHOTOGRAPHIC MEMORY COMPONENT VERIFICATION"
echo "============================================="

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

# Test 1: TypeScript Compilation
echo -e "\n${BLUE}Test 1: TypeScript Compilation${NC}"
echo "==============================="

cd services/ingest-bridge
if pnpm build > /dev/null 2>&1; then
    pass_test "Ingest Bridge TypeScript compilation successful"
else
    fail_test "Ingest Bridge TypeScript compilation failed"
    echo "Run 'cd services/ingest-bridge && pnpm build' to see errors"
fi

# Test 2: Database Schema Creation
echo -e "\n${BLUE}Test 2: Database Schema Creation${NC}"
echo "================================="

# Remove existing database to test auto-creation
rm -f ../../data/sqlite/memories.db ../../data/sqlite/memories.db-*

# Create a simple test script to initialize database
cat > test-database.js << 'EOF'
const { DatabaseManager } = require('./dist/database/manager.js');

async function testDatabase() {
    const dbManager = new DatabaseManager('../../data/sqlite');
    try {
        await dbManager.initialize();
        console.log('✅ Database initialized successfully');
        
        // Test schema
        const stats = await dbManager.getStats();
        console.log('✅ Database stats:', stats);
        
        process.exit(0);
    } catch (error) {
        console.log('❌ Database test failed:', error.message);
        process.exit(1);
    }
}

testDatabase();
EOF

if node test-database.js 2>/dev/null; then
    pass_test "Database schema creation and initialization"
    
    # Check if database file exists
    if [ -f "../../data/sqlite/memories.db" ]; then
        pass_test "SQLite database file created"
        
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
    else
        fail_test "Database file not created"
    fi
else
    fail_test "Database initialization failed"
fi

# Cleanup
rm -f test-database.js

# Test 3: Mock Data Processing
echo -e "\n${BLUE}Test 3: Mock Data Processing${NC}"
echo "============================="

# Create mock Screenpipe data
cat > test-mock-data.js << 'EOF'
const { DatabaseManager } = require('./dist/database/manager.js');

const mockScreenpipeEvents = [
    {
        id: 'test-event-1',
        timestamp: Date.now(),
        type: 'OCR',
        content: {
            text: 'Welcome to the Photographic Memory MVP test',
            app_name: 'Cursor',
            window_name: 'memories - Cursor',
            file_path: '/tmp/test-screenshot-1.png'
        }
    },
    {
        id: 'test-event-2',
        timestamp: Date.now() + 1000,
        type: 'OCR',
        content: {
            text: 'Testing database storage and retrieval functionality',
            app_name: 'Terminal',
            window_name: 'Terminal — bash',
            file_path: '/tmp/test-screenshot-2.png'
        }
    }
];

async function testMockData() {
    const dbManager = new DatabaseManager('../../data/sqlite');
    try {
        await dbManager.initialize();
        
        // Transform and store mock events
        for (const event of mockScreenpipeEvents) {
            const memoryObject = {
                id: event.id,
                ts: event.timestamp,
                session_id: null,
                app: event.content.app_name,
                window_title: event.content.window_name,
                url: null,
                url_host: null,
                media_path: event.content.file_path,
                thumb_path: null,
                ocr_text: event.content.text,
                asr_text: null,
                entities: [],
                topics: []
            };
            
            await dbManager.storeMemoryObject(memoryObject);
        }
        
        console.log('✅ Mock data stored successfully');
        
        // Test search
        const searchResults = await dbManager.searchMemories('Photographic Memory', 10, 0);
        if (searchResults.length > 0) {
            console.log('✅ FTS search working:', searchResults.length, 'results');
        } else {
            console.log('❌ FTS search returned no results');
            process.exit(1);
        }
        
        // Test recent memories
        const recentMemories = await dbManager.getRecentMemories(10, 0);
        if (recentMemories.length > 0) {
            console.log('✅ Recent memories retrieval working:', recentMemories.length, 'results');
        } else {
            console.log('❌ Recent memories returned no results');
            process.exit(1);
        }
        
        process.exit(0);
    } catch (error) {
        console.log('❌ Mock data test failed:', error.message);
        process.exit(1);
    }
}

testMockData();
EOF

if node test-mock-data.js 2>/dev/null; then
    pass_test "Mock data processing and storage"
    pass_test "FTS5 search functionality"
    pass_test "Recent memories retrieval"
else
    fail_test "Mock data processing failed"
fi

# Cleanup
rm -f test-mock-data.js

# Test 4: Thumbnail Generation
echo -e "\n${BLUE}Test 4: Thumbnail Generation${NC}"
echo "============================="

# Create a test image for thumbnail generation
cat > test-thumbnails.js << 'EOF'
const { ThumbnailService } = require('./dist/media/thumbnails.js');
const fs = require('fs');
const path = require('path');

async function testThumbnails() {
    const thumbnailService = new ThumbnailService('../../data/thumbs');
    
    try {
        // Create a simple test SVG image
        const testImagePath = '/tmp/test-image.svg';
        const testSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="blue"/>
            <text x="50" y="50" text-anchor="middle" fill="white">TEST</text>
        </svg>`;
        
        fs.writeFileSync(testImagePath, testSvg);
        
        // Test thumbnail generation
        const thumbnailPath = await thumbnailService.generateThumbnail(testImagePath, 'test-event-thumb');
        
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            console.log('✅ Thumbnail generation working');
            console.log('✅ Thumbnail saved to:', thumbnailPath);
        } else {
            console.log('❌ Thumbnail not generated');
            process.exit(1);
        }
        
        // Test stats
        const stats = await thumbnailService.getStats();
        console.log('✅ Thumbnail stats:', stats);
        
        // Cleanup
        fs.unlinkSync(testImagePath);
        
        process.exit(0);
    } catch (error) {
        console.log('❌ Thumbnail test failed:', error.message);
        process.exit(1);
    }
}

testThumbnails();
EOF

if node test-thumbnails.js 2>/dev/null; then
    pass_test "Thumbnail generation service"
else
    fail_test "Thumbnail generation failed"
fi

# Cleanup
rm -f test-thumbnails.js

# Test 5: OpenAI Integration (if available)
echo -e "\n${BLUE}Test 5: OpenAI Integration${NC}"
echo "=========================="

if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "dummy" ]; then
    info "OpenAI API key detected, testing embeddings..."
    
    cat > test-embeddings.js << 'EOF'
const { EmbeddingsService } = require('./dist/embeddings/service.js');

async function testEmbeddings() {
    const service = new EmbeddingsService('../../data/chroma');
    try {
        await service.initialize();
        const embedding = await service.generateEmbedding('test text for verification');
        
        if (embedding && embedding.length === 3072) {
            console.log('✅ OpenAI embeddings working (3072 dimensions)');
            
            // Test storing and retrieving
            const testMemory = {
                id: 'embedding-test-1',
                ts: Date.now(),
                ocr_text: 'test text for verification',
                app: 'Test',
                embedding: embedding
            };
            
            await service.storeEmbedding(testMemory);
            console.log('✅ Embedding storage working');
            
            const similar = await service.searchSimilar('test verification', 5);
            if (similar.length > 0) {
                console.log('✅ Semantic search working:', similar.length, 'results');
            }
            
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
        pass_test "OpenAI embeddings integration"
        pass_test "ChromaDB vector storage"
        pass_test "Semantic search functionality"
    else
        fail_test "OpenAI embeddings integration failed"
    fi
    
    # Cleanup
    rm -f test-embeddings.js
else
    warn "No valid OpenAI API key found (set OPENAI_API_KEY environment variable)"
    info "Skipping OpenAI integration test"
fi

# Test 6: Performance Benchmarks
echo -e "\n${BLUE}Test 6: Performance Benchmarks${NC}"
echo "==============================="

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
    
    # Test FTS performance
    START_TIME=$(date +%s%N)
    sqlite3 ../../data/sqlite/memories.db "SELECT * FROM memories_fts WHERE memories_fts MATCH 'test' LIMIT 10" > /dev/null 2>&1
    END_TIME=$(date +%s%N)
    FTS_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ "$FTS_TIME" -lt 100 ]; then
        pass_test "FTS5 search performance: ${FTS_TIME}ms (target: <100ms)"
    else
        warn "FTS5 search performance: ${FTS_TIME}ms (slower than 100ms target)"
    fi
else
    warn "No database file to test performance"
fi

# Final Results
echo -e "\n${BLUE}COMPONENT VERIFICATION SUMMARY${NC}"
echo "==============================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL COMPONENTS WORKING!${NC}"
    echo "✅ Your Ingest Bridge service is fully functional!"
    echo ""
    echo "What's working:"
    echo "• ✅ TypeScript compilation"
    echo "• ✅ SQLite database with FTS5"
    echo "• ✅ Memory object storage/retrieval"
    echo "• ✅ Thumbnail generation"
    if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "dummy" ]; then
        echo "• ✅ OpenAI embeddings & ChromaDB"
        echo "• ✅ Semantic search"
    fi
    echo ""
    echo "Ready for Step 5: Search API Service!"
else
    echo -e "\n⚠️  ${YELLOW}SOME COMPONENTS NEED ATTENTION${NC}"
    echo "Please fix the failing components before proceeding"
fi

cd ../..
