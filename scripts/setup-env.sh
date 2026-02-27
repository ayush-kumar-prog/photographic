git #!/bin/bash

# Environment Setup Script for Photographic Memory
echo "🔧 Setting up environment for Photographic Memory"
echo "================================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# OpenAI API Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Memory System Configuration
MEM_RETENTION_DAYS=60
SEARCH_K=6
CONFIDENCE_T_HIGH=0.78

# Service Ports
SCREENPIPE_PORT=3030
INGEST_BRIDGE_PORT=3031
SEARCH_API_PORT=3032
EOF
    echo "✅ Created .env file with default configuration"
else
    echo "✅ .env file already exists"
fi

# Check if OpenAI API key is set
if grep -q "your-openai-api-key-here" .env 2>/dev/null; then
    echo ""
    echo "⚠️  IMPORTANT: You need to set your OpenAI API key!"
    echo "   1. Get your API key from: https://platform.openai.com/api-keys"
    echo "   2. Edit .env file and replace 'your-openai-api-key-here' with your actual key"
    echo "   3. Or run: export OPENAI_API_KEY='your-actual-key'"
    echo ""
    echo "💡 For testing without OpenAI, the search API can work with local data only"
else
    echo "✅ OpenAI API key appears to be configured"
fi

# Load environment variables
if [ -f ".env" ]; then
    echo "🔄 Loading environment variables..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
fi

# Check if API key is now available
if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your-openai-api-key-here" ]; then
    echo "✅ OpenAI API key is set and ready"
else
    echo "⚠️  OpenAI API key still needs to be configured"
fi

echo ""
echo "🚀 Next steps:"
echo "   1. Set your OpenAI API key (if not done)"
echo "   2. Run: source .env"
echo "   3. Start services: pnpm start:all"
echo "   4. Test the overlay: cd apps/overlay-macos && swift run"

