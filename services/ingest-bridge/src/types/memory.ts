/**
 * Memory object types for ingest bridge service
 * Copied from mem-core to avoid import issues during development
 */

export interface MemoryObject {
  id: string;                    // uuid
  ts: number;                    // epoch ms
  session_id?: string | null;    // optional clustering
  app: string;                   // "Safari", "Code", "Apex"
  window_title?: string | null;
  url?: string | null;
  url_host?: string | null;      // "amazon.com", "youtube.com"
  media_path?: string | null;    // file://… (frame) or video segment ref
  thumb_path?: string | null;    // cached thumbnail
  ocr_text: string;              // extracted via Screenpipe OCR
  asr_text?: string | null;      // optional audio transcript
  entities?: string[];           // optional
  topics?: string[];             // optional
}

/**
 * Extended memory object for database storage with embeddings
 */
export interface MemoryObjectWithEmbedding extends MemoryObject {
  embedding?: number[];          // OpenAI text embedding vector
  video_processed?: boolean;     // Whether video processing was attempted
  video_kept?: boolean;          // Whether video file was kept after deduplication
  similarity_score?: number;     // Similarity score from video processing
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
