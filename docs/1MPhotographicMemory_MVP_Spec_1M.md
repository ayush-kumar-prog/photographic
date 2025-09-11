
# Photographic Memory Desktop App — MVP Tech Spec (LLM-Optimized, Consolidated)

> **Purpose (for an LLM):** You are a senior engineer/product architect. Use this document as *complete context* to design, code, and reason about a **macOS-first** MVP that gives users “photographic memory” of their desktop. Optimize for a **90-second wow demo**: glassy overlay UI + fast recall with visual receipts. Favor choices that maximize impressiveness and responsiveness, even if they use paid APIs. Privacy hardening and Windows can follow later.

---

## 0) Executive Summary

A macOS app that continuously (or event-smartly) captures the screen (and optionally audio), converts moments into **searchable memories**, and retrieves them instantly via a **global hotkey** in a **translucent futuristic overlay**. Each answer pairs the *fact* with the *receipt* (screenshot thumbnail, timestamp, source app/URL).

**MVP bias:** maximum “wow” factor and responsiveness for a 90s demo. Security/privacy UX later.

**Architecture stance:** Hybrid approach
- **Screenpipe** as the always-on capture + OCR + metadata engine (local, efficient).  
- Our **Ingest Bridge** normalizes Screenpipe events → SQLite(FTS5) + Chroma vectors.  
- **Search API** provides hybrid ranking + confidence → Exact-Hit vs Memory-Jog.  
- **SwiftUI overlay** delivers the glass-morphism and instant UX.  
- **OpenAI embeddings + GPT-4** (for demo wow); keep local modes for later.

---

## 1) Primary User Stories (MVP demo targets)

1. **Time-anchored recall** — “What was that thing I was looking at for my **dad’s birthday 2 weeks ago**?”  
   → Product card/title + Safari screenshot + timestamp/URL; if uncertain, show **3–6** Memory-Jog cards.

2. **Game score recall** — “What was my **Apex Legends** high score **yesterday**?”  
   → Scoreboard frame; **numeric score highlighted**; 1–2 alternates nearby.

3. **Content recall** — “What was the title of the **YouTube** video on **microeconomics** **a month ago**?”  
   → Title/channel + screenshot + Open action.

---

## 2) UX Principles & Interaction

- **Summon**: Global hotkey → **translucent mic orb** overlay (NSPanel, non-activating).  
- **Two modes** (confidence-adaptive):  
  - **Exact-Hit** (high confidence): 1 primary card + up to 2 alternates.  
  - **Memory-Jog** (fuzzy): grid of **3–6** cards (“Were you looking for one of these?”).  
- **Receipts**: Every card includes thumbnail, app icon, URL host, timestamp, and **Open**.  
- **Refine chips**: `[Safari] [YouTube] [Amazon] [2 weeks ago] [Yesterday]` (instant requery).  
- **Speed**: First meaningful paint < **700 ms**; overlay summon < **150 ms**; chip requery < **200 ms**.  
- **Dismiss**: Esc or hotkey again; menu bar has **Pause** and **Retention** toggles.

---

## 3) System Overview (Pipeline)

```
[Screenpipe Capture] → [Ingest Bridge] → [SQLite (FTS5) + Chroma] → [Search API] → [SwiftUI Overlay]
```

- **Capture (Screenpipe)**: 24/7 screen OCR + app/window/URL metadata (and optional audio).  
- **Ingest Bridge**: Normalize events, dedup/sessionize, write text to SQLite (FTS5), vectors to Chroma.  
- **Index**: Hybrid (semantic vectors + keyword FTS + metadata filters).  
- **Retrieve/Rank**: Confidence scoring drives **Exact-Hit vs Memory-Jog**.  
- **Respond**: Glass overlay shows cards with receipts; nugget extractors bold the answer.

---

## 4) macOS-First Stack (decisions & rationale)

