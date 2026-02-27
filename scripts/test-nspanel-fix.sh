#!/bin/bash

# Test script for NSPanel keyboard focus fix
echo "🧪 Testing NSPanel Keyboard Focus Fix"
echo "====================================="

# Check if services are running
echo "📡 Checking services status..."

# Check Search API
if curl -s http://localhost:3032/health > /dev/null 2>&1; then
    echo "✅ Search API is running (localhost:3032)"
else
    echo "⚠️  Search API not running - you may need to start it"
    echo "   Run: cd services/search-api && pnpm start"
fi

# Check if build is ready
if [ -f "apps/overlay-macos/.build/debug/MemoryOverlay" ]; then
    echo "✅ Overlay binary is built and ready"
else
    echo "🔄 Building overlay..."
    cd apps/overlay-macos && swift build
fi

echo ""
echo "🎯 NSPanel Implementation Changes:"
echo "================================="
echo "✅ Converted NSWindow → NSPanel"
echo "✅ Added .nonactivatingPanel style mask"
echo "✅ Set isFloatingPanel = true"
echo "✅ Set becomesKeyOnlyIfNeeded = false"
echo "✅ Updated activation logic for panels"
echo ""

echo "🔍 What to Look For:"
echo "==================="
echo "In the console output, you should now see:"
echo "  - '✅ Panel can become key: true' (instead of false)"
echo "  - '✅ Panel accepts first responder: true'"
echo "  - '✅ Panel is key: true' (after activation)"
echo "  - '✅ Search bar focused successfully'"
echo ""

echo "🎬 Testing Instructions:"
echo "========================"
echo "1. Launch: cd apps/overlay-macos && swift run"
echo "2. Press ⌘⇧\" to toggle overlay"
echo "3. Try typing in search bar - should now work!"
echo "4. Type something like 'test search'"
echo "5. Watch for API calls and responses"
echo ""

echo "🎉 Success Criteria:"
echo "==================="
echo "✅ You can type in the search bar"
echo "✅ Characters appear as you type"
echo "✅ Search API receives requests"
echo "✅ No more focus timeout errors"
echo ""

echo "🚀 Ready to test! Run the overlay now:"
echo "cd apps/overlay-macos && swift run"

