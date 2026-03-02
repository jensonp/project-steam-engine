import { Router, Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();
const searchService = new SearchService();

// Zod Schema: Optional comma-separated genres string
const searchSchema = z.object({
  query: z.object({
    genres: z.string().optional(),
  }),
});

/**
 * GET /api/search
 * Query params:
 * - genres (string): Comma-separated list of genres (e.g. "RPG,Action")
 */
router.get(
  '/',
  validate(searchSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const genresRaw = (req.query.genres as string) || '';
      
      const genreList = genresRaw
        .split(',')
        .map(g => g.trim())
        .filter(g => g.length > 0);
        
      const games = await searchService.searchByGenres(genreList);
      res.json(games);
      
    } catch (error: any) {
      console.error('Search query failed:', error.message);
      res.status(500).json({ error: 'Internal server error during search' });
    }
  }
);

export default router;
