# Photographic Memory MVP Implementation Plan
## LLM-Optimized Step-by-Step Development Guide

> **Purpose:** This document provides a complete, measurable implementation roadmap for building the Photographic Memory Desktop App MVP. Each step includes clear success criteria, technical specifications, and validation methods. Follow this sequentially for optimal results.

---

## 🎯 MVP Success Definition

**Demo Objective:** 90-second demo showcasing:
1. Instant overlay summon (⌥⌘M) → glass-morphism UI
2. 3 successful queries with <700ms response time
3. Exact-Hit and Memory-Jog modes working flawlessly
4. Visual receipts (thumbnails + metadata) for all results

**Technical Targets:**
- **Accuracy:** Top-1 hit rate ≥80% on clear queries; Top-3 ≥90% in Memory-Jog
- **Performance:** Query response <700ms (cold <1.5s); overlay summon <150ms
- **Stability:** 24/7 operation; CPU idle ≤10-15%; RAM steady ≤500MB

---

## 📋 Pre-Implementation Checklist

### Environment Requirements
- [ ] macOS 14+ (Apple Silicon recommended)
- [ ] Xcode 15+ (for SwiftUI overlay)
- [ ] Node.js 20+ with pnpm
- [ ] Python 3.11+ (for services)
- [ ] OpenAI API key with credits
- [ ] 16GB+ RAM, 100GB+ free disk space

### Repository Structure (Target)
```
memories/
├── apps/
│   └── overlay-macos/           # SwiftUI NSPanel overlay
├── services/
│   ├── ingest-bridge/           # Node/TS: Screenpipe → SQLite+Chroma
│   └── search-api/              # Node/TS: Hybrid retrieval + RAG
├── packages/
│   └── mem-core/                # Shared types/schemas
├── vendor/
│   ├── screenpipe/              # Submodule/binary (DO NOT MODIFY)
│   └── remind/                  # Reference only (NOT SHIPPED)
├── data/
│   ├── sqlite/                  # FTS5 database
│   ├── chroma/                  # Vector database
│   ├── thumbs/                  # Cached thumbnails
│   └── media/                   # Screenshots/frames
├── scripts/                     # Automation and testing
├── docs/                        # Documentation
└── .env.example                 # Environment template
```

---

## 🚀 Implementation Steps

### Step 1: Repository Setup & Bootstrap
**Duration:** 2 days  
**Priority:** CRITICAL  
**Dependencies:** None

#### Objectives
- Create monorepo structure
- Setup package management and scripts
- Configure development environment
- Establish build and test automation

#### Technical Tasks
1. **Monorepo Structure Creation**
   ```bash
   # Create directory structure
   mkdir -p apps/overlay-macos
   mkdir -p services/{ingest-bridge,search-api}
   mkdir -p packages/mem-core
   mkdir -p vendor/{screenpipe,remind}
   mkdir -p data/{sqlite,chroma,thumbs,media}
   mkdir -p scripts docs
   ```

2. **Package Management Setup**
   - Root `package.json` with workspaces
   - Individual service `package.json` files
   - Shared dependency management
   - TypeScript configuration

3. **Development Scripts**
   ```json
   {
     "scripts": {
       "start:all": "concurrently \"pnpm -C services/ingest-bridge start\" \"pnpm -C services/search-api start\"",
       "build:all": "pnpm -r build",
       "test:smoke": "pnpm -C scripts smoke-test",
       "demo:verify": "pnpm -C scripts demo-verify"
     }
   }
   ```

#### Success Criteria
- [ ] `pnpm run start:all` executes without errors
- [ ] All service directories have proper `package.json`
- [ ] TypeScript compiles across all services
- [ ] Git hooks for linting and testing work
- [ ] Environment variables load correctly

#### Validation Method
```bash
pnpm run start:all  # Should start all services
pnpm run build:all  # Should compile successfully
pnpm run test:smoke # Should pass initial checks
```

---

### Step 2: Screenpipe Integration & Capture
**Duration:** 3 days  
**Priority:** CRITICAL  
**Dependencies:** Step 1

#### Objectives
- Install and configure Screenpipe
- Verify screen capture and OCR functionality
- Establish data pipeline connection
- Grant necessary macOS permissions

