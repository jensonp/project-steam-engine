import request from 'supertest';
import express from 'express';
import gameRoutes from '../game.routes';

// Create a minimal Express app just for testing this specific router
const app = express();
app.use(express.json());
app.use('/api/game', gameRoutes);

// Mock the Steam service so we do not actually hit Valve's API during tests
jest.mock('../../services/steam.service', () => ({
  getSteamService: jest.fn().mockReturnValue({
    getAppDetails: jest.fn().mockImplementation(async (appId: number) => {
      // Simulate an API response
      if (appId === 730) {
        return {
          appId: 730,
          name: 'Counter-Strike 2',
          price: 0,
        };
      }
      return null;
    }),
  }),
}));

describe('Game Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/game/:appId', () => {
    it('should return 400 Bad Request if appId is not a valid positive integer string', async () => {
      // This tests the Zod middleware interception
      const response = await request(app).get('/api/game/abc');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.details[0]).toContain('params.appId');
      expect(response.body.details[0]).toContain('positive integer');
    });

    it('should return 404 Not Found if the game does not exist', async () => {
      // 999 is a valid integer, so it passes Zod, but the mock service returns null
      const response = await request(app).get('/api/game/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Game with app ID 999 not found');
    });

    it('should return 200 OK and game data for a valid appId', async () => {
      const response = await request(app).get('/api/game/730');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Counter-Strike 2');
      expect(response.body).toHaveProperty('appId', 730);
    });
  });
});