- **Capture/OCR**: **Screenpipe** daemon + SDK (local, efficient; Apple-native OCR).  
- **DB**: **SQLite (FTS5)** for keyword; **Chroma** for vectors (OpenAI embeddings).  
- **LLM**: **GPT-4/4o** for answer phrasing (limited to one demo moment); otherwise receipts-only.  
- **Overlay**: **SwiftUI NSPanel** + **NSVisualEffectView** (glass) + `KeyboardShortcuts` for hotkey.  
- **Dev tooling**: Monorepo; Node/TS services; Xcode for the overlay app.  
- **Cross-platform UI (Tauri)**: *Defer for end-user overlay*; can be used for dev console later.

---

## 5) Monorepo Structure

```
memories/
  apps/
    overlay-macos/              # SwiftUI NSPanel overlay (hotkey + glass UI)
  services/
    ingest-bridge/              # Node/TS: Screenpipe -> SQLite(FTS5) + Chroma vectors
    search-api/                 # Node/TS: hybrid retrieval + RAG endpoints
  packages/
    mem-core/                   # (optional) shared types/schemas/adapters
  vendor/
    screenpipe/                 # submodule or installed binary (do NOT modify)
    remind/                     # optional reference only; not shipped
  data/                         # dev dbs (SQLite, Chroma), thumbs, media refs
  scripts/                      # start-all, smoke tests, demo verifiers
  docs/
```

**Policy**: Don’t modify **Screenpipe**; treat as dependency. ReMind is a pattern reference, not runtime.

---

## 6) Data Model

### 6.1 MemoryObject (canonical)
```ts
type MemoryObject = {
  id: string;                    // uuid
  ts: number;                    // epoch ms
  session_id?: string;           // optional clustering
  app: string;                   // "Safari", "Code", "Apex"
  window_title?: string;
  url?: string;
  url_host?: string;             // "amazon.com", "youtube.com"
  media_path?: string;           // file://… (frame) or video segment ref
  thumb_path?: string;           // cached thumbnail
  ocr_text: string;              // extracted via Screenpipe OCR
  asr_text?: string | null;      // optional audio transcript
  entities?: string[];           // optional
  topics?: string[];             // optional
};
```

### 6.2 Storage
- **SQLite (FTS5)**: table `memories (id, ts, app, url_host, window_title, ocr_text)` + FTS index on `ocr_text`.  
- **Chroma**: collection `mem_text` with `{ id, vector, metadata: { ts, app, url_host } }`.  
- Thumbs stored under `data/thumbs/…`; media under `data/media/…` or referenced from Screenpipe storage.

---

## 7) Indexing Strategy (Hybrid)

### 7.1 Retrieval Features
- **Semantic**: cosine(query_vec, doc_vec) via Chroma.  
- **Keyword**: BM25/FTS score from SQLite.  
- **Time**: decay/boost within user-hinted range.  
- **App/URL**: bonus for matches to hints/extracted intent.

### 7.2 Confidence & Mode
```
confidence = w_sem * sim + w_kw * bm25 + w_time * time_bonus + w_app * app_bonus
if confidence >= T_high → mode = "exact"
else → mode = "jog" with top-k (3..6)
```
- **Feedback**: ✅/❌ updates weights per user over time (defer learning persistence if needed).

---

## 8) Query Understanding

- **Time parsing**: Convert “yesterday / 2 weeks ago / last month” to `[from,to]` (chrono/duckling).  
- **Intent hints**: Extract app/site cues (“YouTube”, “Safari”, “Amazon”) and target fields (“price”, “score”, “title”).  
- **Composed search**: time ∧ app/url filters ∧ semantic top-k; fall back to Memory-Jog grid if low confidence.

---

## 9) Result Rendering & Nugget Extraction

- **Cards** always show: thumbnail, bold **nugget**, app icon, URL host, timestamp, **Open**.  
- **Nugget extractors (minimal, deterministic)**:
  - **YouTube**: extract title from OCR lines that sandwich channel/“YouTube” patterns.  
  - **Amazon**: currency + price regex `(\$|£|€)\s?\d{1,3}(,\d{3})*(\.\d{2})?`.  
  - **Apex**: capture line containing `KILLS|SCORE|RANKED|XP` + digits; pick the max/label.  
- If extractors fail, show top OCR lines; let RAG phrase the result (optional).

---

## 10) Implementation Plan (90-Second Demo Focus)

**Overall objective:** Glass overlay + 3 fuzzy queries **hit Top-3** and feel instant.