#### Technical Tasks
1. **Screenpipe Installation**
   ```bashd
   # Download and install Screenpipe
   # Add to vendor/screenpipe as submodule or binary
   git submodule add https://github.com/mediar-ai/screenpipe vendor/screenpipe
   ```

2. **Permission Setup**
   - Screen Recording permission
   - Accessibility permission
   - Microphone permission (if audio enabled)
   - File system access for data directory

3. **SDK Integration**
   ```typescript
   // services/ingest-bridge/src/screenpipe-client.ts
   interface ScreenpipeEvent {
     id: string;
     timestamp: number;
     app: string;
     window_title: string;
     url?: string;
     ocr_text: string;
     media_path: string;
   }
   ```

4. **Data Validation Pipeline**
   - Event polling every 3-5 seconds
   - OCR text quality validation
   - Media file integrity checks

#### Success Criteria
- [ ] Screenpipe captures ≥100 OCR events in 10 minutes of use
- [ ] OCR text quality ≥90% readable for standard UI text
- [ ] App metadata (name, window title) extracted correctly
- [ ] URL extraction working for Safari/Chrome
- [ ] Screenshots saved and accessible via file paths

#### Measurement Methods
```bash
# Smoke test script
pnpm -C scripts test:screenpipe-capture
# Expected: ≥100 events in 10min, <5% failed OCR
```

---

### Step 3: Ingest Bridge Service
**Duration:** 4 days  
**Priority:** CRITICAL  
**Dependencies:** Step 2

#### Objectives
- Build Node/TS service to normalize Screenpipe data
- Implement SQLite FTS5 database
- Add Chroma vector database integration
- Create MemoryObject canonical schema

#### Technical Tasks
1. **Service Architecture**
   ```typescript
   // services/ingest-bridge/src/types.ts
   interface MemoryObject {
     id: string;
     ts: number;
     session_id?: string;
     app: string;
     window_title?: string;
     url?: string;
     url_host?: string;
     media_path?: string;
     thumb_path?: string;
     ocr_text: string;
     asr_text?: string | null;
     entities?: string[];
     topics?: string[];
   }
   ```

2. **SQLite FTS5 Setup**
   ```sql
   CREATE TABLE memories (
     id TEXT PRIMARY KEY,
     ts INTEGER,
     app TEXT,
     url_host TEXT,
     window_title TEXT,
     ocr_text TEXT,
     media_path TEXT,
     thumb_path TEXT
   );
   
   CREATE VIRTUAL TABLE memories_fts USING fts5(
     ocr_text, window_title, content='memories'
   );
   ```

3. **Chroma Integration**
   ```typescript
   // Vector storage for semantic search
   const chroma = new ChromaClient();
   const collection = await chroma.createCollection({
     name: "mem_text",
     metadata: {"hnsw:space": "cosine"}
   });
   ```

4. **Thumbnail Generation**
   - Resize screenshots to 300x200 thumbnails
   - Cache in `data/thumbs/` directory
   - Optimize for fast overlay loading

#### Success Criteria
- [ ] Process ≥3,000 rows/hour sustained throughput
- [ ] Handle ≥200 rows/minute peak processing
- [ ] SQLite FTS5 index responds to queries <50ms
- [ ] Chroma vector insertion completes <100ms per document
- [ ] Thumbnail generation <200ms per image
- [ ] Memory usage stable under 200MB for service

#### Validation Method
```bash
pnpm -C services/ingest-bridge test:throughput
# Expected: 3k rows/hour, <5% processing failures
```

---

### Step 4: OpenAI Embeddings Integration
**Duration:** 2 days  
**Priority:** HIGH  
**Dependencies:** Step 3

#### Objectives
- Integrate OpenAI `text-embedding-3-large` API
- Implement batch processing for efficiency
- Add retry logic and error handling
- Optimize for cost and performance

#### Technical Tasks
1. **OpenAI Client Setup**
   ```typescript
   import OpenAI from 'openai';
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   
   async function generateEmbeddings(texts: string[]) {
     const response = await openai.embeddings.create({
       model: 'text-embedding-3-large',
       input: texts,
       encoding_format: 'float',
     });
     return response.data.map(item => item.embedding);
   }
   ```

