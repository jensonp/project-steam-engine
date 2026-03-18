import { Router, Request, Response } from 'express';
import { getRecommenderService } from '../services/recommender.service';
import { buildUserProfile, scoreWithUserContext } from '../services/user-profile.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { query } from '../config/db';
import { ScoredRecommendation, UserProfile } from '../types/steam.types';

const router = Router();

interface FallbackRow {
  app_id: number;
  game_name: string;
  genres: string | null;
  tags: string | null;
  header_image: string | null;
  short_description: string | null;
  price: string | null;
}

async function getFallbackPopularRecommendations(
  profile: UserProfile,
  limit: number
): Promise<ScoredRecommendation[]> {
  const ownedAppIds = profile.library.map((g) => g.appId);
  const sql = `
    SELECT app_id, game_name, genres, tags, header_image, short_description, price
    FROM games
    WHERE NOT (app_id = ANY($1::int[]))
    ORDER BY positive_votes DESC
    LIMIT $2
  `;

  const result = await query<FallbackRow>(sql, [ownedAppIds, limit]);

  return result.rows.map((row) => {
    const priceValue = row.price === null ? null : Number(row.price);
    const isFree = priceValue !== null ? priceValue === 0 : false;

    return {
      appId: row.app_id,
      name: row.game_name,
      score: 0,
      jaccardScore: 0,
      genreAlignmentScore: 0,
      socialScore: 0,
      reason: 'Popular on Steam (fallback while personalized engine is initializing)',
      headerImage: row.header_image,
      genres: row.genres ? row.genres.split(',').map((g) => g.trim()).filter(Boolean) : [],
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      description: row.short_description,
      price: priceValue,
      isFree,
      developers: [],
      publishers: [],
      releaseDate: null,
    };
  });
}

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

      const steamId = req.params.steamId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      // Build a full user profile (playtime vector + friend graph)
      const profile = await buildUserProfile(steamId);

      if (profile.library.length === 0) {
        res.status(404).json({
          error: 'Could not load Steam library. Profile may be private.',
        });
        return;
      }

      if (!recommender.isReady()) {
        const fallbackRecommendations = await getFallbackPopularRecommendations(profile, limit);
        res.json(fallbackRecommendations);
        return;
      }

      // Score candidates using the 3-signal composite engine
      const recommendations = await scoreWithUserContext(steamId, profile, limit);
      res.json(recommendations);

    } catch (error: any) {
      console.error('User recommendation error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations', details: error.message });
    }
  }
);

/**
 * GET /api/recommend/user/:steamId/profile
 * Returns the aggregated user profile: genre vector, friend overlap stats, top genres.
 */
router.get(
  '/user/:steamId/profile',
  validate(userRecommendationsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const steamId = req.params.steamId;
      const profile = await buildUserProfile(steamId);

      // Serialize the profile for JSON — strip the internal Sets/Maps
      res.json({
        steamId: profile.steamId,
        personaName: profile.personaName,
        avatar: profile.avatar,
        librarySize: profile.librarySize,
        recentGamesCount: profile.recentGamesCount,
        topGenres: profile.topGenres,
        friendsAnalyzed: profile.friendsAnalyzed,
        friendOverlapGames: profile.friendOverlapGames,
      });
    } catch (error: any) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to build user profile', details: error.message });
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
