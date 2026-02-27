#!/bin/bash

# Test script for focus management fixes
echo "🧪 Testing Focus Management Fixes"
echo "================================="

# Check if services are running
echo "📡 Checking services..."

# Check Search API
if curl -s http://localhost:3032/health > /dev/null 2>&1; then
    echo "✅ Search API is running (localhost:3032)"
else
    echo "⚠️  Search API not running - starting it..."
    cd /Users/kumar/Documents/Projects/memories/services/search-api
    pnpm start > /dev/null 2>&1 &
    echo "🔄 Search API starting in background..."
    sleep 3
fi

# Check Ingest Bridge
if curl -s http://localhost:3031/health > /dev/null 2>&1; then
    echo "✅ Ingest Bridge is running (localhost:3031)"
else
    echo "⚠️  Ingest Bridge not running - starting it..."
    cd /Users/kumar/Documents/Projects/memories/services/ingest-bridge
    pnpm start > /dev/null 2>&1 &
    echo "🔄 Ingest Bridge starting in background..."
    sleep 3
fi

# Check Screenpipe
if curl -s http://localhost:3030/health > /dev/null 2>&1; then
    echo "✅ Screenpipe is running (localhost:3030)"
else
    echo "⚠️  Screenpipe not running - you may need to start it manually"
    echo "   Run: ./scripts/start-screenpipe.sh"
fi

echo ""
echo "🎯 Testing Instructions:"
echo "========================"
echo "1. Launch the overlay: cd apps/overlay-macos && .build/debug/MemoryOverlay"
echo "2. Press ⌘⇧\" to toggle the overlay"
echo "3. Try typing in the search bar - it should now accept keyboard input!"
echo "4. Open a browser tab and search for something unique"
echo "5. Wait 30 seconds for it to be captured"
echo "6. Use the overlay to search for that content"
echo ""
echo "🔍 Debug Console:"
echo "Look for these messages in the console:"
echo "  - '🎯 Activating overlay window...'"
echo "  - '✅ Window is key: true'"
echo "  - '✅ Search bar focused successfully'"
echo ""
echo "🎉 If you can type in the search bar, the fix worked!"