2. **Batch Processing**
   - Process up to 100 texts per API call
   - Implement queue with backpressure
   - Rate limiting (3000 RPM for tier 1)

3. **Error Handling & Retries**
   - Exponential backoff for rate limits
   - Graceful degradation on API failures
   - Local embedding fallback (optional)

4. **Cost Optimization**
   - Text preprocessing (truncate, clean)
   - Duplicate detection
   - Configurable model selection

#### Success Criteria
- [ ] Batch process 1,000 rows in <30 seconds
- [ ] API failure rate <0.5% with retries
- [ ] Cost per 1M tokens ≤$0.13 (text-embedding-3-large)
- [ ] Queue never blocks ingest pipeline
- [ ] Embedding dimensions consistent (3072 for large model)

#### Validation Method
```bash
pnpm -C services/ingest-bridge test:embeddings
# Expected: 1k embeddings <30s, <0.5% failures
```

---

### Step 5: Search API Service
**Duration:** 5 days  
**Priority:** CRITICAL  
**Dependencies:** Step 4

#### Objectives
- Build hybrid search with confidence scoring
- Implement query understanding and time parsing
- Create `/search` endpoint with mode switching
- Add optional `/answer` RAG endpoint

#### Technical Tasks
1. **Search Service Architecture**
   ```typescript
   // services/search-api/src/search.ts
   interface SearchRequest {
     q: string;
     from?: string;
     to?: string;
     app?: string;
     host?: string;
     k?: number;
   }
   
   interface SearchResponse {
     mode: 'exact' | 'jog';
     confidence: number;
     cards: SearchCard[];
   }
   ```

2. **Hybrid Retrieval Implementation**
   ```typescript
   function hybridSearch(query: ParsedQuery): SearchResult[] {
     const semanticResults = await vectorSearch(query.embedding);
     const keywordResults = await ftsSearch(query.text);
     const filteredResults = applyFilters(semanticResults, keywordResults, query.filters);
     return rankResults(filteredResults, query);
   }
   ```

3. **Confidence Scoring**
   ```typescript
   function calculateConfidence(result: SearchResult, query: ParsedQuery): number {
     return (
       WEIGHT_SEMANTIC * result.semanticScore +
       WEIGHT_KEYWORD * result.ftsScore +
       WEIGHT_TIME * result.timeDecay +
       WEIGHT_APP * result.appBonus +
       WEIGHT_SOURCE * result.sourceReliability
     );
   }
   ```

4. **Query Understanding**
   - Time parsing: "2 weeks ago" → date range
   - App extraction: "Safari", "YouTube" → filters
   - Intent recognition: "price", "score", "title" → field hints

5. **Mode Switching Logic**
   ```typescript
   const mode = confidence >= CONFIDENCE_THRESHOLD_HIGH ? 'exact' : 'jog';
   const cardCount = mode === 'exact' ? 3 : 6;
   ```

#### Success Criteria
- [ ] P95 latency <700ms (cold start <1.5s)
- [ ] 3 demo queries achieve Top-3 hit rate 100%
- [ ] Confidence scoring accurately separates exact vs jog modes
- [ ] Time parsing handles relative dates correctly
- [ ] App/URL filtering reduces result set appropriately
- [ ] Service handles 100 concurrent requests

#### Validation Method
```bash
pnpm -C services/search-api test:search-performance
# Expected: P95 <700ms, demo queries 3/3 success
```

---

### Step 6: Nugget Extractors
**Duration:** 3 days  
**Priority:** MEDIUM  
**Dependencies:** Step 5

#### Objectives
- Implement domain-specific text extraction
- Support YouTube titles, Amazon prices, game scores
- Provide confidence scores for extractions
- Handle OCR noise and variations

#### Technical Tasks
1. **YouTube Title Extractor**
   ```typescript
   function extractYouTubeTitle(ocrText: string): NuggetResult {
     const patterns = [
       /(.+?)\s*-\s*YouTube/,
       /(.+?)\s*•\s*\d+[KMB]?\s*views/,
       /Watch\s*"([^"]+)"/,
     ];
     
     for (const pattern of patterns) {
       const match = ocrText.match(pattern);
       if (match) {
         return {
           type: 'title',
           value: match[1].trim(),
           confidence: 0.9
         };
       }
     }
     return null;
   }
   ```

