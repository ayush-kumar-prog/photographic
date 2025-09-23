import { Database } from 'sqlite3';
import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import { QueryParser } from './query-parser';
import { NuggetExtractor } from './nugget-extractor';
import path from 'path';

// Types
interface SearchRequest {
  q: string;
  from?: string;
  to?: string;
  app?: string;
  host?: string;
  k?: number;
}

interface SearchCard {
  id: string;
  ts: number;
  app: string;
  url_host?: string | null;
  title_snippet: string;
  thumb_url?: string;
  score: number;
  nugget?: NuggetResult | null;
  window_title?: string | null;
  url?: string | null;
}

interface SearchResponse {
  mode: 'exact' | 'jog';
  confidence: number;
  cards: SearchCard[];
  query_parsed?: ParsedQuery;
  timing?: {
    total_ms: number;
    keyword_ms: number;
    semantic_ms: number;
    ranking_ms: number;
  };
}

interface ParsedQuery {
  text: string;
  time_window?: { from: Date; to: Date };
  app_hints: string[];
  topic_hints: string[];
  answer_field?: string;
  strict: boolean;
}

interface NuggetResult {
  type: 'price' | 'score' | 'title' | 'generic';
  value: string;
  confidence: number;
}

interface MemoryRow {
  id: string;
  ts: number;
  app: string;
  url_host: string | null;
  window_title: string | null;
  ocr_text: string;
  media_path: string | null;
  thumb_path: string | null;
}

interface SearchResult {
  memory: MemoryRow;
  semanticScore: number;
  ftsScore: number;
  timeDecay: number;
  appBonus: number;
  sourceReliability: number;
  finalScore: number;
}

// Configuration
const CONFIDENCE_THRESHOLD_HIGH = parseFloat(process.env.CONFIDENCE_T_HIGH || '0.78');
const SEARCH_K = parseInt(process.env.SEARCH_K || '6');
const WEIGHT_SEMANTIC = 0.4;
const WEIGHT_KEYWORD = 0.3;
const WEIGHT_TIME = 0.15;
const WEIGHT_APP = 0.1;
const WEIGHT_SOURCE = 0.05;

export class SearchService {
  private db!: Database;
  private chroma!: ChromaClient;
  private collection!: Collection;
  private openai!: OpenAI;
  private cache: LRUCache<string, SearchResponse>;
  private embeddingCache: LRUCache<string, number[]>;
  private queryParser: QueryParser;
  private nuggetExtractor: NuggetExtractor;

