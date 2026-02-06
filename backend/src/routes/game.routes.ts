import { Router, Request, Response } from 'express';
import { getSteamService } from '../services/steam.service';
import { SteamApiError } from '../types/steam.types';

const router = Router();

/**
 * GET /api/game/:appId
 * Fetch detailed information about a game
 */
router.get('/:appId', async (req: Request, res: Response) => {
  const appId = parseInt(req.params.appId, 10);

  if (isNaN(appId)) {
    res.status(400).json({ error: 'Invalid app ID' });
    return;
  }

  try {
    const steamService = getSteamService();
    const game = await steamService.getAppDetails(appId);

    if (!game) {
      res.status(404).json({ error: `Game with app ID ${appId} not found` });
      return;
    }

    res.json(game);
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

export default router;