2. **Amazon Price Extractor**
   ```typescript
   function extractPrice(ocrText: string): NuggetResult {
     const pricePattern = /(\$|£|€)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
     const matches = Array.from(ocrText.matchAll(pricePattern));
     
     if (matches.length > 0) {
       const highestPrice = matches.reduce((max, current) => 
         parseFloat(current[2].replace(',', '')) > parseFloat(max[2].replace(',', '')) 
           ? current : max
       );
       
       return {
         type: 'price',
         value: highestPrice[1] + highestPrice[2],
         confidence: 0.85
       };
     }
     return null;
   }
   ```

3. **Game Score Extractor**
   ```typescript
   function extractGameScore(ocrText: string): NuggetResult {
     const scorePatterns = [
       /(?:SCORE|KILLS|POINTS|XP)[:\s]*(\d+)/i,
       /(\d+)\s*(?:KILLS|POINTS|XP)/i,
       /RANKED[:\s]*(\d+)/i,
     ];
     
     for (const pattern of scorePatterns) {
       const match = ocrText.match(pattern);
       if (match) {
         return {
           type: 'score',
           value: match[1],
           confidence: 0.8
         };
       }
     }
     return null;
   }
   ```

4. **Fallback Strategy**
   - Extract top 3 OCR lines if no nuggets found
   - Use LLM for complex extractions (optional)
   - Highlight relevant text in search cards

#### Success Criteria
- [ ] YouTube title extraction ≥80% success on test fixtures
- [ ] Amazon price extraction ≥80% accuracy
- [ ] Game score extraction ≥70% success (varies by game UI)
- [ ] Nugget confidence scores calibrated correctly
- [ ] Processing time <50ms per card
- [ ] Handles OCR noise gracefully

#### Validation Method
```bash
pnpm -C services/search-api test:nugget-extractors
# Expected: 80%+ success rate on fixture dataset
```

---

### Step 7: SwiftUI Overlay Application
**Duration:** 6 days  
**Priority:** CRITICAL  
**Dependencies:** Step 5

#### Objectives
- Build native macOS overlay with glass-morphism
- Implement global hotkey handling
- Create card-based result display
- Add refinement chips and user interactions

#### Technical Tasks
1. **Xcode Project Setup**
   ```swift
   // apps/overlay-macos/PhotographicMemory/
   import SwiftUI
   import Combine
   import KeyboardShortcuts
   
   @main
   struct PhotographicMemoryApp: App {
       var body: some Scene {
           MenuBarExtra("Photographic Memory", systemImage: "brain.head.profile") {
               ContentView()
           }
           .menuBarExtraStyle(.window)
       }
   }
   ```

2. **Global Hotkey Implementation**
   ```swift
   extension KeyboardShortcuts.Name {
       static let toggleOverlay = Self("toggleOverlay", default: .init(.m, modifiers: [.option, .command]))
   }
   
   class HotkeyManager: ObservableObject {
       init() {
           KeyboardShortcuts.onKeyUp(for: .toggleOverlay) { [weak self] in
               self?.toggleOverlay()
           }
       }
   }
   ```

3. **Glass-Morphism Overlay**
   ```swift
   struct OverlayWindow: View {
       var body: some View {
           VStack {
               MicOrbView()
               SearchResultsView()
           }
           .background(
               VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)
           )
           .cornerRadius(20)
           .shadow(radius: 20)
       }
   }
   
   struct VisualEffectView: NSViewRepresentable {
       func makeNSView(context: Context) -> NSVisualEffectView {
           let view = NSVisualEffectView()
           view.material = material
           view.blendingMode = blendingMode
           return view
       }
   }
   ```

