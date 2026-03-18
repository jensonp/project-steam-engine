import { Router, Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const searchService = new SearchService();

const dbUnavailableCodes = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '08001',
  '08006',
  '28P01',
]);

function isDbUnavailable(code: string, message: string): boolean {
  const m = message.toLowerCase();
  return (
    dbUnavailableCodes.has(code) ||
    m.includes('connect econnrefused') ||
    m.includes('timeout exceeded when trying to connect') ||
    m.includes('connection terminated unexpectedly') ||
    m.includes('getaddrinfo enotfound')
  );
}

// Zod Schema: Optional parameters
const searchSchema = z.object({
  query: z.object({
    genres: z.string().optional(),
    keyword: z.string().optional(),
    playerCount: z.string().optional(),
    os: z.enum(['windows', 'mac', 'linux']).optional(),
  }),
});

/**
 * GET /api/search
 * Query params:
 * - genres (string): Comma-separated list of genres (e.g. "RPG,Action")
 * - keyword (string): Text search across title and description
 * - playerCount (string): Filter for Multiplayer, Singleplayer, etc.
 * - os (string): Filter for native OS support (windows | mac | linux)
 */
router.get(
  '/',
  validate(searchSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const queryData = req.query as z.infer<typeof searchSchema>['query'];
      
      // Extract properties directly based on the Zod schema
      const genresRaw = queryData.genres || '';
      const keyword = queryData.keyword || '';
      const playerCount = queryData.playerCount || '';
      const os = queryData.os;
      
      const genreList = genresRaw
        .split(',')
        .map(g => g.trim())
        .filter(g => g.length > 0);
        
      const games = await searchService.searchByGenres(genreList, keyword, playerCount, os);
      res.json(games);
      
    } catch (error: any) {
      const message = error?.message ? String(error.message) : String(error ?? '');
      const code = error?.code ? String(error.code) : '';

      // Log the full object to keep deployment diagnostics actionable.
      console.error('Search query failed:', error);

      if (isDbUnavailable(code, message)) {
        res.status(503).json({
          error: 'Search database is unavailable. Configure PostgreSQL connection variables.',
          code: code || 'DB_UNAVAILABLE',
        });
        return;
      }

      if (code === '42P01' || message.toLowerCase().includes('relation "games" does not exist')) {
        res.status(503).json({
          error: 'Search index is not initialized. Create and populate the games table first.',
          code: code || '42P01',
        });
        return;
      }

      if (
        code === '42883' ||
        message.toLowerCase().includes('operator does not exist') ||
        message.toLowerCase().includes('gin_trgm_ops')
      ) {
        res.status(503).json({
          error: 'Database text-search extensions are missing (pg_trgm).',
          code: code || '42883',
        });
        return;
      }

      res.status(500).json({
        error: 'Internal server error during search',
        details: message || 'Unknown error',
      });
    }
  }
);

export default router;
