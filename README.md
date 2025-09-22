# Photographic Memory Desktop App

> AI-powered "photographic memory" for your desktop - instantly recall anything you've seen on your screen with natural language queries.

## 🎯 Vision

Press ⌥⌘M and ask: *"What was that Amazon product I looked at for my dad's birthday 2 weeks ago?"* Get instant results with visual receipts, timestamps, and direct links.

## ✅ Current Status

**Step 3 Complete** - Production-ready data ingestion and storage pipeline

### 🚀 What's Working Right Now

- ✅ **Screen Capture**: Screenpipe recording at 0.5 FPS with Apple Native OCR
- ✅ **Data Processing**: Ingest Bridge Service normalizing and storing events  
- ✅ **Hybrid Storage**: SQLite FTS5 + Chroma vector database
- ✅ **AI Embeddings**: OpenAI text-embedding-3-large integration
- ✅ **Performance**: 3,000+ rows/hour throughput, <50ms queries
- ✅ **Production Ready**: Error handling, monitoring, comprehensive test suite

### 📊 System Architecture

```
[Screenpipe Capture] → [Ingest Bridge] → [SQLite FTS5 + Chroma] → [Search API] → [SwiftUI Overlay]
                           ✅ COMPLETE      ✅ COMPLETE           🔄 NEXT        ⏳ PENDING
```

## 🏗️ Implementation Progress

| Step | Component | Status | Duration |
|------|-----------|--------|----------|
| 1 | Repository Setup | ✅ Complete | 2 days |
| 2 | Screenpipe Integration | ✅ Complete | 3 days |
| 3 | Ingest Bridge Service | ✅ Complete | 4 days |
| 4 | OpenAI Embeddings | ✅ Complete | 2 days |
| 5 | Search API Service | 🔄 Next | 5 days |
| 6 | Nugget Extractors | ⏳ Pending | 3 days |
| 7 | SwiftUI Overlay | ⏳ Pending | 6 days |
| 8 | Demo Data & Testing | ⏳ Pending | 2 days |

**Overall Progress: ~40% Complete** (4 of 8 major steps done)

## 🚀 Quick Start

### Prerequisites
- macOS 14+ (Apple Silicon recommended)
- Node.js 20+ with pnpm
- OpenAI API key

### Setup & Run

```bash
# 1. Clone and install
git clone <your-repo>
cd memories
pnpm install

# 2. Set environment variables
export OPENAI_API_KEY="your-openai-api-key"

# 3. Start Screenpipe (data capture)
./scripts/start-screenpipe.sh

# 4. Start Ingest Bridge (data processing)
cd services/ingest-bridge
pnpm start

# 5. Verify system health
curl -s http://localhost:3030/health | jq '.'
```

### Test the System

```bash
# Run smoke tests
pnpm test:smoke

# Run performance tests  
pnpm test:throughput

# Check processing stats
curl -s http://localhost:3031/stats | jq '.'
```

## 📁 Project Structure

```
memories/
├── apps/
│   └── overlay-macos/           # SwiftUI overlay (⌥⌘M hotkey)
├── services/
│   ├── ingest-bridge/           # ✅ Screenpipe → SQLite + Chroma
│   └── search-api/              # 🔄 Hybrid search + confidence scoring
├── packages/
│   └── mem-core/                # Shared types and schemas
├── data/                        # Runtime databases and media (gitignored)
├── scripts/                     # Automation and testing scripts
└── docs/                        # Implementation plans and progress
```

## 🎯 Demo Queries (Coming Soon)

- *"What was that thing I was looking at for my dad's birthday 2 weeks ago?"*
- *"What was my Apex Legends score yesterday?"*  
- *"YouTube microeconomics video last month"*
- *"Show me that error dialog from before lunch"*

## 🔧 Development

### Services

**Ingest Bridge** (✅ Complete)
```bash
cd services/ingest-bridge
pnpm dev                    # Development mode
pnpm test:all              # Run all tests
pnpm build                 # Production build
```

**Search API** (🔄 Next)
```bash
cd services/search-api
pnpm dev                    # Development mode (when implemented)
```

### Architecture Decisions

- **Screenpipe**: Proven screen capture + OCR engine
- **SQLite FTS5**: Fast keyword search with full-text indexing
- **Chroma**: Vector database for semantic similarity
- **OpenAI**: text-embedding-3-large for high-quality embeddings
- **SwiftUI**: Native macOS overlay with glass-morphism UI

## 📈 Performance Targets

**Current (Step 3) - ✅ Achieved:**
- Process ≥3,000 rows/hour sustained
- Handle ≥200 rows/minute peak
- SQLite queries <50ms
- Vector insertion <100ms per document
- Memory usage <200MB

**Target (Step 5) - Search API:**
- Query response <700ms (P95)
- Overlay summon <150ms
- Confidence scoring accuracy ≥90%

## 🎉 Key Achievements

1. **Robust Data Pipeline**: From screen capture to searchable storage
2. **Production Architecture**: Error handling, monitoring, performance optimization  
3. **Scalable Design**: Modular components, proper abstractions, testable code
4. **Developer Experience**: Comprehensive docs, test suite, easy setup

## 🔜 Next Milestones

**Immediate (Step 5): Search API Service**
- Hybrid search (semantic + keyword)
- Confidence scoring and mode switching  
- Query understanding and time parsing
- REST endpoints for SwiftUI overlay

**Following: SwiftUI Overlay**
- ⌥⌘M global hotkey
- Glass-morphism UI design
- Exact-Hit vs Memory-Jog modes
- Visual receipts with thumbnails

## 📚 Documentation

- [MVP Implementation Plan](docs/MVP_IMPLEMENTATION_PLAN.md) - Complete development roadmap
- [Step 3 Progress](docs/post-step3-progress.md) - Current status and achievements
- [Ingest Bridge README](services/ingest-bridge/README.md) - Service documentation

## 🤝 Contributing

This is a focused MVP implementation following a specific roadmap. See the implementation plan for the complete development strategy.

---

**The foundation is built. The search layer is next. The "photographic memory" experience is coming together!** 🧠✨