4. **Search Card UI**
   ```swift
   struct SearchCard: View {
       let result: SearchResult
       
       var body: some View {
           HStack {
               AsyncImage(url: result.thumbnailURL) { image in
                   image
                       .resizable()
                       .aspectRatio(contentMode: .fit)
               } placeholder: {
                   RoundedRectangle(cornerRadius: 8)
                       .fill(Color.gray.opacity(0.3))
               }
               .frame(width: 80, height: 60)
               
               VStack(alignment: .leading) {
                   Text(result.titleSnippet)
                       .font(.headline)
                   Text(result.timestamp)
                       .font(.caption)
                       .foregroundColor(.secondary)
                   
                   if let nugget = result.nugget {
                       Text(nugget.value)
                           .fontWeight(.bold)
                           .foregroundColor(.blue)
                   }
               }
               
               Spacer()
               
               Button("Open") {
                   // Handle open action
               }
           }
           .padding()
           .background(Color.gray.opacity(0.1))
           .cornerRadius(12)
       }
   }
   ```

5. **Voice Input Integration**
   ```swift
   import Speech
   
   class SpeechRecognizer: ObservableObject {
       private let speechRecognizer = SFSpeechRecognizer()
       private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
       private var recognitionTask: SFSpeechRecognitionTask?
       
       @Published var transcript = ""
       @Published var isRecording = false
   }
   ```

#### Success Criteria
- [ ] Overlay summon time <150ms consistently
- [ ] Glass effect renders correctly on all macOS versions
- [ ] Card display handles 1-6 results dynamically
- [ ] Chip refinement triggers search API <200ms
- [ ] Voice recognition accuracy >90% in quiet environment
- [ ] Overlay dismisses instantly on Esc or outside click
- [ ] Memory usage <50MB for UI app

#### Validation Method
- Performance testing with Instruments
- UI testing on multiple macOS versions
- User interaction latency measurements
- Memory leak detection

---

### Step 8: Demo Data Seeding
**Duration:** 2 days  
**Priority:** HIGH  
**Dependencies:** Step 7

#### Objectives
- Create realistic demo scenarios
- Generate test data for 3 target queries
- Validate end-to-end pipeline performance
- Prepare demo script materials

#### Technical Tasks
1. **Demo Scenario Creation**
   - Amazon product browsing session
   - Apex Legends gameplay recording
   - YouTube educational video watching
   - Document/PDF reading session

2. **Automated Data Generation**
   ```bash
   # scripts/seed-demo-data.sh
   #!/bin/bash
   
   echo "Starting Screenpipe capture..."
   # Start Screenpipe
   
   echo "Simulating demo scenarios..."
   # Open specific URLs, wait for capture
   # Amazon: Omega watch product page
   # YouTube: Microeconomics video
   # Apex: Launch game, show scoreboard
   
   echo "Waiting for ingestion pipeline..."
   sleep 300  # 5 minutes for processing
   
   echo "Verifying data availability..."
   # Check database for required entries
   ```

3. **Demo Verification Script**
   ```typescript
   // scripts/demo-verify.ts
   const DEMO_QUERIES = [
     "dad's birthday gift 2 weeks ago",
     "my Apex score yesterday", 
     "YouTube microeconomics video last month"
   ];
   
   for (const query of DEMO_QUERIES) {
     const results = await searchAPI.search(query);
     assert(results.cards.length >= 1, `No results for: ${query}`);
     assert(results.cards[0].score > 0.7, `Low confidence for: ${query}`);
     console.log(`✅ Query "${query}" - Top result: ${results.cards[0].titleSnippet}`);
   }
   ```

4. **Performance Benchmarking**
   - End-to-end query timing
   - Database size and performance impact
   - Memory usage under demo load
   - UI responsiveness measurements

#### Success Criteria
- [ ] All 3 demo queries return Top-3 relevant results
- [ ] Demo verification script passes 100%
- [ ] Database contains ≥500 realistic memory objects
- [ ] Query performance maintains <700ms P95 latency
- [ ] Demo script execution completes in 90 seconds
- [ ] Visual thumbnails load correctly for all demo results

#### Validation Method
```bash
pnpm -C scripts demo:verify
# Expected: ✅ All 3 demo queries successful
```

---

### Step 9: RAG Answer Generation (Optional)
**Duration:** 3 days  
**Priority:** LOW  
**Dependencies:** Step 5

#### Objectives
- Implement `/answer` endpoint for narrative responses
- Integrate GPT-4 for natural language generation
- Add citation linking to search results
- Control costs through selective usage

