/**
 * UserProfileService
 *
 * Aggregates multiple Steam API signals into a unified `UserProfile` object
 * that drives personalized, context-aware recommendation scoring.
 *
 * Signal pipeline:
 *   Phase 1 (parallel I/O)   → getOwnedGames + getRecentlyPlayedGames + getFriendList
 *   Phase 2 (parallel I/O)   → getMultipleOwnedGames(friendIds.slice(0, MAX_FRIENDS))
 *   Phase 3 (CPU-bound)      → buildGenreVector + buildFriendOverlapSet
 *   Phase 4 (CPU-bound)      → scoreWithUserContext(candidates, profile)
 */

import { getSteamService } from './steam.service';
import { getRecommenderService } from './recommender.service';
import { query } from '../config/db';
import {
  OwnedGame,
  UserProfile,
  UserGenreProfile,
} from '../types/steam.types';

// Maximum friends to batch-fetch libraries for (Steam API rate limit consideration)
const MAX_FRIENDS_TO_ANALYZE = 10;

// Scoring weights for the three signals
const WEIGHT_JACCARD  = 0.50;
const WEIGHT_GENRE    = 0.30;
const WEIGHT_SOCIAL   = 0.20;

// Recency multiplier applied to games played in the last 2 weeks
const RECENCY_BOOST   = 1.5;

export interface ScoredRecommendation {
  appId: number;
  name: string;
  score: number;
  jaccardScore: number;
  genreAlignmentScore: number;
  socialScore: number;
  reason: string;
  // Display fields consumed by GameCardComponent
  headerImage: string | null;
  genres: string[];
  tags: string[];
  description: string | null;
  price: number | null;
  isFree: boolean;
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
}

// ─── Genre Vector Construction ────────────────────────────────────────────────

/**
 * Builds a L1-normalized genre preference vector from the user's playtime data.
 *
 * For each game_i in the library:
 *   contribution(genre_g) += log1p(playtime_i) * recencyBoost(game_i)
 *     where recencyBoost = RECENCY_BOOST if game_i in recentSet, else 1.0
 *
 * The result is normalized so all weights sum to 1.0.
 * Games without genre metadata in the DB are skipped.
 *
 * Complexity: O(L * G) where L = library size, G = avg genres per game
 */
