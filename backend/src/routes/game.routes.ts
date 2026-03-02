import { Router, Request, Response } from 'express';
import { getSteamService } from '../services/steam.service';
import { SteamApiError } from '../types/steam.types';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// Zod Schema defines the exact shape of valid traffic
const getGameParamsSchema = z.object({
  params: z.object({
    appId: z.string().regex(/^\d+$/, 'appId must be a positive integer'),
  }),
});

/**
 * GET /api/game/:appId
 * Fetch detailed information about a game
 */
router.get(
  '/:appId',
  validate(getGameParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const appId = parseInt(req.params.appId, 10);
      const steamService = getSteamService();
      const game = await steamService.getAppDetails(appId);

      if (!game) {
        res.status(404).json({ error: `Game with app ID ${appId} not found` });
        return;
      }

      res.json(game);
    } catch (error: any) {
      if (error instanceof SteamApiError) {
        res.status(error.statusCode || 500).json({
          error: error.message,
          code: error.statusCode,
        });
      } else {
        console.error(`Failed to fetch game ${req.params.appId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
);

export default router;