#### Technical Tasks
1. **RAG Endpoint Implementation**
   ```typescript
   // services/search-api/src/answer.ts
   interface AnswerRequest {
     q: string;
     topk?: number;
   }
   
   interface AnswerResponse {
     text: string;
     citations: Citation[];
     confidence: number;
   }
   
   async function generateAnswer(query: string, topResults: SearchResult[]): Promise<string> {
     const context = topResults
       .map((r, i) => `[${i+1}] ${r.timestamp} ${r.app}: ${r.ocrText}`)
       .join('\n');
   
     const response = await openai.chat.completions.create({
       model: 'gpt-4o',
       messages: [
         {
           role: 'system',
           content: 'You are a precise assistant with access to time-indexed screen memories. Extract factual answers with timestamps and sources.'
         },
         {
           role: 'user',
           content: `Query: "${query}"\n\nContext:\n${context}\n\nProvide a concise factual answer with source references.`
         }
       ],
       temperature: 0.1,
       max_tokens: 200
     });
   
     return response.choices[0].message.content;
   }
   ```

2. **Cost Control Mechanisms**
   - Rate limiting per user
   - Token count optimization
   - Fallback to search-only results
   - Usage analytics and budgeting

3. **Citation Integration**
   ```typescript
   interface Citation {
     id: string;
     ts: number;
     app: string;
     snippet: string;
     relevanceScore: number;
   }
   ```

#### Success Criteria
- [ ] RAG responses generated in <1.8s P95
- [ ] GPT-4 usage costs <$0.01 per query average
- [ ] Citations correctly link to original memory objects
- [ ] Answers factually accurate based on retrieved context
- [ ] Graceful fallback when LLM unavailable

#### Validation Method
```bash
pnpm -C services/search-api test:rag
# Expected: <1.8s response, accurate citations
```

---

### Step 10: Pause & Retention Controls
**Duration:** 2 days  
**Priority:** MEDIUM  
**Dependencies:** Step 7

#### Objectives
- Add menu bar pause functionality
- Implement retention policy controls
- Create user-visible privacy indicators
- Provide data management options

#### Technical Tasks
1. **Menu Bar Controls**
   ```swift
   struct MenuBarView: View {
       @State private var isPaused = false
       @State private var retentionDays = 60
       
       var body: some View {
           VStack {
               Toggle("Pause Capture", isOn: $isPaused)
                   .onChange(of: isPaused) { paused in
                       CaptureService.shared.setPaused(paused)
                   }
               
               Picker("Retention", selection: $retentionDays) {
                   Text("30 days").tag(30)
                   Text("60 days").tag(60)
                   Text("90 days").tag(90)
               }
           }
       }
   }
   ```

2. **Pause State Propagation**
   ```typescript
   // services/ingest-bridge/src/capture-controller.ts
   class CaptureController {
       private isPaused = false;
       
       async setPaused(paused: boolean) {
           this.isPaused = paused;
           // Signal to Screenpipe to pause/resume
           // Update database with pause state
           // Notify other services
       }
       
       shouldProcessEvent(): boolean {
           return !this.isPaused;
       }
   }
   ```

3. **Data Retention Implementation**
   ```typescript
   class RetentionManager {
       async enforceRetention(retentionDays: number) {
           const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
           
           // Delete old records from SQLite
           await db.run('DELETE FROM memories WHERE ts < ?', cutoffDate);
           
           // Delete old vectors from Chroma
           await chromaCollection.delete({ where: { ts: { $lt: cutoffDate } } });
           
           // Delete old media files
           await this.cleanupOldMedia(cutoffDate);
       }
   }
   ```

4. **Privacy Indicators**
   - Overlay shows "Paused" pill when capture disabled
   - Menu bar icon changes color/style based on state
   - System notification for retention policy changes

#### Success Criteria
- [ ] Pause state honored by ingest pipeline within 3 seconds
- [ ] Retention policy enforced automatically on schedule
- [ ] UI indicators accurately reflect capture state
- [ ] Data deletion completes successfully without corruption
- [ ] Pause/resume cycles don't affect system performance

#### Validation Method
```bash
pnpm -C scripts test:pause-resume
# Expected: Pause within 3s, resume cleanly
```

