
# Photographic Memory Desktop App — MVP Tech Spec (LLM‑Optimized)

> **Purpose of this document (read by an LLM):** You are a senior engineer and product architect. Use this document as full context to propose architecture, write code, or reason about trade‑offs for a macOS‑first MVP that gives users “photographic memory” of their desktop. Prefer concrete, high‑impact decisions that maximize *impressiveness* for the MVP, accepting paid APIs if they materially improve quality. Privacy hardening can follow later versions.

---

## 0) Executive Summary (What we’re building)
A macOS app that continuously (or event‑smartly) captures the user’s screen and ambient context, turns those moments into **searchable memories**, and retrieves them instantly via a **global hotkey + voice/typed query**. Answers are shown as a **translucent futuristic overlay** with the *fact* and the *receipt* (thumbnail of the moment, timestamp, source app/URL).

**MVP bias:** maximum “wow” factor and responsiveness, even if it uses paid AI services. Security/privacy hardening comes later.

---

## 1) Primary User Stories & Examples

### 1.1 Time‑anchored recall
- “What was that thing I was looking at for my dad’s birthday **2 weeks ago**?”  
  → Return the product card/title + screenshot from Safari (timestamp, URL), with **2–6 alternate candidates** to jog memory.

### 1.2 App/game state recall
- “What was my **Apex Legends** high score **yesterday**?”  
  → Return the scoreboard frame; extract and **highlight** the numeric score; show near‑by frames as alternates.

### 1.3 Topic/content recall
- “What was the title of the **YouTube** video I watched about **microeconomics** **a month ago**?”  
  → Return the exact title/channel + screenshot; provide deep‑link button if possible.

### 1.4 General life‑admin recall
- “Show me that **FIDO2 blog post** I skimmed last night.”  
- “Find the **error dialog** I saw before lunch.”  
- “Open the **PDF about nitric oxide** from last week.”

---

## 2) UX Principles & Interaction

### 2.1 Overlay summon & input
- **Global hotkey** → a **translucent mic orb** appears (push‑to‑talk) with option to type.
- Overlay is **non‑modal**, centered, with blur/glass effect; **Esc** dismisses instantly.

### 2.2 Two answer modes (confidence‑adaptive)
- **Exact‑Hit mode** (high confidence): show one primary result card + up to 2 light alternates.
- **Memory‑Jog mode** (lower confidence or fuzzy queries): show a **3–6 card grid** to jog recall (thumbnails, bold key text, app icon, timestamp, quick actions).

**Refine chips:** `[Safari] [Amazon] [2 weeks ago] [Evening] [YouTube] [Microeconomics]` (tap to filter/re‑rank).  
**Feedback:** ✅ “That’s it” / ❌ “Not it” to improve ranking.

### 2.3 Speed & delight
- Target **<700 ms** to first results; thumbnails stream progressively.
- Every answer includes a **receipt** (visual proof + timestamp + app/URL).

---

## 3) System Overview (Pipeline)

```
[Capture] → [Extract] → [Enrich] → [Index] → [Retrieve/Rank] → [Respond UI]
```

- **Capture:** periodic/event‑based screenshots (+ optional audio), plus app/window/URL metadata.
- **Extract:** OCR text; optional image embeddings; optional speech transcription.
- **Enrich:** normalize timestamps, sessionize, entity/topic tags, generate embeddings.
- **Index:** hybrid: vector (semantic) + inverted/metadata (keyword/time/app).
- **Retrieve/Rank:** parse query (topic, time, app hints) → hybrid retrieval → confidence score.
- **Respond:** overlay presents Exact‑Hit or Memory‑Jog with actions & refine chips.

---

## 4) macOS‑First MVP Stack (decisions with alternatives)

### 4.1 Capture Engine (always‑on, low overhead)
- **Primary:** Swift (AppKit) using **ScreenCaptureKit / AVFoundation** for screen frames.  
  - Event triggers: foreground app change, window title/URL change, significant pixel change, explicit “mark” hotkey.  
  - **Change detection:** compute cheap hash / SSIM vs previous; capture if > threshold (~15–25%).
- **Metadata taps:**  
  - Active app & window title: NSWorkspace / Accessibility API.  
  - Browser URL: ScriptingBridge/AppleScript (Safari), Chrome DevTools Protocol (if needed).
