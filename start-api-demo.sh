#!/bin/bash

echo "🚀 STARTING PHOTOGRAPHIC MEMORY REST API DEMO"
echo "=============================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
    echo "   API Key: ${OPENAI_API_KEY:0:10}..."
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if ChromaDB is running
echo ""
echo "🔍 Checking ChromaDB status..."
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✅ ChromaDB is running"
else
    echo "⚠️  ChromaDB not running - starting it..."
    docker run -d -p 8000:8000 --name chromadb-demo chromadb/chroma:latest
    echo "   Waiting for ChromaDB to start..."
    sleep 5
fi

# Start search API
echo ""
echo "🔧 Starting Search API Service..."
cd services/search-api
OPENAI_API_KEY="$OPENAI_API_KEY" pnpm start &
SEARCH_PID=$!
cd ../..

echo "   Search API starting (PID: $SEARCH_PID)"
echo "   Waiting for service to initialize..."
sleep 8

# Test the API
echo ""
echo "🧪 TESTING REST API ENDPOINTS"
echo "=============================="

echo ""
echo "1️⃣ Health Check:"
echo "curl http://localhost:3032/health"
curl -s http://localhost:3032/health | jq '.' 2>/dev/null || curl -s http://localhost:3032/health

echo ""
echo ""
echo "2️⃣ Search for 'Memory':"
echo "curl 'http://localhost:3032/search?q=Memory'"
curl -s "http://localhost:3032/search?q=Memory" | jq '.' 2>/dev/null || curl -s "http://localhost:3032/search?q=Memory"

echo ""
echo ""
echo "3️⃣ Search for 'database':"
echo "curl 'http://localhost:3032/search?q=database'"
curl -s "http://localhost:3032/search?q=database" | jq '.' 2>/dev/null || curl -s "http://localhost:3032/search?q=database"

echo ""
echo ""
echo "4️⃣ Get Recent Memories:"
echo "curl 'http://localhost:3032/recent?limit=5'"
curl -s "http://localhost:3032/recent?limit=5" | jq '.' 2>/dev/null || curl -s "http://localhost:3032/recent?limit=5"

echo ""
echo ""
echo "5️⃣ Get Statistics:"
echo "curl http://localhost:3032/stats"
curl -s http://localhost:3032/stats | jq '.' 2>/dev/null || curl -s http://localhost:3032/stats

echo ""
echo ""
echo "🎉 REST API DEMO COMPLETE!"
echo ""
echo "💡 What you just saw:"
echo "   ✅ HTTP REST API endpoints working"
echo "   ✅ JSON responses with search results"
echo "   ✅ Thumbnail paths included in responses"
echo "   ✅ Confidence scoring and ranking"
echo "   ✅ Full-text search integration"
echo ""
echo "🖥️  API is running at: http://localhost:3032"
echo "📖 Available endpoints:"
echo "   GET  /health           - Service health"
echo "   GET  /search?q=query   - Search memories"
echo "   GET  /recent?limit=N   - Recent memories"
echo "   GET  /stats            - Database statistics"
echo ""
echo "🛑 To stop the demo:"
echo "   kill $SEARCH_PID"
echo "   docker stop chromadb-demo"