---

### Step 11: Performance Optimization
**Duration:** 3 days  
**Priority:** HIGH  
**Dependencies:** All previous steps

#### Objectives
- Achieve target performance benchmarks
- Optimize resource usage (CPU, RAM, disk)
- Implement telemetry and monitoring
- Tune database queries and indexes

#### Technical Tasks
1. **Performance Telemetry**
   ```typescript
   class PerformanceMonitor {
       private metrics = {
           overlaySum monTime: new Array<number>(),
           searchLatency: new Array<number>(),
           chipRTT: new Array<number>(),
           memoryUsage: new Array<number>(),
           cpuUsage: new Array<number>()
       };
       
       recordOverlaySummon(duration: number) {
           this.metrics.overlaySummonTime.push(duration);
           if (duration > 150) {
               console.warn(`Slow overlay summon: ${duration}ms`);
           }
       }
   }
   ```

2. **Database Query Optimization**
   ```sql
   -- Add performance indexes
   CREATE INDEX idx_memories_ts ON memories(ts DESC);
   CREATE INDEX idx_memories_app_ts ON memories(app, ts DESC);
   CREATE INDEX idx_memories_url_host_ts ON memories(url_host, ts DESC);
   
   -- Optimize FTS queries
   CREATE INDEX idx_memories_fts_rank ON memories_fts(rank);
   ```

3. **Memory Management**
   ```typescript
   class MemoryManager {
       private imageCache = new LRU<string, Buffer>({ max: 100 });
       private embeddingCache = new LRU<string, number[]>({ max: 1000 });
       
       async getThumbnail(memoryId: string): Promise<Buffer> {
           if (!this.imageCache.has(memoryId)) {
               const thumbnail = await fs.readFile(`data/thumbs/${memoryId}.jpg`);
               this.imageCache.set(memoryId, thumbnail);
           }
           return this.imageCache.get(memoryId)!;
       }
   }
   ```

4. **Resource Monitoring**
   - CPU usage tracking with alerts >15% sustained
   - RAM usage monitoring with cleanup triggers
   - Disk space monitoring with automatic pruning
   - Network usage for API calls optimization

#### Success Criteria
- [ ] CPU idle usage ≤10-15% (bursts <15% during processing)
- [ ] RAM usage steady ≤500MB across all services
- [ ] Overlay summon consistently <150ms
- [ ] Search API P95 latency <700ms
- [ ] Chip refinement RTT <200ms
- [ ] Database queries optimized for <50ms average

#### Validation Method
```bash
pnpm -C scripts test:performance-benchmark
# Expected: All metrics within targets for 1 hour sustained
```

---

### Step 12: Final Demo Preparation
**Duration:** 2 days  
**Priority:** CRITICAL  
**Dependencies:** All previous steps

#### Objectives
- Create polished 90-second demo script
- Validate all user flows end-to-end
- Prepare fallback scenarios
- Document known limitations

#### Technical Tasks
1. **Demo Script Creation**
   ```markdown
   # 90-Second Demo Script
   
   ## Setup (Pre-demo)
   - [ ] Screenpipe capturing for 30+ minutes
   - [ ] Demo data indexed and verified
   - [ ] All services running and healthy
   - [ ] Audio/screen recording ready
   
   ## Demo Flow (90 seconds)
   
   **[0-10s] Introduction & Hotkey**
   - "This is Photographic Memory - AI that remembers everything you see"
   - Press ⌥⌘M → Glass overlay appears instantly
   
   **[10-30s] Query 1: Time-anchored recall**
   - Say: "What was that thing I was looking at for my dad's birthday 2 weeks ago?"
   - Memory-Jog mode shows 4 cards
   - Click [Safari] chip → Exact-Hit mode
   - Show Amazon product with price nugget
   - Click "Open" → Browser opens to product page
   
   **[30-50s] Query 2: Game score recall**  
   - Press hotkey → new overlay
   - Say: "What was my Apex Legends score yesterday?"
   - Exact-Hit mode shows scoreboard screenshot
   - Score value highlighted and extractable
   - Copy score to clipboard demo
   
   **[50-70s] Query 3: Content recall**
   - Press hotkey → overlay
   - Type: "YouTube microeconomics video last month" 
   - Shows video thumbnail, title, channel
   - Click [YouTube] chip for refinement
   - Click "Open" → YouTube video loads
   
   **[70-90s] Privacy & Control**
   - Show menu bar → click Pause toggle
   - Overlay shows "Paused" indicator
   - Show retention settings (60 days)
   - Resume capture
   ```