- **Storage:** Daily rolling **H.264/HEVC video** (hardware encoder) *or* JPEG frames + manifest.  
  - Retention: 30–90 days (configurable); auto‑prune by age/size cap.  
  - Thumbnails generated & cached on ingest for fast UI.

**Alternatives:** Rust core (Tauri) for cross‑platform parity; ffmpeg screen grab; Screenpipe‑style pipeline.

### 4.2 OCR & Visual Understanding
- **Primary OCR:** Apple **Vision.framework** (VNRecognizeTextRequest) — fast, on‑device, GPU/ANE.  
- **Fallback/Multilingual:** **PaddleOCR (RapidOCR)** or **Tesseract** via separate worker.  
- **Image embeddings (optional but “magical”):** **OpenCLIP ViT‑B/32** (local) for visual semantic search.  
  - Strategy: compute only when OCR text is sparse or on keyframes to save compute.

### 4.3 Audio (optional, for “wow”)
- **Transcription:** **Whisper** (CoreML/Metal optimized) for system/mic audio; sessionize by app/window.  
- **Use:** searchable meeting notes, spoken keywords, “what did they say about X?”.

### 4.4 Indexing & Storage
- **Text/metadata DB:** **SQLite** (with FTS5 for keyword search).  
- **Vector index:** **ChromaDB** (SQLite/DuckDB‑backed) or **FAISS** (embedded).  
- **Alt (paid/cloud, for sync/wow):** **Pinecone** (vector DB as a service).  
- **Schema:** see §6.

### 4.5 Embeddings & NLP
- **Text embeddings (impressiveness):** OpenAI `text-embedding-3-large` (or `-small` for cost).  
  - **Alt local:** `Instructor-xl` / `bge-large` via llama.cpp/gguf if offline needed later.
- **Natural language parsing:**  
  - **Time parsing:** **chrono** (JS) or **duckling** (Haskell via HTTP) to resolve “yesterday/2 weeks ago/last month”.  
  - **Query intent & fields:** lightweight rules + LLM (few‑shot) for extracting app, time window, entity types.  
- **LLM for answers/summaries (MVP wow):** **GPT‑4/4.1** (cloud).  
  - **Alt local:** **Ollama** (Llama‑3 8B/70B) for simple summaries; defer for MVP if quality drops.

### 4.6 Desktop UI
- **Overlay:** SwiftUI **NSPanel** with **NSVisualEffectView** (vibrancy/blur), mic orb, chip filters.  
  - **Alt cross‑platform:** **Tauri** (Rust backend + React front‑end) or **Electron** (Next.js).  
- **Global hotkey:** MASShortcut (Swift) or CGEventTap.  
- **Voice:** SFSpeechRecognizer for push‑to‑talk UX (or route to Whisper if always‑on).

---

## 5) “Memory Object” Data Model (canonical schema)

```jsonc
{
  "id": "uuid",
  "timestamp": "2025-09-10T16:42:13.123Z",
  "session_id": "uuid",
  "source": {
    "app": "Safari",
    "window_title": "Amazon — Omega Seamaster",
    "url": "https://www.amazon.com/...",
    "monitor": 1
  },
  "media": {
    "type": "image",
    "path": "file:///.../2025-09-10/16-42-13.jpg",
    "thumbnail_path": "file:///.../thumbs/16-42-13.jpg",
    "video_offset_ms": 0
  },
  "extracted": {
    "ocr_text": "OMEGA Seamaster Aqua Terra ... $3,495 ...",
    "asr_text": null,
    "ui_elements": []
  },
  "nlp": {
    "entities": ["Omega", "watch", "birthday gift"],
    "topics": ["shopping", "watches"],
    "language": "en"
  },
  "index": {
    "text_vector_id": "vec_...",
    "image_vector_id": "ivec_...",
    "keywords": ["omega","seamaster","amazon","$3495"]
  },
  "security": {
    "redactions": ["credit_card","email"]
  }
}
```

---

## 6) Indexing Strategy (hybrid)

### 6.1 Inverted index + metadata filters
- SQLite FTS5 over `extracted.ocr_text` (+ `asr_text`), fields for `app`, `url_host`, `date`, `hour`.
- Enable fast filters: `WHERE app='Safari' AND date BETWEEN ...`