async function buildGenreVector(
  library: OwnedGame[],
  recentAppIds: Set<number>
): Promise<Map<string, number>> {
  if (library.length === 0) return new Map();

  // Fetch genre metadata for all owned app IDs from our local PostgreSQL
  const appIds = library.map((g) => g.appId);
  const placeholders = appIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query<{ app_id: number; genres: string; tags: string }>(
    `SELECT app_id, genres, tags FROM games WHERE app_id IN (${placeholders})`,
    appIds
  );

  // Build a lookup: appId → genre/tag strings
  const genreMap = new Map<number, string[]>();
  for (const row of result.rows) {
    const genres = (row.genres || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const tags = (row.tags || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    genreMap.set(row.app_id, [...new Set([...genres, ...tags])]);
  }

  // Accumulate weighted genre contributions
  const rawVector = new Map<string, number>();
  for (const game of library) {
    const genres = genreMap.get(game.appId);
    if (!genres || genres.length === 0) continue;

    const recency = recentAppIds.has(game.appId) ? RECENCY_BOOST : 1.0;
    const contribution = Math.log1p(game.playtimeMinutes) * recency;

    for (const genre of genres) {
      rawVector.set(genre, (rawVector.get(genre) ?? 0) + contribution);
    }
  }

  // L1 normalization: divide every value by the total sum
  const total = [...rawVector.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return rawVector;

  for (const [genre, weight] of rawVector) {
    rawVector.set(genre, weight / total);
  }

  return rawVector;
}

// ─── Friend Overlap Set Construction ─────────────────────────────────────────

/**
 * Returns a Set of appIds owned by at least MIN_FRIEND_OVERLAP distinct friends.
 * This is the social proof signal: games popular in the user's friend graph
 * are boosted in the final ranking.
 *
 * Complexity: O(F * G) where F = friends analyzed, G = avg games per friend
 */
function buildFriendOverlapSet(
  friendLibraries: Map<string, OwnedGame[]>,
  minOverlap: number = 2
): Set<number> {
  const ownershipCount = new Map<number, number>();

  for (const games of friendLibraries.values()) {
    for (const game of games) {
      ownershipCount.set(game.appId, (ownershipCount.get(game.appId) ?? 0) + 1);
    }
  }

  const overlapSet = new Set<number>();
  for (const [appId, count] of ownershipCount) {
    if (count >= minOverlap) overlapSet.add(appId);
  }
  return overlapSet;
}

// ─── Core Profile Builder ─────────────────────────────────────────────────────

/**
 * Executes the full 4-phase Steam profile aggregation pipeline.
 * All I/O phases use parallel execution to minimize wall-clock latency.
 */
export async function buildUserProfile(steamId: string): Promise<UserProfile> {
  const steamService = getSteamService();

  // ── Phase 1: Parallel I/O ──────────────────────────────────────────────────
  const [libraryResult, recentGamesResult, friendListResult] = await Promise.allSettled([
    steamService.getOwnedGames(steamId),
    steamService.getRecentlyPlayedGames(steamId, 20),
    steamService.getFriendList(steamId),
  ]);

  const library = libraryResult.status === 'fulfilled' ? libraryResult.value.games : [];
  const recentGames = recentGamesResult.status === 'fulfilled' ? recentGamesResult.value : [];
  const friends = friendListResult.status === 'fulfilled' ? friendListResult.value : [];

  // ── Phase 2: Friend Library Batch Fetch ────────────────────────────────────
  const friendIds = friends.slice(0, MAX_FRIENDS_TO_ANALYZE).map((f) => f.steamId);
  const friendLibraries = friendIds.length > 0
    ? await steamService.getMultipleOwnedGames(friendIds)
    : new Map<string, OwnedGame[]>();

  // ── Phase 3: CPU-Bound Vector Construction ────────────────────────────────
  const recentAppIds = new Set(recentGames.map((g) => g.appId));
  const genreVector = await buildGenreVector(library, recentAppIds);
  const friendOverlapSet = buildFriendOverlapSet(friendLibraries);
  const ownedAppIds = new Set(library.map((g) => g.appId));

  // Derive the display-friendly top genres (sorted by weight desc, top 10)
  const topGenres: UserGenreProfile[] = [...genreVector.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, weight]) => ({ genre, weight: parseFloat(weight.toFixed(4)) }));

  // Fetch player summary for display (name, avatar)
  let personaName = 'Unknown';
  let avatar: string | null = null;
  try {
    const summary = await steamService.getPlayerSummary(steamId);
    personaName = summary.personaName;
    avatar = summary.avatar;
  } catch {
    // Non-fatal: proceed without display name
  }

  return {
    steamId,
    personaName,
    avatar,
    librarySize: library.length,
    recentGamesCount: recentGames.length,
    topGenres,
    friendsAnalyzed: friendLibraries.size,
    friendOverlapGames: friendOverlapSet.size,
    ownedAppIds,
    friendOverlapSet,
    genreVector,
    library,
  };
}

// ─── 3-Signal Scoring Engine ──────────────────────────────────────────────────

/**
 * Re-scores the recommender's pre-computed Jaccard candidates using
 * the user's personal genre vector and social overlap signals.
 *
 * finalScore(c) = α * jaccardScore(c)
 *               + β * Σ_{g ∈ genres(c)} genreVector[g]
 *               + γ * (c.appId ∈ friendOverlapSet ? 1 : 0)
 *
 * Where α = WEIGHT_JACCARD, β = WEIGHT_GENRE, γ = WEIGHT_SOCIAL
 *
 * Complexity: O(K * G) where K = candidate limit, G = genres per game
 */
export async function scoreWithUserContext(
  steamId: string,
  profile: UserProfile,
  limit: number = 20
): Promise<ScoredRecommendation[]> {
  const recommender = getRecommenderService();

  // Collect candidates from all owned games' similarity lists, deduplicated
  const candidateScores = new Map<number, { jaccardScore: number; name: string }>();

  for (const game of profile.library) {
    const similar = recommender.getSimilarGames(game.appId, 30);
    for (const s of similar) {
      // Skip games the user already owns
      if (profile.ownedAppIds.has(s.appId)) continue;
      // Keep only the highest pre-computed Jaccard score if seen from multiple seeds
      const existing = candidateScores.get(s.appId);
      if (!existing || s.similarity > existing.jaccardScore) {
        candidateScores.set(s.appId, { jaccardScore: s.similarity, name: s.name });
      }
    }
  }

  if (candidateScores.size === 0) return [];

  // Fetch genre + display metadata for all candidates in one SQL round-trip
  const candidateIds = [...candidateScores.keys()];
  const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(',');
  const metaResult = await query<{
    app_id: number;
    genres: string;
    tags: string;
    header_image: string | null;
    short_description: string | null;
    price: string | null;
  }>(
    `SELECT app_id, genres, tags, header_image, short_description, price
     FROM games WHERE app_id IN (${placeholders})`,
    candidateIds
  );

  const candidateGenres = new Map<number, string[]>();
  const candidateMeta  = new Map<number, typeof metaResult.rows[0]>();
  for (const row of metaResult.rows) {
    const combined = [
      ...(row.genres || '').split(','),
      ...(row.tags   || '').split(','),
    ].map((s) => s.trim().toLowerCase()).filter(Boolean);
    candidateGenres.set(row.app_id, [...new Set(combined)]);
    candidateMeta.set(row.app_id, row);
  }

  // Compute the 3-signal composite score for every candidate
  const scored: ScoredRecommendation[] = [];

  for (const [appId, { jaccardScore, name }] of candidateScores) {
    const genres = candidateGenres.get(appId) || [];

    // Genre alignment: dot product of candidate's genre set against user's preference vector
    const genreAlignmentScore = genres.reduce(
      (sum, g) => sum + (profile.genreVector.get(g) ?? 0),
      0
    );

    // Social proof: binary (1 = ≥2 friends own it, 0 = they don't)
    const socialScore = profile.friendOverlapSet.has(appId) ? 1.0 : 0.0;

    const finalScore =
      WEIGHT_JACCARD * jaccardScore +
      WEIGHT_GENRE   * genreAlignmentScore +
      WEIGHT_SOCIAL  * socialScore;

    const reasons: string[] = [];
    if (jaccardScore > 0.5)          reasons.push('Highly similar content');
    if (genreAlignmentScore > 0.15)  reasons.push('Matches your genre preferences');
    if (socialScore > 0)             reasons.push('Popular among your friends');

    const meta = candidateMeta.get(appId);
    // Parse the display-ready genre/tag arrays for the card (original casing from DB)
    const displayGenres = (meta?.genres || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const displayTags = (meta?.tags || '')
      .split(',').map((s) => s.trim()).filter(Boolean);

    scored.push({
      appId,
      name,
      score: parseFloat(finalScore.toFixed(6)),
      jaccardScore: parseFloat(jaccardScore.toFixed(4)),
      genreAlignmentScore: parseFloat(genreAlignmentScore.toFixed(4)),
      socialScore,
      reason: reasons.join(' · ') || 'Recommended for you',
      // Display fields for GameCardComponent
      headerImage: meta?.header_image ?? null,
      genres: displayGenres,
      tags: displayTags,
      description: meta?.short_description ?? null,
      price: meta?.price != null ? parseFloat(meta.price) : null,
      isFree: parseFloat(meta?.price ?? 'NaN') === 0,
      developers: [],
      publishers: [],
      releaseDate: null,
    });
  }

  // Sort by composite score descending and return top K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
