/**
 * Layer 2: Route Integration Tests — Search Routes
 *
 * Key engineering decisions:
 * 1. We use `supertest` to spin up a real in-memory Express server.
 *    This tests the FULL router → middleware → service chain, not just isolated functions.
 * 2. We mock `SearchService` at the module boundary. The Zod middleware runs
 *    for real — only the downstream DB call is swapped out.
 * 3. We capture the mock instance at construction time so every test
 *    can directly access `mockSearchByGenres`.
 */

import request from 'supertest';
import express from 'express';

// ─── Capture the mock instance at construction time ───────────────────────────
// The elite pattern: save the fn at module scope so we never need to traverse
// jest.mock.results[], which has construction-timing issues.
const mockSearchByGenres = jest.fn().mockResolvedValue([
  { appId: 730, name: 'Counter-Strike 2', genres: ['Action', 'Free to Play'] },
]);

jest.mock('../../services/search.service', () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    searchByGenres: mockSearchByGenres,
  })),
}));

// Import AFTER mock registration — Jest hoisting requires this order
import searchRoutes from '../search.routes';

const app = express();
app.use(express.json());
app.use('/', searchRoutes);

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('Search Routes — GET /', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default success response before each test
    mockSearchByGenres.mockResolvedValue([
      { appId: 730, name: 'Counter-Strike 2', genres: ['Action', 'Free to Play'] },
    ]);
  });

  // ── Layer A: Zod Middleware Validation ─────────────────────────────────────
  // These tests prove the Zod middleware correctly rejects/passes inputs
  // BEFORE ever reaching the service layer.
  describe('Input Validation (Zod Middleware)', () => {
    it('should return 200 even when no query params are provided (all optional)', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });

    it('should return 200 with a valid genres string', async () => {
      const response = await request(app).get('/?genres=RPG');
      expect(response.status).toBe(200);
    });

    it('should return 200 with genres, keyword, and playerCount combined', async () => {
      const response = await request(app).get('/?genres=Action&keyword=zombie&playerCount=Multiplayer');
      expect(response.status).toBe(200);
    });

    it('should return 200 with a valid os filter', async () => {
      const response = await request(app).get('/?genres=Action&os=windows');
      expect(response.status).toBe(200);
    });

    it('should return 400 for an invalid os filter', async () => {
      const response = await request(app).get('/?os=android');
      expect(response.status).toBe(400);
    });
  });

  // ── Layer B: Service Delegation ─────────────────────────────────────────────
  // Proves the router correctly extracts and maps query params before passing
  // them down to the service. Catches silent param-dropping bugs.
  describe('Parameter Delegation to SearchService', () => {
    it('should pass a comma-separated genres string as a parsed array to the service', async () => {
      await request(app).get('/?genres=RPG,Action');
      expect(mockSearchByGenres).toHaveBeenCalledWith(['RPG', 'Action'], '', '', undefined);
    });

    it('should pass keyword and playerCount to the service when provided', async () => {
      await request(app).get('/?genres=Horror&keyword=vampire&playerCount=Singleplayer');
      expect(mockSearchByGenres).toHaveBeenCalledWith(['Horror'], 'vampire', 'Singleplayer', undefined);
    });

    it('should pass an empty genres array when genres param is omitted', async () => {
      await request(app).get('/?keyword=crafting');
      expect(mockSearchByGenres).toHaveBeenCalledWith([], 'crafting', '', undefined);
    });

    it('should pass os to the service when provided', async () => {
      await request(app).get('/?genres=Action&os=linux');
      expect(mockSearchByGenres).toHaveBeenCalledWith(['Action'], '', '', 'linux');
    });
  });

  // ── Layer C: Response Contract ───────────────────────────────────────────────
  // "Contract tests" lock the API shape the Angular frontend depends on.
  // If a developer renames `appId` to `app_id`, this test fails immediately.
  describe('Response Contract', () => {
    it('should return a JSON array with the correct game object shape', async () => {
      const response = await request(app).get('/?genres=Action');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      const game = response.body[0];
      expect(game).toHaveProperty('appId');
      expect(game).toHaveProperty('name');
      expect(game).toHaveProperty('genres');
      expect(Array.isArray(game.genres)).toBe(true);
    });
  });

  // ── Layer D: Error Handling ──────────────────────────────────────────────────
  // Proves the router's try/catch returns a clean 500 instead of crashing Express.
  describe('Service Failure Handling', () => {
    it('should return 500 when the SearchService throws an unexpected error', async () => {
      mockSearchByGenres.mockRejectedValueOnce(new Error('DB connection lost'));
      const response = await request(app).get('/?genres=RPG');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});
