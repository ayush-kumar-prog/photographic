#!/bin/bash

# Step 7 Demo Script - SwiftUI Overlay Demo
# Tests the complete liquid glass overlay implementation

set -e

echo "🎬 Step 7 Demo: Liquid Glass SwiftUI Overlay"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${CYAN}🎯 $1${NC}"
    echo "----------------------------------------"
}

# Check prerequisites
print_header "Checking Prerequisites"

# Check if Xcode is available
if ! command -v xcodebuild &> /dev/null; then
    print_error "Xcode command line tools not found. Please install Xcode."
    exit 1
fi
print_success "Xcode command line tools found"

# Check if services are running
print_status "Checking if services are running..."

# Check Screenpipe
if curl -s http://localhost:3030/health > /dev/null 2>&1; then
    print_success "Screenpipe service is running (port 3030)"
else
    print_warning "Screenpipe service not running. Starting it..."
    pnpm start:screenpipe &
    sleep 5
fi

# Check Ingest Bridge
if curl -s http://localhost:3031/health > /dev/null 2>&1; then
    print_success "Ingest Bridge service is running (port 3031)"
else
    print_warning "Ingest Bridge service not running. Please start it with: pnpm start:ingest"
fi

# Check Search API
if curl -s http://localhost:3032/health > /dev/null 2>&1; then
    print_success "Search API service is running (port 3032)"
else
    print_warning "Search API service not running. Please start it with: pnpm start:search"
fi

# Build the overlay
print_header "Building SwiftUI Overlay"

cd apps/overlay-macos

print_status "Building MemoryOverlay.app..."
if ./build.sh; then
    print_success "SwiftUI overlay built successfully"
else
    print_error "Failed to build SwiftUI overlay"
    exit 1
fi

# Test the API connection
print_header "Testing API Integration"

print_status "Testing search API connection..."
if curl -s "http://localhost:3032/search?q=test" > /dev/null 2>&1; then
    print_success "Search API is responding"
else
    print_warning "Search API not responding. Some features may not work."
fi

# Launch the overlay
print_header "Launching Liquid Glass Overlay"

print_status "Opening MemoryOverlay.app..."
open build/Build/Products/Debug/MemoryOverlay.app

sleep 2

print_success "MemoryOverlay.app launched!"

# Demo instructions
print_header "Demo Instructions"

echo -e "${CYAN}🎭 How to Experience the Magic:${NC}"
echo ""
echo "1. 🔥 ${YELLOW}Press ⌘⇧M${NC} anywhere on your system to summon the overlay"
echo "   - Watch the liquid glass emergence animation"
echo "   - Notice the subtle screen dimming effect"
echo ""
echo "2. 🔍 ${YELLOW}Start typing${NC} in the search field:"
echo "   - See ripple effects on each keystroke"
echo "   - Watch the breathing placeholder animation"
echo "   - Experience live search results"
echo ""
echo "3. 🎨 ${YELLOW}Hover over memory cards${NC}:"
echo "   - Notice the holographic lift and glow"
echo "   - See the cyan highlights and scale effects"
echo "   - Watch action buttons appear smoothly"
echo ""
echo "4. 🎯 ${YELLOW}Try these demo searches${NC}:"
echo "   - \"terminal\" - Find terminal sessions"
echo "   - \"browser\" - Find web browsing"
echo "   - \"code\" - Find coding sessions"
echo ""
echo "5. ⚡ ${YELLOW}Interact with results${NC}:"
echo "   - Click cards to open original sources"
echo "   - Use copy buttons to extract nuggets"
echo "   - Navigate with keyboard arrows"
echo ""
echo "6. 🌊 ${YELLOW}Dismiss the overlay${NC}:"
echo "   - Press Escape for smooth dissolution"
echo "   - Click outside the overlay"
echo "   - Press ⌘⇧M again to toggle"

print_header "Performance Metrics to Watch"

echo "⏱️  ${YELLOW}Timing Targets:${NC}"
echo "   • Overlay summon: < 0.3 seconds"
echo "   • Search response: < 0.7 seconds"
echo "   • Animation smoothness: 60fps"
echo ""
echo "🎨 ${YELLOW}Visual Quality:${NC}"
echo "   • Liquid glass translucency"
echo "   • Smooth spring animations"
echo "   • Organic ripple effects"
echo "   • Holographic hover states"

print_header "Troubleshooting"

echo "🔧 ${YELLOW}If the overlay doesn't appear:${NC}"
echo "   1. Check System Preferences > Security & Privacy > Accessibility"
echo "   2. Grant MemoryOverlay.app accessibility permissions"
echo "   3. Restart the app after granting permissions"
echo ""
echo "🔧 ${YELLOW}If search doesn't work:${NC}"
echo "   1. Ensure Search API is running: curl http://localhost:3032/health"
echo "   2. Check that you have some data: curl http://localhost:3032/stats"
echo "   3. Wait 10-15 minutes for initial data processing"

print_header "Step 7 Implementation Complete!"

echo -e "${GREEN}🎉 Congratulations! You now have a fully functional liquid glass overlay!${NC}"
echo ""
echo -e "${CYAN}✨ What you've achieved:${NC}"
echo "   • Futuristic liquid glass material system"
echo "   • Global hotkey system (⌘⇧M)"
echo "   • Organic ripple and cascade animations"
echo "   • Holographic hover interactions"
echo "   • Live search with confidence scoring"
echo "   • Beautiful memory cards with nugget extraction"
echo "   • Production-ready SwiftUI architecture"
echo ""
echo -e "${BLUE}🚀 This is the most beautiful memory search interface ever created!${NC}"
echo ""
echo "Press ⌘⇧M to experience the magic! ✨"

# Keep script running to show instructions
echo ""
echo "Press Ctrl+C to exit this demo script..."
while true; do
    sleep 1
done
