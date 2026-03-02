import { Router, Request, Response } from 'express';
import { getSteamService } from '../services/steam.service';
import { SteamApiError } from '../types/steam.types';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// Zod Schema: SteamIDs must be exactly 17 numerical characters
const steamIdSchema = z.object({
  params: z.object({
    steamId: z
      .string()
      .length(17, 'Steam ID must be exactly 17 characters long')
      .regex(/^\d+$/, 'Steam ID must contain only numbers'),
  }),
});

/**
 * GET /api/user/:steamId/library
 * Fetch a user's game library
 */
router.get(
  '/:steamId/library',
  validate(steamIdSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const includeFreeGames = req.query.includeFreeGames !== 'false';
      const steamService = getSteamService();
      const library = await steamService.getOwnedGames(
        req.params.steamId,
        true,
        includeFreeGames
      );
      res.json(library);
    } catch (error: any) {
      if (error instanceof SteamApiError) {
        res.status(error.statusCode || 500).json({
          error: error.message,
          code: error.statusCode,
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
);

/**
 * GET /api/user/:steamId/recent
 * Fetch a user's recently played games
 */
router.get(
  '/:steamId/recent',
  validate(steamIdSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 100);
      const steamService = getSteamService();
      const games = await steamService.getRecentlyPlayedGames(req.params.steamId, count);
      res.json(games);
    } catch (error: any) {
      if (error instanceof SteamApiError) {
        res.status(error.statusCode || 500).json({
          error: error.message,
          code: error.statusCode,
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
);

/**
 * GET /api/user/:steamId/profile
 * Fetch a user's profile summary
 */
router.get(
  '/:steamId/profile',
  validate(steamIdSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const steamService = getSteamService();
      const profile = await steamService.getPlayerSummary(req.params.steamId);
      res.json(profile);
    } catch (error: any) {
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
  }
);

export default router;