### 6.2 Vector search (semantic)
- Store embeddings for:  
  - **Text:** concatenated OCR (+ ASR) per memory.  
  - **Image (optional):** CLIP embedding for visual search.
- Retrieval: top‑k by cosine similarity; merge with keyword hits.

### 6.3 Confidence score & ranking
```
confidence = w_sem * sim(query_vec, mem_vec)
           + w_kw  * bm25_score(query_text, mem_text)
           + w_time* time_decay(delta_t)
           + w_app * app_match_bonus
           + w_src * source_reliability
```
- Thresholds switch UI mode: **Exact‑Hit** if ≥ T_high; **Memory‑Jog** with k∈[3,6] if < T_high.
- Online learning: ✅/❌ feedback tunes weights per user.

---

## 7) Query Understanding (LLM‑assisted)

**Parse goals:** time window(s), app/site hints, entity/topic hints, answer field (e.g., “score”, “title”, “price”), and strict/non‑strict mode.

**Example extraction (few‑shot prompt to LLM):**
```json
{
  "time_window": { "from": "2025-08-27", "to": "2025-09-03" },
  "app_hints": ["Safari","YouTube"],
  "topic_hints": ["microeconomics"],
  "answer_field": "video_title",
  "strict": false
}
```

**Time resolution:** `chrono` converts “last month / two weeks ago / yesterday evening” → absolute ranges.  
**Composed query:** `(time filter) ∧ (app/url filter) ∧ (semantic top‑k)`

---

## 8) Resource Budgets & Background Engineering

- **CPU target:** idle ~2–5%; bursts <15% during OCR/encode (Apple Silicon, hardware paths).  
- **RAM target:** steady <500 MB (no large frame buffering; models on‑demand).  
- **Disk target:** ~10–20 GB/month (HEVC daily files + thumbnails; prune by age/size).  
- **Capture policy:** every 2s *if change > 20%*; always on focus/URL/title change; “Pause” hotkey.  
- **Backpressure:** drop frames if OCR queue > N; prioritize most recent.

**Battery‑aware:** throttle on battery; suspend on screensaver/locked state.

---

## 9) MVP vs V2 Scope

**MVP (macOS):**
- Screen capture + metadata; Vision OCR; embeddings; hybrid index; global hotkey; overlay UI; natural language queries; Exact‑Hit/Memory‑Jog; basic feedback; 30–90d retention.

**V2+:**
- Short rolling clips; CLIP everywhere; per‑app adapters; richer redaction; cross‑device sync; Windows port; meeting auto‑summary; timeline scrubber; privacy exclusions/UI.

---

## 10) Alternatives & Trade‑offs

| Component | MVP Choice | Alternatives | Trade‑off Notes |
|---|---|---|---|
| Capture | ScreenCaptureKit (Swift) | Rust+Tauri, ffmpeg, Screenpipe core | Native = lowest overhead; Rust eases cross‑platform later. |
| OCR | Apple Vision | PaddleOCR, Tesseract | Vision fastest on macOS; use Paddle/Tesseract if multilingual gaps. |
| Text Embeddings | OpenAI `text-embedding-3-large` | Instructor/BGE local | OpenAI = best quality; local = zero cost offline, lower quality. |
| Image Embeddings | OpenCLIP (selective) | Skip in MVP | Adds “magical” visual search; compute cost if done for all frames. |
| Vector DB | Chroma (embedded) | FAISS, Pinecone | Chroma simple & persistent; Pinecone great for sync, adds cloud cost. |
| LLM | GPT‑4 (answers/summaries) | Ollama (Llama‑3) | GPT‑4 is wow; local models cheaper but less accurate. |
| UI | SwiftUI overlay | Tauri/Electron | SwiftUI integrates best w/ macOS permissions/blur. |

---

## 11) Prompting & RAG Orchestration (LLM)

### 11.1 Retrieval prompt (answering factual recall)
```
System: You are a precise assistant with access to time-indexed screen memories.
User query: "{q}"
Context (top results, newest first):
1) [{ts}] {app} {title} — {url_host}
   OCR: "{snippet1}"
2) ...
Instructions:
- If the answer is extractable (e.g., title, score, price), return it succinctly.
- Provide the timestamp and source app.
- If ambiguous, propose up to 6 likely candidates with short labels.
- Never invent; if uncertain, say “Here are likely matches.”
```

