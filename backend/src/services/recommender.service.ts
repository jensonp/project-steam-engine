/**
 * Recommendation Service
 * 
 * Provides game recommendations using pre-computed similarity data
 * and real-time calculations for user libraries.
 */

import fs from 'fs';
import path from 'path';
import { query } from '../config/db';

const DATA_DIR = path.join(__dirname, '../../data/processed');
const RECOMMENDER_DIR = path.join(DATA_DIR, 'recommender');

interface SimilarGame {
  appId: number;
  name: string;
  similarity: number;
}

interface GameVector {
  appId: number;
  name: string;
  magnitude: number;
  topTerms: { term: string; weight: number }[];
}

interface RecommendationResult {
  appId: number;
  name: string;
  score: number;
  reason: string;
}

export class RecommenderService {
  private similarityIndex: Map<number, SimilarGame[]> = new Map();
  private runtimeSimilarityCache: Map<number, SimilarGame[]> = new Map();
  private gameVectors: Map<number, GameVector> = new Map();
  private idf: Map<string, number> = new Map();
  private isLoaded: boolean = false;

  constructor() {
    this.loadData();
  }

  /**
   * Load pre-computed recommendation data
   */
  private loadData(): void {
    try {
      // Load similarity index
      const indexPath = path.join(RECOMMENDER_DIR, 'similarity-index.json');
      if (fs.existsSync(indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        for (const [appId, similar] of Object.entries(indexData)) {
          this.similarityIndex.set(parseInt(appId), similar as SimilarGame[]);
        }
        console.log(`Loaded similarity index for ${this.similarityIndex.size} games`);
      }

      // Load vectors
      const vectorsPath = path.join(RECOMMENDER_DIR, 'vectors.json');
      if (fs.existsSync(vectorsPath)) {
        const vectors: GameVector[] = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));
        for (const v of vectors) {
          this.gameVectors.set(v.appId, v);
        }
        console.log(`Loaded vectors for ${this.gameVectors.size} games`);
      }

      // Load IDF
      const idfPath = path.join(RECOMMENDER_DIR, 'idf.json');
      if (fs.existsSync(idfPath)) {
        const idfData = JSON.parse(fs.readFileSync(idfPath, 'utf-8'));
        for (const [term, value] of Object.entries(idfData)) {
          this.idf.set(term, value as number);
        }
        console.log(`Loaded IDF with ${this.idf.size} terms`);
      }

      this.isLoaded = this.similarityIndex.size > 0;
    } catch (error) {
      console.error('Error loading recommender data:', error);
      this.isLoaded = false;
    }
  }

  /**
   * Check if the recommender is ready
   */
  isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Get similar games to a single game
   */
  getSimilarGames(appId: number, limit: number = 10): SimilarGame[] {
    const similar = this.similarityIndex.get(appId);
    if (!similar) return [];
    return similar.slice(0, limit);
  }

  /**
   * Smart similarity lookup:
   * 1) Use precomputed index when available.
   * 2) Fallback to DB runtime similarity when index is unavailable.
   */
  async getSimilarGamesSmart(appId: number, limit: number = 10): Promise<SimilarGame[]> {
    const indexed = this.getSimilarGames(appId, limit);
    if (indexed.length > 0) {
      return indexed;
    }

    const cached = this.runtimeSimilarityCache.get(appId);
    if (cached && cached.length > 0) {
      return cached.slice(0, limit);
    }

    const computed = await this.queryRuntimeSimilarGames(appId, Math.max(limit, 30));
    if (computed.length > 0) {
      this.runtimeSimilarityCache.set(appId, computed);
      // Keep cache bounded in memory.
      if (this.runtimeSimilarityCache.size > 800) {
        const firstKey = this.runtimeSimilarityCache.keys().next().value as number | undefined;
        if (typeof firstKey === 'number') this.runtimeSimilarityCache.delete(firstKey);
      }
    }

    return computed.slice(0, limit);
  }

  private async queryRuntimeSimilarGames(appId: number, limit: number): Promise<SimilarGame[]> {
    try {
      const sql = `
        WITH base AS (
          SELECT
            app_id,
            COALESCE(game_name, '') AS game_name,
            COALESCE(genres, '') AS genres,
            COALESCE(tags, '') AS tags,
            COALESCE(categories, '') AS categories,
            COALESCE(price, 0)::numeric AS price
          FROM games
          WHERE app_id = $1
        )
        SELECT
          g.app_id AS "appId",
          g.game_name AS "name",
          (
            0.46 * GREATEST(similarity(COALESCE(g.tags, ''), b.tags), 0) +
            0.34 * GREATEST(similarity(COALESCE(g.genres, ''), b.genres), 0) +
            0.14 * GREATEST(similarity(COALESCE(g.categories, ''), b.categories), 0) +
            0.06 * (
              1 - LEAST(
                ABS(COALESCE(g.price, 0)::numeric - b.price) / GREATEST(b.price, 1),
                1
              )
            )
          ) AS "similarity"
        FROM games g
        CROSS JOIN base b
        WHERE g.app_id <> b.app_id
          AND (
            (b.tags <> '' AND COALESCE(g.tags, '') % b.tags) OR
            (b.genres <> '' AND COALESCE(g.genres, '') % b.genres) OR
            (b.categories <> '' AND COALESCE(g.categories, '') % b.categories)
          )
        ORDER BY "similarity" DESC, COALESCE(g.positive_votes, 0) DESC
        LIMIT $2
      `;

      const result = await query<{ appId: number; name: string; similarity: string | number }>(sql, [
        appId,
        limit,
      ]);

      return result.rows
        .map((row) => ({
          appId: row.appId,
          name: row.name,
          similarity: typeof row.similarity === 'number' ? row.similarity : parseFloat(row.similarity),
        }))
        .filter((row) => Number.isFinite(row.similarity) && row.similarity > 0);
    } catch (error) {
      // Runtime fallback failure should not crash request paths.
      console.warn(`[RecommenderService] Runtime similarity fallback failed for app ${appId}:`, error);
      return [];
    }
  }

  /**
   * Get recommendations based on a user's game library
   * This is the main recommendation method
   */
  getRecommendationsForLibrary(
    ownedGames: { appId: number; playtimeMinutes: number }[],
    limit: number = 20
  ): RecommendationResult[] {
    if (!this.isLoaded || ownedGames.length === 0) {
      return [];
    }

    // Create a set of owned game IDs for quick lookup
    const ownedSet = new Set(ownedGames.map(g => g.appId));

    // Calculate weights based on playtime (more playtime = higher weight)
    const totalPlaytime = ownedGames.reduce((sum, g) => sum + g.playtimeMinutes, 0);
    const gameWeights = new Map<number, number>();
    
    for (const game of ownedGames) {
      // Use log scale for playtime to prevent one game from dominating
      const weight = totalPlaytime > 0 
        ? Math.log1p(game.playtimeMinutes) / Math.log1p(totalPlaytime)
        : 1 / ownedGames.length;
      gameWeights.set(game.appId, weight);
    }

    // Fix: Limit processing to top 100 most played games to prevent OOM
    // "Whale" users with 5000+ games will instantly crash the Node V8 Thread if evaluated entirely
    const topGames = [...ownedGames]
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
      .slice(0, 100);

    // Aggregate recommendations from all owned games
    const recommendationScores = new Map<number, { score: number; sources: string[] }>();

    for (const ownedGame of topGames) {
      const similar = this.similarityIndex.get(ownedGame.appId);
      if (!similar) continue;

      const weight = gameWeights.get(ownedGame.appId) || 0;
      const sourceName = this.gameVectors.get(ownedGame.appId)?.name || `Game ${ownedGame.appId}`;

      for (const rec of similar) {
        // Skip games the user already owns
        if (ownedSet.has(rec.appId)) continue;

        const currentScore = recommendationScores.get(rec.appId);
        const addedScore = rec.similarity * weight;

        if (currentScore) {
          currentScore.score += addedScore;
          // Fix: Limit source strings to 3 items maximum to avoid giant GC collections
          if (currentScore.sources.length < 3 && !currentScore.sources.includes(sourceName)) {
            currentScore.sources.push(sourceName);
          }
        } else {
          recommendationScores.set(rec.appId, {
            score: addedScore,
            sources: [sourceName],
          });
        }
      }
    }

    // Convert to array and sort by score
    const recommendations: RecommendationResult[] = [];

    for (const [appId, data] of recommendationScores) {
      const gameInfo = this.gameVectors.get(appId);
      
      recommendations.push({
        appId,
        name: gameInfo?.name || `Game ${appId}`,
        score: data.score,
        reason: `Similar to: ${data.sources.slice(0, 3).join(', ')}${data.sources.length > 3 ? '...' : ''}`,
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, limit);
  }

  /**
   * Get recommendations based on specific tags
   */
  getRecommendationsByTags(
    tags: string[],
    excludeAppIds: number[] = [],
    limit: number = 20
  ): RecommendationResult[] {
    if (!this.isLoaded || tags.length === 0) {
      return [];
    }

    const excludeSet = new Set(excludeAppIds);
    const normalizedTags = tags.map(t => t.toLowerCase());
    const scores: { appId: number; name: string; score: number; matchedTags: string[] }[] = [];

    // Score each game based on tag overlap
    for (const [appId, vector] of this.gameVectors) {
      if (excludeSet.has(appId)) continue;

      const gameTags = vector.topTerms.map(t => t.term);
      const matchedTags = normalizedTags.filter(t => gameTags.includes(t));
      
      if (matchedTags.length > 0) {
        // Score based on number of matched tags and their weights
        let score = 0;
        for (const tag of matchedTags) {
          const termWeight = vector.topTerms.find(t => t.term === tag)?.weight || 0;
          score += termWeight;
        }
        
        scores.push({
          appId,
          name: vector.name,
          score,
          matchedTags,
        });
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, limit).map(s => ({
      appId: s.appId,
      name: s.name,
      score: s.score,
      reason: `Matches tags: ${s.matchedTags.join(', ')}`,
    }));
  }

  /**
   * Get game info by ID
   */
  getGameInfo(appId: number): { name: string; topTerms: string[] } | null {
    const vector = this.gameVectors.get(appId);
    if (!vector) return null;

    return {
      name: vector.name,
      topTerms: vector.topTerms.map(t => t.term),
    };
  }
}

// Singleton instance
let recommenderInstance: RecommenderService | null = null;

export function getRecommenderService(): RecommenderService {
  if (!recommenderInstance) {
    recommenderInstance = new RecommenderService();
  }
  return recommenderInstance;
}
