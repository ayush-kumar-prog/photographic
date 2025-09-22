import { z } from 'zod';

/**
 * Zod schemas for runtime validation
 */

export const MemoryObjectSchema = z.object({
  id: z.string().uuid(),
  ts: z.number().int().positive(),
  session_id: z.string().uuid().optional(),
  app: z.string().min(1),
  window_title: z.string().optional(),
  url: z.string().url().optional(),
  url_host: z.string().optional(),
  media_path: z.string().optional(),
  thumb_path: z.string().optional(),
  ocr_text: z.string(),
  asr_text: z.string().nullable().optional(),
  entities: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
});

export const SearchRequestSchema = z.object({
  q: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  app: z.string().optional(),
  host: z.string().optional(),
  k: z.number().int().min(1).max(20).optional(),
});

export const SearchCardSchema = z.object({
  id: z.string().uuid(),
  ts: z.number().int().positive(),
  app: z.string(),
  url_host: z.string().optional(),
  title_snippet: z.string(),
  thumb_url: z.string(),
  score: z.number().min(0).max(1),
  nugget: z.object({
    type: z.enum(['price', 'score', 'title', 'generic']),
    value: z.string(),
    confidence: z.number().min(0).max(1),
  }).optional(),
});

export const SearchResponseSchema = z.object({
  mode: z.enum(['exact', 'jog']),
  confidence: z.number().min(0).max(1),
  cards: z.array(SearchCardSchema),
});

