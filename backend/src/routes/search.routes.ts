import { Router, Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const searchService = new SearchService();

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
      console.error('Search query failed:', error.message);
      res.status(500).json({ error: 'Internal server error during search' });
    }
  }
);

export default router;