### Step 1 — Repo & bootstrap
- Create monorepo folders, add scripts (`start:all`, smoke tests).  
- **Goal**: `pnpm run start:all` starts services; Xcode builds overlay.

### Step 2 — Screenpipe online
- Install/start Screenpipe; grant permissions.  
- **Goal**: SDK returns ≥ **100 OCR events** in 10 min of use.

### Step 3 — Ingest Bridge
- Poll Screenpipe every 3–5s; normalize to MemoryObject.  
- Upsert SQLite row + push OpenAI embedding to Chroma.  
- **Goal**: ≥ **3k rows/hour**; throughput ≥ **200 rows/min** sustained.

### Step 4 — Embeddings (wow)
- Use **`text-embedding-3-large`** at ingest (or `…-small` by flag).  
- **Goal**: Batch **1k rows < 30s**; ≤ **0.5%** failed with retries.

### Step 5 — Search API (hybrid + confidence)
- Implement `/search` with hybrid scoring and mode switch.  
- **Goals**: P95 latency **< 700 ms** (cold < 1.5 s); 3 canned queries → **Top-3 hit 3/3**.

### Step 6 — Nugget extractors
- Implement minimal YouTube/Amazon/Apex extractors.  
- **Goal**: ≥ **80%** success on fixtures; nugget bolded on cards.

### Step 7 — SwiftUI overlay
- Build NSPanel overlay with glass; hotkey `⌥⌘M`.  
- Show mode-dependent layout (Exact vs Jog); chips requery instantly.  
- **Goals**: Summon **< 150 ms**; chip requery **< 200 ms**; dismiss immediate.

### Step 8 — Demo data seeding
- Record Amazon, Apex, YouTube scenarios with Screenpipe running; let ingest index them.  
- **Goal**: `/scripts/demo-verify.ts` prints ✅ for 3 demo queries with Top-3 hits.

### Step 9 — RAG (optional sparkle)
- `/answer` → GPT-4/4o with top-k snippets for one scripted moment.  
- **Goal**: P95 **< 1.8 s**; use once in demo.

### Step 10 — Pause & retention (basic)
- Menu bar: **Pause** + **Retention** (label only).  
- **Goal**: Pause flag honored by ingest **≤ 3s**; overlay shows “Paused” pill.

### Step 11 — Performance checks
- Telemetry: summon time, `/search` latency, chip RTT.  
- **Goals**: CPU idle **≤ 10–15%**, RAM steady **≤ 500 MB** (excluding vendor buffers).

### Step 12 — Demo script (90s)
1) Hotkey → overlay (mic orb pulses).  
2) “dad’s birthday gift 2 weeks ago” → Memory-Jog (4 cards); click `[Safari]` → Exact; **Open**.  
3) Hotkey → “my Apex score yesterday” → Exact-Hit with bold score; **Copy**.  
4) Hotkey → “YouTube microeconomics a month ago” → title/channel; `[YouTube]` chip; **Open**.  
5) Show **Pause** in menu bar; overlay “Paused” pill; resume.

---

## 11) API Contracts (for parallel work)

### 11.1 `/search`
**Request**
```
GET /search?q=string&from=ISO&to=ISO&app=Safari&host=youtube.com&k=6
```
**Response**
```json
{
  "mode": "exact",
  "confidence": 0.82,
  "cards": [
    {
      "id": "d6b6c48f",
      "ts": 1694350933123,
      "app": "Safari",
      "url_host": "amazon.com",
      "title_snippet": "OMEGA Seamaster Aqua Terra — $3,495",
      "thumb_url": "mem://thumbs/d6b6c48f.jpg",
      "score": 0.91,
      "nugget": { "type": "price", "value": "$3,495", "confidence": 0.9 }
    }
  ]
}
```

### 11.2 `/answer` (optional)
**Request**
```json
{ "q": "what did I work on yesterday?", "topk": 5 }
```
**Response**
```json
{
  "text": "You worked on FIDO2 docs in Safari (15:22) and a GitHub PR in VS Code (16:05).",
  "citations": [
    {"id":"a1","ts":1694350933,"app":"Safari"},
    {"id":"b2","ts":1694354705,"app":"Code"}
  ]
}
```

