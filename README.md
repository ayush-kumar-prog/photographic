# Photographic Memory Desktop App

> AI-powered "photographic memory" for your desktop - instantly recall anything you've seen on your screen with natural language queries.

## 🎯 Quick Overview

Transform your computer into a searchable memory system. Press ⌥⌘M and ask:
- *"What was that Amazon product I looked at for my dad's birthday 2 weeks ago?"*
- *"Show me that error dialog from before lunch"*
- *"What was my Apex Legends score yesterday?"*

Get instant results with visual receipts, timestamps, and direct links.

## ✅ Current Status: 50% Complete

**Steps 1-4 Complete** - Production-ready data pipeline operational

```
[Screenpipe] → [Ingest Bridge] → [SQLite + Chroma] → [Search API] → [SwiftUI]
     ✅              ✅               ✅              🔄 NEXT       ⏳ PENDING
```

## 🚀 Quick Start

```bash
# 1. Setup
git clone <repo> && cd memories && pnpm install

# 2. Set OpenAI API key
export OPENAI_API_KEY="your-key"

# 3. Start services
pnpm start:screenpipe    # Screen capture
pnpm start:ingest        # Data processing

# 4. Verify system
pnpm test:core
```

## 📚 Documentation

**Complete documentation is in the [`docs/`](docs/) folder:**

| Document | Purpose |
|----------|---------|
| [**Main Documentation**](docs/README-main.md) | Complete system overview, architecture, and setup |
| [**Implementation Plan**](docs/MVP_IMPLEMENTATION_PLAN.md) | Full development roadmap with technical specs |
| [**Current Progress**](docs/post-step3-progress.md) | Detailed achievements and verification results |
| [**Ingest Bridge Service**](docs/ingest-bridge-service.md) | Data processing pipeline documentation |

## 🏗️ Architecture

**Multi-service desktop application** that captures, processes, and searches screen activity:

1. **Screenpipe** - Screen capture + OCR (0.5 FPS)
2. **Ingest Bridge** - Data transformation + storage
3. **Hybrid Storage** - SQLite FTS5 + ChromaDB vectors  
4. **Search API** - REST endpoints (Step 5 - next)
5. **SwiftUI Overlay** - ⌥⌘M hotkey interface (future)

## 🎯 Next Milestone: Step 5

**Search API Service** will deliver:
- Hybrid search (keyword + semantic)
- Query understanding and confidence scoring
- REST endpoints for SwiftUI overlay
- Production-ready search experience

---

**📖 For complete details, see [docs/README-main.md](docs/README-main.md)**