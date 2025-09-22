import { NuggetResult } from './memory';

/**
 * Search request parameters
 */
export interface SearchRequest {
  q: string;
  from?: string;      // ISO date string
  to?: string;        // ISO date string  
  app?: string;       // app filter
  host?: string;      // URL host filter
  k?: number;         // number of results
}

/**
 * Search card result
 */
export interface SearchCard {
  id: string;
  ts: number;
  app: string;
  url_host?: string;
  title_snippet: string;
  thumb_url: string;
  score: number;
  nugget?: NuggetResult;
}

/**
 * Search response with confidence-based mode
 */
export interface SearchResponse {
  mode: 'exact' | 'jog';
  confidence: number;
  cards: SearchCard[];
}

/**
 * Parsed query with extracted intent
 */
export interface ParsedQuery {
  text: string;
  embedding?: number[];
  time_window?: {
    from: string;
    to: string;
  };
  app_hints?: string[];
  topic_hints?: string[];
  answer_field?: string;
  strict?: boolean;
}

/**
 * Search result with scoring components
 */
export interface SearchResult {
  id: string;
  memory: any; // MemoryObject reference
  semanticScore: number;
  ftsScore: number;
  timeDecay: number;
  appBonus: number;
  sourceReliability: number;
  finalScore: number;
}