---

## 12) Embeddings Strategy (A/B rationale)

- **ReMind baseline**: local embeddings + local LLM (Ollama). Good privacy; average recall on messy OCR.  
- **Our MVP**: **OpenAI `text-embedding-3-large`** → measurable lift in recall@k on short UI text (titles/prices/scores).  
- **Effect on wow**: More **Exact-Hit** outcomes → less grid time → feels “magical.”  
- **Fallback**: `…-small` for cost control; local mode later.

---

## 13) Costs (Wow MVP)

Assumptions: ~10k moments/day, ~100 tokens OCR/moment, 30–100 queries/day.

- **Embeddings**: `text-embedding-3-large` ≈ **$0.13 / 1M tokens** → ≈ **$0.13/day** (~**$4/mo**).  
  - `…-small` ≈ **$0.02 / 1M** → ≈ **$0.02/day** (~**$0.60/mo**).
- **LLM (GPT-4/4o)**: ≈ **$0.01/query** typical RAG call; use **sparingly** in demo.  
- **Capture/storage**: Screenpipe local; target **~15 GB/month**, **≤10–15% CPU**, **≤4 GB RAM** (tunable).

**Total (demo-heavy)**: **$5–$15/mo** per active user (dominated by GPT usage).

---

## 14) Risks & Mitigations

- **Latency spikes** → prefetch/top-k cache; progressive paint cards; keep RAG optional.  
- **OCR misses tiny text** → 2× scale OCR on-demand; fallback to Memory-Jog grid.  
- **App/URL signal noisy** → manual chips; conservative boosts; feedback tuning.  
- **Privacy optics** → visible **Pause**, **Exclusions**, **Retention** label even in MVP.  
- **OSS drift** → pin Screenpipe version; thin ingest adapter; avoid deep forks.

---

## 15) Cut List (if time slips)

- Skip image embeddings; OCR text only.  
- Skip RAG; receipts-only answers.  
- Chips limited to `[Time]` + `[App]`.  
- One demo query can be “primed” via pinning top result.

---

## 16) Open Questions

1) Include audio (ASR) in MVP or ship screen-only?  
2) Image embeddings for all frames vs on-demand when OCR is sparse?  
3) Pinecone for future sync vs local-only for MVP?  
4) Which browsers get URL adapters first (Safari, Chrome, Arc)?  
5) Default retention 60 vs 90 days (demo perception vs disk)?

---

## 17) Dev Setup & Commands

**Env**
```
OPENAI_API_KEY=...
MEM_RETENTION_DAYS=60
SEARCH_K=6
CONFIDENCE_T_HIGH=0.78
```

**Run**
```
# Start vendor (Screenpipe via its app/CLI)
pnpm -C services/ingest-bridge start
pnpm -C services/search-api start
# Build & run apps/overlay-macos in Xcode
```

**Smoke**
```
pnpm -C services/ingest-bridge test:smoke   # ≥100 OCR events in 10 min
pnpm -C scripts demo:verify                 # 3 queries Top-3 hits
```

---

## 18) Appendix: Example Records

### 18.1 Stored row (SQLite)
```json
{
  "id": "d6b6c48f",
  "ts": 1694350933123,
  "app": "Safari",
  "url_host": "amazon.com",
  "window_title": "Omega Seamaster – Amazon",
  "ocr_text": "OMEGA Seamaster Aqua Terra ... $3,495 ..."
}
```

### 18.2 Vector metadata (Chroma)
```json
{
  "id": "d6b6c48f",
  "metadata": { "ts": 1694350933123, "app": "Safari", "url_host": "amazon.com" }
}
```

### 18.3 `/search` card
```json
{
  "id": "d6b6c48f",
  "ts": 1694350933123,
  "app": "Safari",
  "url_host": "amazon.com",
  "title_snippet": "OMEGA Seamaster Aqua Terra — $3,495",
  "thumb_url": "mem://thumbs/d6b6c48f.jpg",
  "score": 0.91,
  "nugget": { "type": "price", "value": "$3,495", "confidence": 0.9 }
}
```

---

**End of consolidated, LLM-optimized context.**
