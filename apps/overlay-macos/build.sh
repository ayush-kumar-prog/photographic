#!/bin/bash

# Memory Overlay Build Script
# Builds the SwiftUI overlay application using Swift Package Manager

set -e

echo "🏗️  Building Memory Overlay SwiftUI App..."

# Check if Swift is available
if ! command -v swift &> /dev/null; then
    echo "❌ Swift not found. Please install Xcode."
    exit 1
fi

# Build configuration
BUILD_CONFIG="debug"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_CONFIG="release"
            shift
            ;;
        --clean)
            echo "🧹 Cleaning build directory..."
            swift package clean
            shift
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

echo "📦 Building with configuration: $BUILD_CONFIG"

# Build the project
if [ "$BUILD_CONFIG" = "release" ]; then
    swift build -c release
    BINARY_PATH=".build/release/MemoryOverlay"
else
    swift build
    BINARY_PATH=".build/debug/MemoryOverlay"
fi

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📍 Built binary location: $BINARY_PATH"
    
    # Make it executable
    chmod +x "$BINARY_PATH"
    
    echo "🚀 You can run the app with: $BINARY_PATH"
    echo "💡 Or use: pnpm start:overlay"
else
    echo "❌ Build failed!"
    exit 1
fi
