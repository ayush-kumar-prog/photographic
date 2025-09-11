/**
 * Utility functions shared across services
 */

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

export function parseUrlHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function sanitizeForSQLite(text: string): string {
  // Remove null bytes and other problematic characters
  return text.replace(/\0/g, '').replace(/[\r\n\t]/g, ' ').trim();
}

export function calculateTimeDecay(ts: number, maxDays: number = 90): number {
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - (ageDays / maxDays));
}

export function extractDominantColors(imagePath: string): Promise<string[]> {
  // Placeholder for image color extraction
  // Would use sharp or similar library in implementation
  return Promise.resolve(['#ffffff', '#000000']);
}
