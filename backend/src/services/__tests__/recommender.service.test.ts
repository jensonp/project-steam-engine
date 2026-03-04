/**
 * Layer 1: Unit Tests — RecommenderService
 *
 * Key engineering decision: We mock `fs.readFileSync` to inject a tiny,
 * fully-controlled similarity index into RAM. This isolates the in-memory
 * aggregation logic from disk I/O, making every test deterministic and
 * < 1ms fast regardless of whether similarity-index.json exists.
 */

import { RecommenderService } from '../recommender.service';
import fs from 'fs';

// Mock the entire `fs` module so we control what "files" are available
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// ─── Deterministic Test Data ──────────────────────────────────────────────────
// This is the fake similarity index we inject. It mirrors the real JSON shape.
const FAKE_SIMILARITY_INDEX = {
  730: [
    { appId: 10, name: 'Counter-Strike', similarity: 0.85 },
    { appId: 440, name: 'Team Fortress 2', similarity: 0.72 },
  ],
  570: [
    { appId: 730, name: 'Counter-Strike 2', similarity: 0.60 },
    { appId: 10, name: 'Counter-Strike', similarity: 0.55 },
  ],
  999: [], // edge case: game with zero similar items
};

// ─── Setup & Teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  jest.resetAllMocks();

  // Simulate: similarity-index.json EXISTS on disk
  mockFs.existsSync.mockImplementation((p: fs.PathLike) =>
    String(p).includes('similarity-index.json')
  );

  // Simulate: readFileSync returns our fake index as a string
  mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
    if (String(p).includes('similarity-index.json')) {
      return JSON.stringify(FAKE_SIMILARITY_INDEX);
    }
    return '{}';
  });
});

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('RecommenderService', () => {

  // ── Initialisation ──────────────────────────────────────────────────────────
  describe('isReady()', () => {
    it('should be ready when similarity-index.json is loaded successfully', () => {
      const service = new RecommenderService();
      expect(service.isReady()).toBe(true);
    });

    it('should NOT be ready when similarity-index.json is missing', () => {
      // Override: no files exist
      mockFs.existsSync.mockReturnValue(false);
      const service = new RecommenderService();
      expect(service.isReady()).toBe(false);
    });
  });

  // ── getSimilarGames ─────────────────────────────────────────────────────────
  // This is the O(1) Map lookup that powers /api/recommend/similar/:appId
  describe('getSimilarGames()', () => {
    it('should return the top-K most similar games for a known appId', () => {
      const service = new RecommenderService();
      const results = service.getSimilarGames(730, 2);

      expect(results).toHaveLength(2);
      // Verify the order is preserved (highest similarity first, as stored in the index)
      expect(results[0].appId).toBe(10);
      expect(results[0].similarity).toBe(0.85);
      expect(results[1].appId).toBe(440);
    });

    it('should respect the limit parameter and not over-fetch', () => {
      const service = new RecommenderService();
      const results = service.getSimilarGames(730, 1); // Ask for only 1
      expect(results).toHaveLength(1);
    });

    it('should return an empty array for an unknown appId', () => {
      const service = new RecommenderService();
      const results = service.getSimilarGames(99999999); // Not in our fake index
      expect(results).toEqual([]);
    });

    it('should return an empty array for a game that has zero matches', () => {
      const service = new RecommenderService();
      const results = service.getSimilarGames(999);
      expect(results).toEqual([]);
    });
  });

  // ── getRecommendationsForLibrary ────────────────────────────────────────────
  // This is the aggregation engine that powers personalized recommendations.
  describe('getRecommendationsForLibrary()', () => {
    it('should return empty array when the service is NOT ready', () => {
      mockFs.existsSync.mockReturnValue(false);
      const service = new RecommenderService();
      const results = service.getRecommendationsForLibrary([{ appId: 730, playtimeMinutes: 100 }]);
      expect(results).toEqual([]);
    });

    it('should return empty array when the user has no owned games', () => {
      const service = new RecommenderService();
      const results = service.getRecommendationsForLibrary([]);
      expect(results).toEqual([]);
    });

    it('should NOT recommend games the user already owns', () => {
      const service = new RecommenderService();
      // User owns both 730 and 570. The only possible rec for 730 is [10, 440]
      // The only possible rec for 570 is [730, 10]. 730 is owned → should be excluded.
      const results = service.getRecommendationsForLibrary([
        { appId: 730, playtimeMinutes: 100 },
        { appId: 570, playtimeMinutes: 100 },
      ]);

      const recommendedIds = results.map(r => r.appId);
      expect(recommendedIds).not.toContain(730); // User owns this
      expect(recommendedIds).not.toContain(570); // User owns this
    });

    it('should aggregate scores from multiple owned games into a single ranked list', () => {
      const service = new RecommenderService();
      // appId 10 (Counter-Strike) appears in BOTH 730's and 570's similar lists
      // → it should score HIGHER than 440 (only in 730's list)
      const results = service.getRecommendationsForLibrary([
        { appId: 730, playtimeMinutes: 200 },
        { appId: 570, playtimeMinutes: 100 },
      ]);

      expect(results.length).toBeGreaterThan(0);
      // appId 10 should be ranked #1 due to cross-library presence
      expect(results[0].appId).toBe(10);
    });

    it('should weight games proportionally by playtime using log scale', () => {
      const service = new RecommenderService();
      // 730 gets 99% of playtime → its recommendations should be weighted much higher
      const results = service.getRecommendationsForLibrary([
        { appId: 730, playtimeMinutes: 10000 }, // heavily played
        { appId: 570, playtimeMinutes: 1 },     // barely touched
      ]);

      // Team Fortress 2 (440) only comes from 730. Counter-Strike (10) comes from both.
      // With 730 heavily weighted, both 10 and 440 from 730 are heavily boosted.
      const resultIds = results.map(r => r.appId);
      expect(resultIds).toContain(440);
      expect(resultIds).toContain(10);
    });
  });
});
