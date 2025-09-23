# Photographic Memory - Documentation Index

> Complete documentation for the AI-powered desktop memory system

## 📋 Documentation Structure

This folder contains all project documentation organized by purpose and audience:

### 🎯 **Getting Started**
- [**README-main.md**](README-main.md) - Complete system overview, architecture, and setup guide
- [**Quick Start Guide**](#quick-start) - Essential setup steps (see below)

### 📋 **Planning & Specifications**
- [**MVP_IMPLEMENTATION_PLAN.md**](MVP_IMPLEMENTATION_PLAN.md) - Complete development roadmap with technical specifications
- [**PhotographicMemory_MVP_Spec.md**](PhotographicMemory_MVP_Spec.md) - Original MVP specification
- [**1MPhotographicMemory_MVP_Spec_1M.md**](1MPhotographicMemory_MVP_Spec_1M.md) - Extended specification

### 📈 **Progress Reports**
- [**post-step3-progress.md**](post-step3-progress.md) - Current status: Steps 1-4 complete (50% done)
- [**post-step2-progress.md**](post-step2-progress.md) - Historical progress report

### 🔧 **Technical Documentation**
- [**ingest-bridge-service.md**](ingest-bridge-service.md) - Data processing pipeline (Step 3)
- [**search-api-service.md**](search-api-service.md) - Hybrid search engine (Step 5 - coming next)

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <repo> && cd memories
pnpm install

# 2. Environment
export OPENAI_API_KEY="your-openai-api-key"

# 3. Start services
pnpm start:screenpipe    # Screen capture (Screenpipe)
pnpm start:ingest        # Data processing (Ingest Bridge)

# 4. Verify system
pnpm test:core           # Core functionality test
pnpm test:components     # All component tests
```

## 🏗️ System Architecture

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

## 📊 Current Status

| Step | Component | Status | Documentation |
|------|-----------|--------|---------------|
| 1 | Repository Setup | ✅ Complete | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-1) |
| 2 | Screenpipe Integration | ✅ Complete | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-2) |
| 3 | Ingest Bridge Service | ✅ Complete | [Service Docs](ingest-bridge-service.md) |
| 4 | OpenAI Embeddings | ✅ Complete | [Service Docs](ingest-bridge-service.md#embeddings-service) |
| 5 | Search API Service | 🔄 **NEXT** | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-5) |
| 6 | Nugget Extractors | ⏳ Pending | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-6) |
| 7 | SwiftUI Overlay | ⏳ Pending | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-7) |
| 8 | Demo & Testing | ⏳ Pending | [Implementation Plan](MVP_IMPLEMENTATION_PLAN.md#step-8) |

**Overall Progress: 50% Complete** (Steps 1-4 done)

## 🎯 What's Working Now

- ✅ **Screen Capture**: Screenpipe at 0.5 FPS with Apple Native OCR
- ✅ **Data Processing**: Ingest Bridge transforming and storing events
- ✅ **Hybrid Storage**: SQLite FTS5 + ChromaDB vector database
- ✅ **AI Embeddings**: OpenAI text-embedding-3-large (3072 dimensions)
- ✅ **Thumbnails**: Sharp-based image processing
- ✅ **Performance**: 3,000+ rows/hour, <20ms queries
- ✅ **Production Ready**: Error handling, monitoring, test suite

## 🔜 Next: Step 5 - Search API Service

The next milestone will deliver:
- **Hybrid Search Engine**: Keyword (SQLite) + semantic (ChromaDB)
- **Query Understanding**: Time parsing, app filtering
- **Confidence Scoring**: Exact-hit vs memory-jog modes
- **REST API**: Production endpoints for SwiftUI overlay

## 🧠 Key Technical Concepts

### Data Schema: MemoryObject
Every screen capture becomes a searchable memory:
```typescript
interface MemoryObject {
  id: string;           // UUID
  ts: number;           // Timestamp
  app: string;          // "Safari", "Cursor"
  ocr_text: string;     // Extracted text
  // ... 8 more fields
}
```

### Storage Strategy
- **SQLite FTS5**: Fast keyword search
- **ChromaDB**: Semantic similarity via OpenAI embeddings
- **Smart Routing**: Query type determines search method

### Performance Targets
- **Current**: 3,000+ rows/hour, <20ms queries ✅
- **Target**: <700ms search response, <150ms overlay summon

---

**For detailed information on any component, see the specific documentation files above.**