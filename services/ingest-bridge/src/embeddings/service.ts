import OpenAI from 'openai';
import { ChromaClient, Collection } from 'chromadb';
import * as fs from 'fs';
import * as path from 'path';
import PQueue from 'p-queue';
import { logger } from '../utils/logger';
import { MemoryObjectWithEmbedding } from '../types/memory';

interface EmbeddingBatch {
  texts: string[];
  ids: string[];
  metadatas: any[];
}

export class EmbeddingsService {
  private openai: OpenAI | null = null;
  private chroma: ChromaClient | null = null;
  private collection: Collection | null = null;
  private queue: PQueue;
  private isInitialized: boolean = false;
  private chromaDataDir: string;
  
  // Configuration
  private readonly EMBEDDING_MODEL = 'text-embedding-3-large';
  private readonly COLLECTION_NAME = 'mem_text';
  private readonly BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per request
  private readonly MAX_CONCURRENT = 3; // Rate limiting
  private readonly RETRY_ATTEMPTS = 3;

  constructor(chromaDataDir: string = '../../data/chroma') {
    // If running from services/ingest-bridge/dist, go up to project root
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
    this.chromaDataDir = path.resolve(projectRoot, 'data/chroma');
    this.queue = new PQueue({ 
      concurrency: this.MAX_CONCURRENT,
      interval: 1000, // 1 second
      intervalCap: 10 // Max 10 requests per second
    });
  }

  async initialize(): Promise<void> {
    try {
      // Initialize OpenAI client
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      this.openai = new OpenAI({ apiKey });
      logger.info('OpenAI client initialized');

      // Test OpenAI connection with a small embedding
      try {
        await this.generateEmbedding('test connection');
        logger.info('OpenAI embedding test successful');
      } catch (error) {
        logger.error('OpenAI embedding test failed:', error);
        throw new Error(`OpenAI connection failed: ${error}`);
      }

      // Initialize Chroma client
      await this.initializeChroma();

      this.isInitialized = true;
      logger.info('EmbeddingsService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EmbeddingsService:', error);
      throw error;
    }
  }

