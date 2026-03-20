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
import { PostgresGameMetadataRepository } from '../repositories/game.repository';
import { GenreVectorStrategy } from './strategies/genre-vector.strategy';
import { FriendOverlapStrategy } from './strategies/friend-overlap.strategy';
import { RecommendationScoringStrategy } from './strategies/scoring.strategy';
import {
  OwnedGame,
  UserProfile,
  UserGenreProfile,
  ScoredRecommendation
} from '../types/steam.types';

// Maximum friends to batch-fetch libraries for (Steam API rate limit consideration)
const MAX_FRIENDS_TO_ANALYZE = 10;

// ─── Core Profile Builder ─────────────────────────────────────────────────────

/**
 * Executes the full Steam profile aggregation pipeline using strategies.
 * All I/O phases use parallel execution.
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
  const repo = new PostgresGameMetadataRepository();
  const genreStrategy = new GenreVectorStrategy(repo);
  const friendStrategy = new FriendOverlapStrategy();

  const recentAppIds = new Set(recentGames.map((g) => g.appId));
  const genreVector = await genreStrategy.buildVector(library, recentAppIds);
  const friendOverlapSet = friendStrategy.buildOverlapSet(friendLibraries);
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
 * the user's personal genre vector and social overlap signals via strategy layer.
 */
export async function scoreWithUserContext(
  steamId: string,
  profile: UserProfile,
  limit: number = 10
): Promise<ScoredRecommendation[]> {
  const repo = new PostgresGameMetadataRepository();
  const scoringStrategy = new RecommendationScoringStrategy(repo);
  
  return scoringStrategy.scoreCandidates(profile, limit);
}

// Ensure these fields from types.ts are exported into the new file cleanly