  constructor() {
    // Initialize caches
    this.cache = new LRUCache<string, SearchResponse>({
      max: 1000,
      ttl: 1000 * 60 * 5 // 5 minutes
    });
    
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 500,
      ttl: 1000 * 60 * 30 // 30 minutes
    });

    // Initialize helper services
    this.queryParser = new QueryParser();
    this.nuggetExtractor = new NuggetExtractor();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize SQLite database
      const dbPath = path.join(process.cwd(), '../../data/sqlite/memories.db');
      this.db = new Database(dbPath);
      
      // Initialize ChromaDB
      this.chroma = new ChromaClient({ path: 'http://localhost:8000' });
      
      // Create embedding function
      const embeddingFunction = new OpenAIEmbeddingFunction({
        openai_api_key: process.env.OPENAI_API_KEY!,
        openai_model: 'text-embedding-3-large'
      });
      
      try {
        this.collection = await this.chroma.getCollection({ 
          name: 'mem_text',
          embeddingFunction
        });
      } catch (error) {
        logger.warn('ChromaDB collection not found, creating new one');
        this.collection = await this.chroma.createCollection({ 
          name: 'mem_text',
          metadata: { 'hnsw:space': 'cosine' },
          embeddingFunction
        });
      }
      
      // Initialize OpenAI
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      logger.info('SearchService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SearchService:', error);
      throw error;
    }
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = JSON.stringify(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached search result');
      return cached;
    }

    try {
      // Parse query
      const parsedQuery = await this.parseQuery(request.q, request);
      
      // Perform hybrid search
      const searchResults = await this.hybridSearch(parsedQuery, request.k || SEARCH_K);
      
      // Calculate confidence and determine mode
      const topScore = searchResults.length > 0 ? searchResults[0].finalScore : 0;
      const confidence = Math.min(topScore, 1.0);
      const mode = confidence >= CONFIDENCE_THRESHOLD_HIGH ? 'exact' : 'jog';
      const cardCount = mode === 'exact' ? Math.min(3, searchResults.length) : Math.min(6, searchResults.length);
      
      // Convert to cards with nugget extraction
      const cards = await this.convertToCards(searchResults.slice(0, cardCount));
      
      const totalTime = Date.now() - startTime;
      
      const response: SearchResponse = {
        mode,
        confidence,
        cards,
        query_parsed: parsedQuery,
        timing: {
          total_ms: totalTime,
          keyword_ms: 0, // Will be filled by actual timing
          semantic_ms: 0,
          ranking_ms: 0
        }
      };
      
      // Cache the result
      this.cache.set(cacheKey, response);
      
      logger.info(`Search completed: query="${request.q}", mode=${mode}, confidence=${confidence.toFixed(3)}, results=${cards.length}, time=${totalTime}ms`);
      
      return response;
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  private async parseQuery(queryText: string, request: SearchRequest): Promise<ParsedQuery> {
    return this.queryParser.parseQuery(queryText, request);
  }

  private async hybridSearch(query: ParsedQuery, k: number): Promise<SearchResult[]> {
    const keywordStart = Date.now();
    
    // 1. Keyword search using SQLite FTS5
    const keywordResults = await this.keywordSearch(query, k * 2); // Get more for ranking
    const keywordTime = Date.now() - keywordStart;
    
    const semanticStart = Date.now();
    
    // 2. Semantic search using ChromaDB
    const semanticResults = await this.semanticSearch(query, k * 2);
    const semanticTime = Date.now() - semanticStart;
    
    const rankingStart = Date.now();
    
    // 3. Merge and rank results
    const mergedResults = this.mergeAndRankResults(keywordResults, semanticResults, query);
    const rankingTime = Date.now() - rankingStart;
    
    logger.debug(`Search timing: keyword=${keywordTime}ms, semantic=${semanticTime}ms, ranking=${rankingTime}ms`);
    
    return mergedResults.slice(0, k);
  }

  private async keywordSearch(query: ParsedQuery, limit: number): Promise<Map<string, { memory: MemoryRow; score: number }>> {
    return new Promise((resolve, reject) => {
      const results = new Map<string, { memory: MemoryRow; score: number }>();
      
      // Build SQL query with filters
      let sql = `
        SELECT m.*, 
               bm25(memories_fts) as fts_score
        FROM memories_fts 
        JOIN memories m ON memories_fts.id = m.id
        WHERE memories_fts MATCH ?
      `;
      
      const params: any[] = [query.text];
      
      // Add time filter
      if (query.time_window) {
        sql += ' AND m.ts BETWEEN ? AND ?';
        params.push(query.time_window.from.getTime());
        params.push(query.time_window.to.getTime());
      }
      
      // Add app filter
      if (query.app_hints.length > 0) {
        const appPlaceholders = query.app_hints.map(() => '?').join(',');
        sql += ` AND m.app IN (${appPlaceholders})`;
        params.push(...query.app_hints);
      }
      
      sql += ' ORDER BY fts_score DESC LIMIT ?';
      params.push(limit);
      
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        for (const row of rows) {
          results.set(row.id, {
            memory: {
              id: row.id,
              ts: row.ts,
              app: row.app,
              url_host: row.url_host,
              window_title: row.window_title,
              ocr_text: row.ocr_text,
              media_path: row.media_path,
              thumb_path: row.thumb_path
            },
            score: row.fts_score || 0
          });
        }
        
        resolve(results);
      });
    });
  }

  private async semanticSearch(query: ParsedQuery, limit: number): Promise<Map<string, { memory: MemoryRow; score: number }>> {
    try {
      // Get or generate embedding for query
      let queryEmbedding = this.embeddingCache.get(query.text);
      if (!queryEmbedding) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: query.text,
          encoding_format: 'float'
        });
        queryEmbedding = response.data[0].embedding;
        this.embeddingCache.set(query.text, queryEmbedding);
      }
      
      // Build where clause for ChromaDB
      const where: any = {};
      if (query.time_window) {
        where.ts = {
          $gte: query.time_window.from.getTime(),
          $lte: query.time_window.to.getTime()
        };
      }
      
      if (query.app_hints.length > 0) {
        where.app = { $in: query.app_hints };
      }
      
      // Query ChromaDB
      const chromaResults = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: Object.keys(where).length > 0 ? where : undefined
      });
      
      const results = new Map<string, { memory: MemoryRow; score: number }>();
      
      if (chromaResults.ids && chromaResults.ids[0] && chromaResults.distances && chromaResults.metadatas) {
        const ids = chromaResults.ids[0];
        const distances = chromaResults.distances[0];
        const metadatas = chromaResults.metadatas[0];
        
        // Get full memory objects from SQLite
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const similarity = 1 - (distances[i] || 1); // Convert distance to similarity
          
          // Get full memory object from SQLite
          const memory = await this.getMemoryById(id);
          if (memory) {
            results.set(id, { memory, score: similarity });
          }
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Semantic search failed:', error);
      return new Map();
    }
  }

  private async getMemoryById(id: string): Promise<MemoryRow | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM memories WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!row) {
            resolve(null);
            return;
          }
          
          resolve({
            id: row.id,
            ts: row.ts,
            app: row.app,
            url_host: row.url_host,
            window_title: row.window_title,
            ocr_text: row.ocr_text,
            media_path: row.media_path,
            thumb_path: row.thumb_path
          });
        }
      );
    });
  }

  private mergeAndRankResults(
    keywordResults: Map<string, { memory: MemoryRow; score: number }>,
    semanticResults: Map<string, { memory: MemoryRow; score: number }>,
    query: ParsedQuery
  ): SearchResult[] {
    const allResults = new Map<string, SearchResult>();
    const now = Date.now();
    
    // Process keyword results
    for (const [id, result] of keywordResults) {
      const timeDecay = this.calculateTimeDecay(result.memory.ts, now);
      const appBonus = this.calculateAppBonus(result.memory.app, query.app_hints);
      const sourceReliability = this.calculateSourceReliability(result.memory);
      
      allResults.set(id, {
        memory: result.memory,
        semanticScore: 0,
        ftsScore: result.score,
        timeDecay,
        appBonus,
        sourceReliability,
        finalScore: 0 // Will be calculated below
      });
    }
    
    // Process semantic results
    for (const [id, result] of semanticResults) {
      const existing = allResults.get(id);
      const timeDecay = this.calculateTimeDecay(result.memory.ts, now);
      const appBonus = this.calculateAppBonus(result.memory.app, query.app_hints);
      const sourceReliability = this.calculateSourceReliability(result.memory);
      
      if (existing) {
        // Update existing result with semantic score
        existing.semanticScore = result.score;
      } else {
        // Add new result
        allResults.set(id, {
          memory: result.memory,
          semanticScore: result.score,
          ftsScore: 0,
          timeDecay,
          appBonus,
          sourceReliability,
          finalScore: 0
        });
      }
    }
    
    // Calculate final scores
    for (const result of allResults.values()) {
      result.finalScore = (
        WEIGHT_SEMANTIC * result.semanticScore +
        WEIGHT_KEYWORD * result.ftsScore +
        WEIGHT_TIME * result.timeDecay +
        WEIGHT_APP * result.appBonus +
        WEIGHT_SOURCE * result.sourceReliability
      );
    }
    
    // Sort by final score
    return Array.from(allResults.values())
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  private calculateTimeDecay(timestamp: number, now: number): number {
    const ageHours = (now - timestamp) / (1000 * 60 * 60);
    // Exponential decay: more recent = higher score
    return Math.exp(-ageHours / (24 * 7)); // Half-life of 1 week
  }

  private calculateAppBonus(app: string, appHints: string[]): number {
    if (appHints.length === 0) return 0.5; // Neutral
    return appHints.some(hint => 
      app.toLowerCase().includes(hint.toLowerCase()) ||
      hint.toLowerCase().includes(app.toLowerCase())
    ) ? 1.0 : 0.0;
  }

  private calculateSourceReliability(memory: MemoryRow): number {
    // Higher reliability for structured sources
    if (memory.url_host) {
      const knownSites = ['amazon.com', 'youtube.com', 'github.com', 'stackoverflow.com'];
      if (knownSites.some(site => memory.url_host?.includes(site))) {
        return 1.0;
      }
      return 0.8; // Other websites
    }
    
    // App-based reliability
    const reliableApps = ['Safari', 'Chrome', 'Firefox', 'Code'];
    if (reliableApps.includes(memory.app)) {
      return 0.7;
    }
    
    return 0.5; // Default
  }

  private async convertToCards(results: SearchResult[]): Promise<SearchCard[]> {
    const cards: SearchCard[] = [];
    
    for (const result of results) {
      const memory = result.memory;
      
      // Extract nugget
      const nugget = this.nuggetExtractor.extractNugget(memory.ocr_text, memory.app, memory.url_host);
      
      // Generate title snippet
      const titleSnippet = this.generateTitleSnippet(memory, nugget);
      
      // Generate thumbnail URL
      const thumbUrl = memory.thumb_path ? `file://${memory.thumb_path}` : undefined;
      
      cards.push({
        id: memory.id,
        ts: memory.ts,
        app: memory.app,
        url_host: memory.url_host,
        title_snippet: titleSnippet,
        thumb_url: thumbUrl,
        score: result.finalScore,
        nugget,
        window_title: memory.window_title,
        url: memory.url_host ? `https://${memory.url_host}` : undefined
      });
    }
    
    return cards;
  }

  private generateTitleSnippet(memory: MemoryRow, nugget: NuggetResult | null): string {
    if (nugget) {
      return nugget.value;
    }
    
    // Use window title if available and meaningful
    if (memory.window_title && memory.window_title.length > 5 && memory.window_title.length < 100) {
      return memory.window_title;
    }
    
    // Extract first meaningful line from OCR
    const lines = memory.ocr_text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5);
    
    if (lines.length > 0) {
      const firstLine = lines[0];
      return firstLine.length > 80 ? firstLine.substring(0, 77) + '...' : firstLine;
    }
    
    return `${memory.app} - ${new Date(memory.ts).toLocaleString()}`;
  }

  async getRecentMemories(limit: number = 20): Promise<SearchCard[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM memories ORDER BY ts DESC LIMIT ?',
        [limit],
        async (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          
          const memories: MemoryRow[] = rows.map(row => ({
            id: row.id,
            ts: row.ts,
            app: row.app,
            url_host: row.url_host,
            window_title: row.window_title,
            ocr_text: row.ocr_text,
            media_path: row.media_path,
            thumb_path: row.thumb_path
          }));
          
          const cards = await this.convertToCards(
            memories.map(memory => ({
              memory,
              semanticScore: 0,
              ftsScore: 0,
              timeDecay: 1,
              appBonus: 0.5,
              sourceReliability: 0.5,
              finalScore: 1
            }))
          );
          
          resolve(cards);
        }
      );
    });
  }

  async getStats(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          COUNT(*) as total_memories,
          COUNT(DISTINCT app) as unique_apps,
          MIN(ts) as oldest_memory,
          MAX(ts) as newest_memory,
          app,
          COUNT(*) as app_count
        FROM memories 
        GROUP BY app
        ORDER BY app_count DESC
      `, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const totalRow = rows[0];
        const appCounts = rows.map(row => ({ app: row.app, count: row.app_count }));
        
        resolve({
          total_memories: totalRow?.total_memories || 0,
          unique_apps: totalRow?.unique_apps || 0,
          oldest_memory: totalRow?.oldest_memory,
          newest_memory: totalRow?.newest_memory,
          app_distribution: appCounts,
          cache_stats: {
            search_cache_size: this.cache.size,
            embedding_cache_size: this.embeddingCache.size
          }
        });
      });
    });
  }
}