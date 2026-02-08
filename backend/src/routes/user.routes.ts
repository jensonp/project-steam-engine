import { Router, Request, Response } from 'express';
import { getSteamService } from '../services/steam.service';
import { SteamApiError } from '../types/steam.types';

const router = Router();

/**
 * GET /api/user/:steamId/library
 * Fetch a user's game library
 */
router.get('/:steamId/library', async (req: Request, res: Response) => {
  const { steamId } = req.params;
  const includeFreeGames = req.query.includeFreeGames !== 'false';

  try {
    const steamService = getSteamService();
    const library = await steamService.getOwnedGames(
      steamId,
      true,
      includeFreeGames
    );
    res.json(library);
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
 * GET /api/user/:steamId/recent
 * Fetch a user's recently played games
 */
router.get('/:steamId/recent', async (req: Request, res: Response) => {
  const { steamId } = req.params;
  const count = Math.min(parseInt(req.query.count as string) || 10, 100);

  try {
    const steamService = getSteamService();
    const games = await steamService.getRecentlyPlayedGames(steamId, count);
    res.json(games);
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
 * GET /api/user/:steamId/profile
 * Fetch a user's profile summary
 */
router.get('/:steamId/profile', async (req: Request, res: Response) => {
  const { steamId } = req.params;

  try {
    const steamService = getSteamService();
    const profile = await steamService.getPlayerSummary(steamId);
    res.json(profile);
  } catch (error) {
    if (error instanceof SteamApiError) {
      const status = error.statusCode === 404 ? 404 : 500;
      res.status(status).json({
        error: error.message,
        code: error.statusCode,
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
// export