  private async initializeChroma(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.chromaDataDir)) {
        fs.mkdirSync(this.chromaDataDir, { recursive: true });
        logger.info('Created Chroma data directory', { dataDir: this.chromaDataDir });
      }

      // Initialize Chroma client - use in-memory for now (can be changed to server mode later)
      this.chroma = new ChromaClient();

      // Create or get collection
      try {
        this.collection = await this.chroma.getOrCreateCollection({
          name: this.COLLECTION_NAME,
          metadata: {
            "hnsw:space": "cosine",
            "hnsw:construction_ef": 200,
            "hnsw:M": 16
          }
        });
        logger.info('Connected to Chroma collection', { name: this.COLLECTION_NAME });
      } catch (error) {
        logger.error('Failed to create/get Chroma collection:', error);
        throw error;
      }

      // Test collection
      const count = await this.collection.count();
      logger.info('Chroma collection ready', { 
        name: this.COLLECTION_NAME, 
        documentCount: count 
      });
    } catch (error) {
      logger.error('Failed to initialize Chroma:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Truncate text if too long (OpenAI has token limits)
    const truncatedText = this.truncateText(text, 8000); // Conservative limit

    return this.queue.add(async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
        try {
          logger.debug('Generating embedding', { 
            textLength: truncatedText.length,
            attempt,
            model: this.EMBEDDING_MODEL
          });

          const startTime = Date.now();
          const response = await this.openai!.embeddings.create({
            model: this.EMBEDDING_MODEL,
            input: truncatedText,
            encoding_format: 'float',
          });

          const duration = Date.now() - startTime;
          const embedding = response.data[0].embedding;

          logger.debug('Embedding generated successfully', {
            textLength: truncatedText.length,
            embeddingDimensions: embedding.length,
            duration: `${duration}ms`,
            tokensUsed: response.usage?.total_tokens || 'unknown'
          });

          return embedding;
        } catch (error: any) {
          lastError = error;
          logger.warn(`Embedding generation attempt ${attempt} failed:`, error.message);
          
          // If rate limited, wait longer
          if (error.status === 429) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
            logger.info(`Rate limited, waiting ${waitTime}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (attempt === this.RETRY_ATTEMPTS) {
            break; // Don't retry on non-rate-limit errors on final attempt
          }
        }
      }

      logger.error('Failed to generate embedding after all retries:', lastError);
      throw new Error(`Embedding generation failed: ${lastError?.message}`);
    }) as Promise<number[]>;
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    if (texts.length === 0) {
      return [];
    }

    // Process in batches
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      const batch = texts.slice(i, i + this.BATCH_SIZE);
      const truncatedBatch = batch.map(text => this.truncateText(text, 8000));
      
      const batchEmbeddings = await this.queue.add(async () => {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
          try {
            logger.debug('Generating batch embeddings', { 
              batchSize: truncatedBatch.length,
              attempt,
              model: this.EMBEDDING_MODEL
            });

            const startTime = Date.now();
            const response = await this.openai!.embeddings.create({
              model: this.EMBEDDING_MODEL,
              input: truncatedBatch,
              encoding_format: 'float',
            });

            const duration = Date.now() - startTime;
            const embeddings = response.data.map(item => item.embedding);

            logger.debug('Batch embeddings generated successfully', {
              batchSize: truncatedBatch.length,
              embeddingDimensions: embeddings[0]?.length || 0,
              duration: `${duration}ms`,
              tokensUsed: response.usage?.total_tokens || 'unknown'
            });

            return embeddings;
          } catch (error: any) {
            lastError = error;
            logger.warn(`Batch embedding attempt ${attempt} failed:`, error.message);
            
            if (error.status === 429) {
              const waitTime = Math.pow(2, attempt) * 1000;
              logger.info(`Rate limited, waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (attempt === this.RETRY_ATTEMPTS) {
              break;
            }
          }
        }

        throw new Error(`Batch embedding generation failed: ${lastError?.message}`);
      });

      results.push(...(batchEmbeddings as number[][]));
    }

    return results;
  }

  async storeEmbedding(memoryObject: MemoryObjectWithEmbedding): Promise<void> {
    if (!this.collection) {
      throw new Error('Chroma collection not initialized');
    }

    if (!memoryObject.embedding) {
      throw new Error('Memory object must have embedding');
    }

    try {
      logger.debug('Storing embedding in Chroma', {
        id: memoryObject.id,
        app: memoryObject.app,
        embeddingDimensions: memoryObject.embedding.length
      });

      await this.collection.add({
        ids: [memoryObject.id],
        embeddings: [memoryObject.embedding],
        metadatas: [{
          ts: memoryObject.ts,
          app: memoryObject.app,
          url_host: memoryObject.url_host || '',
          window_title: memoryObject.window_title || '',
          media_path: memoryObject.media_path || '',
          thumb_path: memoryObject.thumb_path || '',
          video_processed: memoryObject.video_processed || false,
          video_kept: memoryObject.video_kept !== false,
          similarity_score: memoryObject.similarity_score || 0.0
        }],
        documents: [memoryObject.ocr_text]
      });

      logger.debug('Embedding stored successfully in Chroma', { id: memoryObject.id });
    } catch (error) {
      logger.error('Failed to store embedding in Chroma:', error);
      throw error;
    }
  }

  async searchSimilar(
    queryEmbedding: number[], 
    limit: number = 10,
    filters?: { [key: string]: any }
  ): Promise<{
    ids: string[];
    distances: number[];
    metadatas: any[];
    documents: string[];
  }> {
    if (!this.collection) {
      throw new Error('Chroma collection not initialized');
    }

    try {
      logger.debug('Searching similar embeddings', { 
        embeddingDimensions: queryEmbedding.length,
        limit,
        filters
      });

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: filters,
        include: ['metadata', 'documents', 'distances'] as any
      });

      logger.debug('Similar embeddings found', {
        resultCount: results.ids[0]?.length || 0
      });

      return {
        ids: results.ids[0] || [],
        distances: results.distances?.[0] || [],
        metadatas: results.metadatas?.[0] || [],
        documents: (results.documents?.[0] || []).filter((doc): doc is string => doc !== null)
      };
    } catch (error) {
      logger.error('Failed to search similar embeddings:', error);
      throw error;
    }
  }

  async getCollectionStats(): Promise<{
    count: number;
    sampleMetadata?: any;
  }> {
    if (!this.collection) {
      throw new Error('Chroma collection not initialized');
    }

    try {
      const count = await this.collection.count();
      
      let sampleMetadata = null;
      if (count > 0) {
        const sample = await this.collection.peek({ limit: 1 });
        sampleMetadata = sample.metadatas?.[0];
      }

      return { count, sampleMetadata };
    } catch (error) {
      logger.error('Failed to get collection stats:', error);
      throw error;
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Truncate at word boundary if possible
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) { // Only use word boundary if it's not too short
      return truncated.substring(0, lastSpace);
    }
    
    return truncated;
  }

  getQueueStats(): {
    size: number;
    pending: number;
    isPaused: boolean;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    };
  }

  isReady(): boolean {
    return this.isInitialized && !!this.openai && !!this.collection;
  }
}
