# Photographic Memory - AI Desktop Memory System

> **Gives users "photographic memory" of their desktop through AI-powered screen capture, OCR, and semantic search.**

A macOS-first MVP that continuously captures screen activity, converts moments into searchable memories, and retrieves them instantly via a translucent overlay interface.

## 🎯 Project Status

**Current Phase:** Repository restructuring and monorepo setup  
**Target:** 90-second wow demo with glass-morphism overlay + fast semantic recall

## 🏗️ Architecture Overview

```
[Screenpipe Capture] → [Ingest Bridge] → [SQLite + Chroma] → [Search API] → [SwiftUI Overlay]
```

**Hybrid Approach:**
- **Screenpipe**: Always-on capture + OCR engine (vendor dependency)
- **Our Services**: Search intelligence and UX innovation
- **ReMind Patterns**: Database schemas and processing workflows (reference only)

## 📁 Monorepo Structure

```
memories/
├── apps/
│   └── overlay-macos/           # SwiftUI NSPanel overlay (hotkey + glass UI)
├── services/
│   ├── ingest-bridge/           # Node/TS: Screenpipe → SQLite+Chroma vectors  
│   └── search-api/              # Node/TS: Hybrid retrieval + RAG endpoints
├── packages/
│   └── mem-core/                # Shared types/schemas/adapters
├── vendor/
│   ├── screenpipe/              # Submodule/binary (DO NOT MODIFY)
│   └── remind/                  # Reference only (NOT SHIPPED)
├── data/                        # SQLite, Chroma, thumbnails, media
├── scripts/                     # start-all, smoke tests, demo verifiers
└── docs/                        # Documentation
```

## 🚀 Quick Start

### Prerequisites
- macOS 14+ (Apple Silicon recommended)
- Node.js 20+ with pnpm
- Xcode 15+ (for SwiftUI overlay)
- OpenAI API key

### Setup
```bash
# Clone and install dependencies
git clone <this-repo>
cd memories
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Install dependencies
pnpm install

# Start all services (when implemented)
pnpm run start:all
```

### Development Commands
```bash
pnpm run dev:all           # Start all services in development mode
pnpm run build:all         # Build all services
pnpm run test:smoke        # Run smoke tests
pnpm run demo:verify       # Verify demo queries work
```

## 🎯 User Flows

### 1. Time-Anchored Recall
```
User: "What was that thing I was looking at for my dad's birthday 2 weeks ago?"
↓
⌥⌘M → Glass overlay → Voice/text query
↓
Hybrid search (semantic + keyword + time filters)
↓
Result: Amazon product with price, thumbnail, "Open" action
```

### 2. Game Score Recall  
```
User: "What was my Apex Legends high score yesterday?"
↓
Same overlay process
↓
App-specific search + nugget extraction
↓
Result: Scoreboard screenshot with highlighted score
```

### 3. Content Recall
```
User: "YouTube microeconomics video last month"
↓ 
Same overlay process
↓
Site-specific search + title extraction  
↓
Result: Video title/channel + deep-link action
```

## 📊 Success Metrics (MVP Targets)

### Performance
- **Overlay Summon:** <150ms consistently
- **Search Latency:** P95 <700ms, cold start <1.5s
- **Accuracy:** Top-1 hit rate ≥80%, Top-3 ≥90%
- **Resource Usage:** CPU ≤15% bursts, RAM ≤500MB steady

### Demo Success
- **Query Success:** 3/3 demo queries hit Top-3 relevant results
- **UI Polish:** Glass effects, no visual glitches
- **Reliability:** Zero crashes during 90s demo

## 🔧 Service Details

### Ingest Bridge Service
**Purpose:** Normalize Screenpipe events → hybrid database  
**Technology:** Node/TypeScript + SQLite + Chroma  
**Key Features:**
- Poll Screenpipe SDK every 3-5s
- Generate OpenAI embeddings
- Dedupe and sessionize events
- Thumbnail generation

### Search API Service  
**Purpose:** Hybrid retrieval + confidence scoring  
**Technology:** Fastify + SQLite FTS5 + ChromaDB  
**Key Features:**
- `/search` endpoint with mode switching
- Time parsing ("2 weeks ago" → date ranges) 
- Nugget extractors (prices, scores, titles)
- Optional `/answer` RAG endpoint

### SwiftUI Overlay App
**Purpose:** Glass-morphism native macOS interface  
**Technology:** SwiftUI + NSPanel + NSVisualEffectView  
**Key Features:**
- Global hotkey (⌥⌘M) handling
- Voice/text input with mic orb
- Exact-Hit vs Memory-Jog UI modes
- Refinement chips for instant re-querying

## 🏗️ Implementation Status

See [MVP_IMPLEMENTATION_PLAN.md](./MVP_IMPLEMENTATION_PLAN.md) for detailed step-by-step implementation guide.

**Phase 1: Foundation (In Progress)**
- [x] Repository restructuring  
- [x] Monorepo configuration
- [ ] Screenpipe integration
- [ ] Basic ingest pipeline

**Phase 2: Core Services (Planned)**
- [ ] Hybrid search implementation
- [ ] OpenAI embeddings integration
- [ ] SwiftUI overlay development

**Phase 3: Demo Preparation (Planned)**
- [ ] Nugget extractors
- [ ] Performance optimization
- [ ] Demo data seeding
- [ ] 90-second demo script

## 🔒 Privacy & Control

- **Pause/Resume:** Menu bar toggle stops capture immediately
- **Retention Policy:** Configurable data retention (30-90 days)
- **Local Processing:** OCR and basic processing on-device
- **Transparent UI:** Always shows capture status

## 🚨 Known Limitations (MVP)

- macOS only (Windows planned for v2)
- English OCR primarily (multilingual in v2)
- Requires internet for embeddings/LLM
- Audio transcription not included in MVP
- Limited app-specific extractors

## 📖 Documentation

- [MVP Implementation Plan](./MVP_IMPLEMENTATION_PLAN.md) - Detailed step-by-step guide
- [Architecture Specs](./1MPhotographicMemory_MVP_Spec_1M.md) - Complete technical specification
- [Original Spec](./PhotographicMemory_MVP_Spec.md) - Initial design document

## 🤝 Development Workflow

1. Follow the implementation plan step-by-step
2. Each service has its own test suite and smoke tests
3. Use the scripts directory for automation and validation
4. SwiftUI overlay developed separately in Xcode
5. Integration testing via demo verification scripts

## 📞 Support

For questions about implementation or architecture, refer to the detailed specs in the docs/ directory or the comprehensive implementation plan.
