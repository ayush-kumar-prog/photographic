/**
 * Search API Service
 * Hybrid retrieval + RAG endpoints
 */

import Fastify from 'fastify';
import { SearchService } from './services/search';
import { AnswerService } from './services/answer';
import { logger } from './utils/logger';

const server = Fastify({ logger: false });

// Services
let searchService: SearchService;
let answerService: AnswerService;

// Health check endpoint
server.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    services: {
      search: { status: 'up' },
      answer: { status: 'up' }
    },
    timestamp: Date.now()
  };
});

// Search endpoint
server.get('/search', async (request, reply) => {
  try {
    const query = request.query as any; // TODO: Add proper typing
    const results = await searchService.search(query);
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

// Answer endpoint (optional RAG)
server.post('/answer', async (request, reply) => {
  try {
    const body = request.body as any; // TODO: Add proper typing
    const answer = await answerService.generateAnswer(body);
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
    const port = parseInt(process.env.SEARCH_API_PORT || '3002');
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