### 11.2 Summarization prompt (optional)
```
Summarize key points from these memories between {t_from} and {t_to} about {topic}.
Return bullet points with timestamps and source apps.
```

---

## 12) Key APIs & Permissions (macOS)

- **Screen capture:** ScreenCaptureKit / CGDisplayStream (requires Screen Recording permission).  
- **Accessibility:** AX API for window titles (requires Accessibility permission).  
- **Browser URL access:** Safari ScriptingBridge; Chrome AppleScript / local debugging.  
- **Audio:** AVAudioSession / aggregate device (microphone/system audio capture requires Microphone permission).  
- **Files:** sandbox entitlements or user‑selected directories for data.

---

## 13) Risk Log & Mitigations

- **Resource creep (RAM/CPU):** throttle capture; hardware paths; on‑demand models; prune caches.  
- **OCR misses small text:** allow 2× scale OCR pass on demand; user “enhance” action.  
- **URL retrieval fragility:** per‑browser adapters + fall back to OCRing the omnibar.  
- **Privacy backlash:** add Pause, Exclude apps/sites, retention controls; local‑only default.  
- **LLM hallucination:** always pair with visual receipts; conservative prompting; Top‑k display.  
- **Disk growth:** daily encode; rolling retention; compression/archival job.  

---

## 14) Acceptance Criteria (MVP “good”)

- **Accuracy:** Top‑1 feels right ≥80% on clear queries; Top‑3 ≥90% in Memory‑Jog.  
- **Latency:** Query to first result <700 ms (cold <1.5 s).  
- **UX:** Overlay never blocks; easy pause/exclude; receipts on every answer.  
- **Stability:** 24/7 run without leaks; <15% CPU bursts; <500 MB steady RAM.  

---

## 15) Dev Setup & Runbook (sketch)

- macOS 14+, Apple Silicon recommended.  
- Xcode (Swift), Python 3.11 (if using Chroma), Node 20 (if using Tauri/Electron UI).  
- OpenAI API key (for embeddings/LLM).

**Services:**  
- Start capture daemon (Swift).  
- Start indexer (Python/Rust worker).  
- Start UI (SwiftUI / Tauri).

**Env:** `OPENAI_API_KEY=...` `MEM_RETENTION_DAYS=60`

---

## 16) Open Questions

1. Do we include audio in MVP or ship a screen‑only first cut?  
2. Do we compute image embeddings for **all** frames or on‑demand when OCR is weak?  
3. Pinecone for sync in v1, or defer cloud entirely?  
4. Which browsers need first‑class URL adapters (Safari, Chrome, Arc, Brave)?  
5. How aggressive should default retention be (30d vs 90d) for wow vs disk usage?

---

## 17) Appendix: Example JSON Records

### 17.1 Memory record (flattened for index)
```json
{
  "id": "d6b6c48f-...",
  "ts": 1694350933123,
  "app": "Safari",
  "url_host": "amazon.com",
  "window_title": "Omega Seamaster – Amazon",
  "ocr_text": "OMEGA Seamaster Aqua Terra ... $3,495 ...",
  "asr_text": null,
  "path": "/data/2025-09-10/16-42-13.jpg"
}
```

### 17.2 Query parse (LLM output target)
```json
{
  "query_text": "what was that thing i was looking at for my dads birthday 2 weeks ago",
  "time_window": { "from": "2025-08-27T00:00:00Z", "to": "2025-09-03T23:59:59Z" },
  "app_hints": ["Safari","Amazon","Etsy","YouTube"],
  "topic_hints": ["birthday gift","watch","gadgets"],
  "answer_field": "title_or_product_name",
  "strict": false
}
```

---

## 18) Build‑Order Checklist (MVP)

1) **Capture & metadata** (screen + app/title/url)  
2) **OCR ingest** → text store (SQLite FTS)  
3) **Embeddings & vector index** (Chroma)  
4) **Hybrid search & ranking** (confidence score)  
5) **Overlay UI + hotkey + mic**  
6) **Exact‑Hit / Memory‑Jog UI** (chips, feedback)  
7) **LLM RAG** (optional for wow: answers/summaries)  
8) **Retention & pruning**

---

**End of LLM‑optimized context.**
