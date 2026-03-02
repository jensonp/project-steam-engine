import { Router, Request, Response } from 'express';
import { getRecommenderService } from '../services/recommender.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// --- Zod Validation Schemas ---

const similarGamesSchema = z.object({
  params: z.object({
    appId: z.string().regex(/^\d+$/, 'appId must be a positive integer'),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
  }),
});

const userRecommendationsSchema = z.object({
  params: z.object({
    steamId: z
      .string()
      .length(17, 'Steam ID must be exactly 17 characters')
      .regex(/^\d+$/, 'Steam ID must be numeric'),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
  }),
});

const byTagsSchema = z.object({
  body: z.object({
    tags: z.array(z.string()).min(1, 'You must provide at least one tag'),
    limit: z.number().int().positive('limit must be a positive integer').optional(),
  }),
});

// --- Routes ---

/**
 * GET /api/recommend/status
 */
router.get('/status', (req: Request, res: Response): void => {
  try {
    const recommender = getRecommenderService();
    res.json({
      ready: recommender.isReady(),
      status: recommender.isReady() ? 'Online' : 'Loading or error',
    });
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      error: error.message,
      instructions: [
        "1. Download steam.csv from Kaggle to data/raw/",
        "2. Run: npm run data:process",
        "3. Run: npm run data:build-recommender"
      ]
    });
  }
});

/**
 * GET /api/recommend/similar/:appId
 */
router.get(
  '/similar/:appId',
  validate(similarGamesSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();
      
      if (!recommender.isReady()) {
        res.status(503).json({ error: 'Recommendation engine not ready' });
        return;
      }

      const appId = parseInt(req.params.appId, 10);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const recommendations = recommender.getSimilarGames(appId, limit);
      
      if (recommendations.length === 0) {
        res.status(404).json({ error: `No recommendations found for app ID ${appId}` });
        return;
      }

      res.json(recommendations);
    } catch (error: any) {
      if (error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    }
  }
);

/**
 * GET /api/recommend/user/:steamId
 */
router.get(
  '/user/:steamId',
  validate(userRecommendationsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();
      
      if (!recommender.isReady()) {
        res.status(503).json({ error: 'Recommendation engine not ready' });
        return;
      }

      const steamId = req.params.steamId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      // 1. Fetch user library from Steam
      const { getSteamService } = require('../services/steam.service');
      const steamService = getSteamService();
      const library = await steamService.getOwnedGames(steamId);

      // 2. Map to the format RecommenderService expects
      const ownedGames = library.map((g: any) => ({
        appId: g.appId,
        playtimeMinutes: g.playtimeForever,
      }));

      // 3. Get recommendations
      const recommendations = recommender.getRecommendationsForLibrary(ownedGames, limit);
      res.json(recommendations);
    } catch (error: any) {
      if (error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        console.error('User recommendation error:', error);
        res.status(500).json({ error: 'Failed to generate recommendations', details: error.message });
      }
    }
  }
);

/**
 * POST /api/recommend/bytags
 */
router.post(
  '/bytags',
  validate(byTagsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();
      
      if (!recommender.isReady()) {
        res.status(503).json({ error: 'Recommendation engine not ready' });
        return;
      }

      const { tags, limit = 10 } = req.body;
      const recommendations = recommender.getRecommendationsByTags(tags, limit);
      res.json(recommendations);
    } catch (error: any) {
      if (error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    }
  }
);

export default router;
