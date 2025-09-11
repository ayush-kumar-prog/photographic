/**
 * Core memory object schema - canonical representation
 * Based on the MVP specification
 */
export interface MemoryObject {
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
}

/**
 * Screenpipe event interface - raw input from capture
 */
export interface ScreenpipeEvent {
  id: string;
  timestamp: number;
  app: string;
  window_title: string;
  url?: string;
  ocr_text: string;
  media_path: string;
  confidence?: number;
}

/**
 * Nugget extraction result
 */
export interface NuggetResult {
  type: 'price' | 'score' | 'title' | 'generic';
  value: string;
  confidence: number;
}

/**
 * Database row structure for SQLite storage
 */
export interface MemoryRow {
  id: string;
  ts: number;
  app: string;
  url_host: string | null;
  window_title: string | null;
  ocr_text: string;
  media_path: string | null;
  thumb_path: string | null;
}
