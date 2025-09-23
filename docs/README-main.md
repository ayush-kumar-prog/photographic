# Photographic Memory Desktop App

> AI-powered "photographic memory" for your desktop - instantly recall anything you've seen on your screen with natural language queries.

## 🎯 Vision

Transform your computer into a searchable memory system. Press ⌥⌘M and ask natural language questions like:
- *"What was that Amazon product I looked at for my dad's birthday 2 weeks ago?"*
- *"Show me that error dialog from before lunch"*
- *"What was my Apex Legends score yesterday?"*

Get instant results with visual receipts, timestamps, and direct links to the original content.

## 🏗️ System Architecture Overview

This is a **multi-service desktop application** that captures, processes, and searches your screen activity using AI:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│   Screenpipe    │───▶│  Ingest Bridge   │───▶│  Hybrid Storage     │───▶│   Search API     │
│                 │    │                  │    │                     │    │                  │
│ • Screen Capture│    │ • Event Polling  │    │ • SQLite FTS5       │    │ • Hybrid Search  │
│ • OCR Processing│    │ • Data Transform │    │ • Chroma Vectors    │    │ • Query Parsing  │
│ • API Server    │    │ • Thumbnails     │    │ • OpenAI Embeddings │    │ • Confidence     │
│ • 0.5 FPS       │    │ • Error Handling │    │ • Performance Opts  │    │ • REST Endpoints │
└─────────────────┘    └──────────────────┘    └─────────────────────┘    └──────────────────┘
       ✅                        ✅                        ✅                        🔄 NEXT

                                                    ┌──────────────────┐
                                                    │  SwiftUI Overlay │
                                                    │                  │
                                                    │ • ⌥⌘M Hotkey     │
                                                    │ • Glass UI       │
                                                    │ • Visual Results │
                                                    │ • macOS Native   │
                                                    └──────────────────┘
                                                           ⏳ PENDING
```

## ✅ Current Status: Steps 1-4 Complete (50% Done)

**Production-ready data ingestion and storage pipeline fully operational**

### 🚀 What's Working Right Now

- ✅ **Screen Capture**: Screenpipe recording at 0.5 FPS with Apple Native OCR
- ✅ **Data Processing**: Ingest Bridge Service normalizing and storing events  
- ✅ **Hybrid Storage**: SQLite FTS5 + Chroma vector database
- ✅ **AI Embeddings**: OpenAI text-embedding-3-large integration (3072 dimensions)
- ✅ **Thumbnail Generation**: Sharp-based image processing for visual search
- ✅ **Performance**: 3,000+ rows/hour throughput, <20ms queries
- ✅ **Production Ready**: Error handling, monitoring, comprehensive test suite

### 🧠 Data Flow Explained

1. **Screenpipe** captures your screen at 0.5 FPS and extracts text via OCR
2. **Ingest Bridge** polls for new events, transforms them into canonical `MemoryObject` schema
3. **Hybrid Storage** saves data in both SQLite (fast keyword search) and Chroma (semantic similarity)
4. **OpenAI Integration** generates embeddings for each text snippet for AI-powered search
5. **Search API** (next step) will provide REST endpoints for querying this data
6. **SwiftUI Overlay** (future) will provide the ⌥⌘M hotkey interface

## 🏗️ Implementation Progress

**See [docs/README.md](README.md) for current status and [MVP_IMPLEMENTATION_PLAN.md](MVP_IMPLEMENTATION_PLAN.md) for complete roadmap.**

**Current Status: 50% Complete** (Steps 1-4 done, Step 5 next)

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

**All documentation is organized in the [`docs/`](.) folder:**
- [MVP Implementation Plan](MVP_IMPLEMENTATION_PLAN.md) - Complete development roadmap
- [Post-Step 3 Progress](post-step3-progress.md) - Current achievements and verification
- [Ingest Bridge Service](ingest-bridge-service.md) - Data processing pipeline
- [Documentation Index](README.md) - Complete documentation overview

## 🔍 Technical Deep Dive

### Data Schema: MemoryObject
Every screen capture becomes a searchable `MemoryObject`:

```typescript
interface MemoryObject {
  id: string;                    // UUID for each capture
  ts: number;                    // Epoch milliseconds timestamp
  session_id?: string | null;    // Optional session clustering
  app: string;                   // "Safari", "Cursor", "Apex Legends"
  window_title?: string | null;  // Window title from macOS
  url?: string | null;           // For web content
  url_host?: string | null;      // "amazon.com", "youtube.com"
  media_path?: string | null;    // Path to original screenshot
  thumb_path?: string | null;    // Generated thumbnail path
  ocr_text: string;              // Extracted text content (searchable)
  asr_text?: string | null;      // Audio transcript (future feature)
  entities?: string[];           // Extracted entities (people, places, etc.)
  topics?: string[];             // Topic classification
}
```

### Storage Strategy: Hybrid Approach
- **SQLite FTS5**: Lightning-fast keyword search with full-text indexing
- **ChromaDB**: Vector similarity search using OpenAI embeddings
- **Smart Routing**: Keyword queries → SQLite, semantic queries → ChromaDB

### AI Integration: OpenAI Embeddings
- Model: `text-embedding-3-large` (3072 dimensions)
- Batch processing: 100 items per API call
- Rate limiting: 10 requests/second, 3 concurrent
- Cost optimization: ~$0.13 per 1M tokens

## 🤝 Contributing

This is a focused MVP implementation following a specific roadmap. See the implementation plan for the complete development strategy.

---

**The foundation is built. The search layer is next. The "photographic memory" experience is coming together!** 🧠✨
