import { Router, Request, Response } from 'express';
import { getRecommenderService } from '../services/recommender.service';
import { getSteamService } from '../services/steam.service';
import { SteamApiError } from '../types/steam.types';

const router = Router();

/**
 * GET /api/recommend/similar/:appId
 * Get games similar to a specific game
 */
router.get('/similar/:appId', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.appId, 10);
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  if (isNaN(appId)) {
    res.status(400).json({ error: 'Invalid app ID' });
    return;
  }

  const recommender = getRecommenderService();

  if (!recommender.isReady()) {
    res.status(503).json({ 
      error: 'Recommendation engine not ready. Please run the data pipeline first.',
      instructions: [
        '1. Download steam.csv from Kaggle',
        '2. Run: npx ts-node src/scripts/process-dataset.ts',
        '3. Run: npx ts-node src/scripts/build-recommender.ts',
      ]
    });
    return;
  }

  const similar = recommender.getSimilarGames(appId, limit);
  const gameInfo = recommender.getGameInfo(appId);

  res.json({
    appId,
    name: gameInfo?.name || 'Unknown',
    recommendations: similar,
  });
});

/**
 * GET /api/recommend/user/:steamId
 * Get personalized recommendations based on user's library
 */
router.get('/user/:steamId', async (req: Request, res: Response) => {
  const { steamId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const recommender = getRecommenderService();

  if (!recommender.isReady()) {
    res.status(503).json({ 
      error: 'Recommendation engine not ready',
      instructions: [
        '1. Download steam.csv from Kaggle',
        '2. Run: npx ts-node src/scripts/process-dataset.ts',
        '3. Run: npx ts-node src/scripts/build-recommender.ts',
      ]
    });
    return;
  }

  try {
    // Fetch user's library from Steam API
    const steamService = getSteamService();
    const library = await steamService.getOwnedGames(steamId);

    if (library.games.length === 0) {
      res.json({
        steamId,
        message: 'No games found in library',
        recommendations: [],
      });
      return;
    }

    // Get recommendations based on library
    const ownedGames = library.games.map(g => ({
      appId: g.appId,
      playtimeMinutes: g.playtimeMinutes,
    }));

    const recommendations = recommender.getRecommendationsForLibrary(ownedGames, limit);

    res.json({
      steamId,
      librarySize: library.gameCount,
      recommendations,
    });
  } catch (error) {
    if (error instanceof SteamApiError) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.statusCode,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * POST /api/recommend/bytags
 * Get recommendations based on specified tags
 */
router.post('/bytags', async (req: Request, res: Response) => {
  const { tags, excludeAppIds, limit: requestLimit } = req.body;
  const limit = Math.min(requestLimit || 20, 50);

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    res.status(400).json({ error: 'Tags array is required' });
    return;
  }

  const recommender = getRecommenderService();

  if (!recommender.isReady()) {
    res.status(503).json({ error: 'Recommendation engine not ready' });
    return;
  }

  const recommendations = recommender.getRecommendationsByTags(
    tags,
    excludeAppIds || [],
    limit
  );

  res.json({
    tags,
    recommendations,
  });
});

/**
 * GET /api/recommend/status
 * Check if the recommendation engine is ready
 */
router.get('/status', (req: Request, res: Response) => {
  const recommender = getRecommenderService();

  res.json({
    ready: recommender.isReady(),
    message: recommender.isReady() 
      ? 'Recommendation engine is ready'
      : 'Recommendation engine not initialized. Run the data pipeline.',
  });
});

export default router;
