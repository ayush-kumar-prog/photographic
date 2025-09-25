/**
 * Search API Service
 * Hybrid retrieval + RAG endpoints
 */

import Fastify from 'fastify';
import { SearchService } from './services/search';
import { AnswerService } from './services/answer';
import { logger } from './utils/logger';
import { z } from 'zod';

const server = Fastify({ logger: false });

// Request validation schemas
const SearchRequestSchema = z.object({
  q: z.string().min(1, 'Query cannot be empty'),
  from: z.string().optional(),
  to: z.string().optional(),
  app: z.string().optional(),
  host: z.string().optional(),
  k: z.coerce.number().int().min(1).max(20).optional()
});

const AnswerRequestSchema = z.object({
  q: z.string().min(1, 'Query cannot be empty'),
  topk: z.number().int().min(1).max(10).optional()
});

const RecentRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional()
});

// Services
let searchService: SearchService;
let answerService: AnswerService;

// Health check endpoint
server.get('/health', async (request, reply) => {
  try {
    const stats = await searchService.getStats();
    return {
      status: 'healthy',
      services: {
        search: { status: 'up' },
        answer: { status: 'up' }
      },
      database: {
        total_memories: stats.total_memories,
        unique_apps: stats.unique_apps
      },
      cache: stats.cache_stats,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Health check failed:', error);
    return {
      status: 'degraded',
      services: {
        search: { status: 'error' },
        answer: { status: 'unknown' }
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
});

// Search endpoint
server.get('/search', async (request, reply) => {
  try {
    const validation = SearchRequestSchema.safeParse(request.query);
    if (!validation.success) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validation.error.issues
        },
        timestamp: Date.now()
      });
      return;
    }

    const results = await searchService.search(validation.data);
    return results;
  } catch (error) {
    logger.error('Search error:', error);
    reply.status(500).send({
      error: {
        code: 'SEARCH_ERROR',
        message: 'Search request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: Date.now()
    });
  }
});

// Recent memories endpoint
server.get('/recent', async (request, reply) => {
  try {
    const validation = RecentRequestSchema.safeParse(request.query);
    if (!validation.success) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validation.error.issues
        },
        timestamp: Date.now()
      });
      return;
    }

    const limit = validation.data.limit || 20;
    const memories = await searchService.getRecentMemories(limit);
    return {
      memories,
      count: memories.length,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Recent memories error:', error);
    reply.status(500).send({
      error: {
        code: 'RECENT_ERROR',
        message: 'Failed to fetch recent memories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: Date.now()
    });
  }
});

// Statistics endpoint
server.get('/stats', async (request, reply) => {
  try {
    const stats = await searchService.getStats();
    return {
      ...stats,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('Stats error:', error);
    reply.status(500).send({
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: Date.now()
    });
  }
});

// Answer endpoint (optional RAG)
server.post('/answer', async (request, reply) => {
  try {
    const validation = AnswerRequestSchema.safeParse(request.body);
    if (!validation.success) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.issues
        },
        timestamp: Date.now()
      });
      return;
    }

    const answer = await answerService.generateAnswer(validation.data);
    return answer;
  } catch (error) {
    logger.error('Answer generation error:', error);
    reply.status(500).send({
      error: {
        code: 'ANSWER_ERROR', 
        message: 'Answer generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: Date.now()
    });
  }
});

async function start() {
  try {
    // Initialize services
    searchService = new SearchService();
    answerService = new AnswerService();
    
    await searchService.initialize();
    await answerService.initialize();

    // Start server
    const port = parseInt(process.env.SEARCH_API_PORT || '3032');
    await server.listen({ port, host: '0.0.0.0' });
    
    logger.info(`Search API Service started on port ${port}`);
  } catch (error) {
    logger.error('Failed to start Search API Service:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

if (require.main === module) {
  start();
}

export { server };