2. **End-to-End Validation**
   ```bash
   # Complete system test
   ./scripts/demo-full-test.sh
   
   # Tests:
   # - All services healthy
   # - Demo queries return expected results  
   # - UI responsiveness within targets
   # - Error handling for edge cases
   # - Resource usage within limits
   ```

3. **Fallback Preparation**
   - Pre-recorded demo video as backup
   - Static screenshot fallbacks for live demo
   - Known good queries if demo data fails
   - Performance degradation graceful handling

4. **Documentation Completion**
   ```markdown
   # Known Limitations (MVP)
   - macOS only (Windows planned for v2)
   - English OCR primarily (multilingual in v2) 
   - Requires internet for embeddings/LLM
   - 60-day retention maximum
   - Audio transcription not included
   - Limited app-specific extractors
   ```

#### Success Criteria
- [ ] Demo script executable in exactly 90 seconds
- [ ] All 3 target queries succeed in live demo
- [ ] UI transitions smooth and professional
- [ ] No crashes or errors during demo flow
- [ ] Fallback options tested and ready
- [ ] Performance metrics maintained during demo load

#### Validation Method
- 10 complete demo run-throughs
- Performance monitoring during demo
- User acceptance testing with target audience
- Stress testing with high query volume

---

## 🎯 Success Metrics Summary

### Performance Targets
- **Overlay Summon:** <150ms consistently
- **Search Latency:** P95 <700ms, cold start <1.5s  
- **Chip Refinement:** <200ms round-trip time
- **Resource Usage:** CPU ≤10-15% idle, RAM ≤500MB steady
- **Accuracy:** Top-1 hit rate ≥80%, Top-3 ≥90%

### Demo Success Criteria
- **Query Success:** 3/3 demo queries hit Top-3 relevant results
- **UI Polish:** Glass effects render correctly, no visual glitches
- **Performance:** All interactions feel instant and responsive
- **Reliability:** Zero crashes or errors during 90s demo
- **Wow Factor:** Audience reaction positive, feature clarity high

### Technical Completeness
- **Pipeline Health:** All services running without memory leaks
- **Data Quality:** OCR accuracy ≥90% on standard UI text
- **Integration:** Screenpipe → Search API → SwiftUI working seamlessly
- **Privacy:** Pause/resume controls functional, retention policies enforced

---

## 🚨 Risk Mitigation

### High-Risk Items
1. **Screenpipe Integration Complexity**
   - Mitigation: Start early, have fallback capture method ready
   - Test extensively on different macOS versions

2. **OpenAI API Cost/Rate Limits**  
   - Mitigation: Implement local embedding fallback
   - Monitor usage closely, set budget alerts

3. **SwiftUI Overlay Performance**
   - Mitigation: Optimize rendering pipeline early
   - Test on older hardware, profile memory usage

4. **Demo Data Quality**
   - Mitigation: Multiple seed data scenarios
   - Manual verification of all demo queries

### Medium-Risk Items
- OCR accuracy on varied UI elements
- Time parsing edge cases ("yesterday evening")
- Database performance under load
- macOS permission handling edge cases

---

## 📅 Timeline Summary

**Total Duration:** 33 days (6.6 weeks)

**Critical Path:**
1. Repo Setup (2d) → 
2. Screenpipe (3d) → 
3. Ingest Bridge (4d) → 
4. Search API (5d) → 
5. SwiftUI Overlay (6d) → 
6. Demo Prep (2d)

**Parallel Work Opportunities:**
- Embeddings integration (Step 4) can overlap with Search API development
- Nugget extractors can be developed alongside Search API
- Performance optimization ongoing throughout development
- Documentation and testing parallel to feature development

This implementation plan prioritizes the "wow factor" for your 90-second demo while maintaining technical rigor and measurable success criteria at each step.
