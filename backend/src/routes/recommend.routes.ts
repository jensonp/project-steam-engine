import { Router, Request, Response } from 'express';
import { getRecommenderService } from '../services/recommender.service';
import { buildUserProfile, scoreWithUserContext } from '../services/user-profile.service';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { query } from '../config/db';
import { ScoredRecommendation, UserProfile } from '../types/steam.types';
import { canonicalizeAppId } from '../utils/canonical-app-id';
import { PostgresGameMetadataRepository } from '../repositories/game.repository';
import { SearchService } from '../services/search.service';

const router = Router();
const searchService = new SearchService();

interface FallbackRow {
  app_id: number;
  game_name: string;
  genres: string | null;
  tags: string | null;
  header_image: string | null;
  short_description: string | null;
  price: string | null;
  positive_votes: number | null;
}

interface RecommendationFilters {
  genres: string[];
  keyword: string;
  playerCount: string;
  os?: 'windows' | 'mac' | 'linux';
}

function splitTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, ' ');
}

function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => normalizeToken(entry))
    .filter(Boolean);
}

function hasExplicitRecommendationFilters(filters: RecommendationFilters): boolean {
  return (
    filters.genres.length > 0 ||
    filters.keyword.length > 0 ||
    (!!filters.playerCount && filters.playerCount !== 'Any') ||
    !!filters.os
  );
}

function computeRecommendationCandidatePoolLimit(
  limit: number,
  filters: RecommendationFilters
): number {
  if (!hasExplicitRecommendationFilters(filters)) {
    return Math.max(limit * 8, 80);
  }

  let pool = Math.max(limit * 10, 120);
  if (filters.genres.length >= 2) pool += 40;
  if (filters.keyword) pool += 30;
  if (filters.playerCount && filters.playerCount !== 'Any') pool += 20;
  if (filters.os) pool += 20;
  return pool;
}

function extractRecommendationFilters(query: {
  genres?: string;
  keyword?: string;
  playerCount?: string;
  os?: 'windows' | 'mac' | 'linux';
}): RecommendationFilters {
  return {
    genres: parseCsvList(query.genres),
    keyword: normalizeToken(query.keyword || ''),
    playerCount: query.playerCount || 'Any',
    os: query.os,
  };
}

function matchesGenreFilters(rec: ScoredRecommendation, genres: string[]): boolean {
  if (genres.length === 0) return true;

  const tokens = [
    ...rec.genres,
    ...rec.tags,
  ].map((token) => normalizeToken(token));

  return genres.every((wantedGenre) =>
    tokens.some(
      (token) =>
        token === wantedGenre ||
        token.includes(wantedGenre) ||
        wantedGenre.includes(token)
    )
  );
}

function matchesKeywordFilter(rec: ScoredRecommendation, keyword: string): boolean {
  if (!keyword) return true;

  const terms = keyword.split(/\s+/).map(normalizeToken).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableBlob = normalizeToken(
    [
      rec.name,
      rec.description || '',
      rec.genres.join(' '),
      rec.tags.join(' '),
    ].join(' ')
  );

  return terms.every((term) => searchableBlob.includes(term));
}

function matchesPlayerCountFilter(rec: ScoredRecommendation, playerCount: string): boolean {
  if (!playerCount || playerCount === 'Any') return true;

  const haystack = normalizeToken(
    [
      rec.name,
      rec.description || '',
      rec.genres.join(' '),
      rec.tags.join(' '),
    ].join(' ')
  );

  const normalized = normalizeToken(playerCount);
  const checksByMode: Record<string, string[]> = {
    'single-player': ['single-player', 'singleplayer', 'solo'],
    multiplayer: ['multiplayer', 'multi-player', 'online pvp', 'online co-op'],
    'co-op': ['co-op', 'coop', 'online co-op', 'local co-op'],
    online: ['online', 'online pvp', 'online co-op', 'multiplayer'],
  };

  const matchTerms = checksByMode[normalized] ?? [normalized];
  return matchTerms.some((term) => haystack.includes(term));
}

async function applyOsFilter(
  recommendations: ScoredRecommendation[],
  os: 'windows' | 'mac' | 'linux' | undefined
): Promise<ScoredRecommendation[]> {
  if (!os || recommendations.length === 0) return recommendations;

  const appIds = recommendations.map((rec) => rec.appId);
  const osColumn =
    os === 'windows'
      ? 'windows_support'
      : os === 'mac'
      ? 'mac_support'
      : 'linux_support';

  try {
    const result = await query<{ app_id: number }>(
      `SELECT app_id FROM games WHERE app_id = ANY($1::int[]) AND ${osColumn} = TRUE`,
      [appIds]
    );
    const allowed = new Set(result.rows.map((row) => row.app_id));
    return recommendations.filter((rec) => allowed.has(rec.appId));
  } catch (error: any) {
    // Older local schemas may not include OS support columns yet.
    // In that case, skip OS filtering instead of failing the whole recommendation request.
    if (error?.code === '42703') {
      console.warn(
        `[recommend.routes] OS filter skipped: missing column ${osColumn}. Returning unfiltered recommendations.`
      );
      return recommendations;
    }
    throw error;
  }
}

async function applyRecommendationFilters(
  recommendations: ScoredRecommendation[],
  filters: RecommendationFilters
): Promise<ScoredRecommendation[]> {
  const filtered = recommendations.filter((rec) => {
    if (!matchesGenreFilters(rec, filters.genres)) return false;
    if (!matchesKeywordFilter(rec, filters.keyword)) return false;
    if (!matchesPlayerCountFilter(rec, filters.playerCount)) return false;
    return true;
  });

  return applyOsFilter(filtered, filters.os);
}

const THEME_TERM_ALIASES: Record<string, string[]> = {
  zombie: ['zombie', 'zombies', 'undead'],
  horror: ['horror', 'survival horror'],
  survival: ['survival', 'survival horror', 'post-apocalyptic'],
};

function collectNormalizedTokens(genres: string[], tags: string[]): string[] {
  return [...new Set([...genres, ...tags].map((token) => normalizeToken(token)).filter(Boolean))];
}

function scoreProfileSignalAlignment(tokens: string[], profile: UserProfile): {
  profileAlignment: number;
  thematicBoost: number;
  matchedSignals: string[];
} {
  const tokenSet = new Set(tokens);
  const matchedSignals: string[] = [];
  let profileAlignment = 0;

  for (const [signal, weight] of profile.genreVector.entries()) {
    if (!tokenSet.has(signal)) continue;
    profileAlignment += weight;
    if (matchedSignals.length < 3) matchedSignals.push(signal);
  }

  let thematicBoost = 0;
  for (const aliasTerms of Object.values(THEME_TERM_ALIASES)) {
    const hasProfileSignal = aliasTerms.some((term) => (profile.genreVector.get(term) ?? 0) > 0);
    if (!hasProfileSignal) continue;
    if (!aliasTerms.some((term) => tokenSet.has(term))) continue;
    thematicBoost += 0.14;
    for (const term of aliasTerms) {
      if (tokenSet.has(term) && matchedSignals.length < 3 && !matchedSignals.includes(term)) {
        matchedSignals.push(term);
      }
    }
  }

  return { profileAlignment, thematicBoost, matchedSignals };
}

export function scoreFallbackCandidate(
  row: FallbackRow,
  profile: UserProfile,
  maxPositiveVotes: number
): { score: number; matchedSignals: string[] } {
  const tokens = collectNormalizedTokens(splitTokens(row.genres), splitTokens(row.tags));
  const { profileAlignment, thematicBoost, matchedSignals } = scoreProfileSignalAlignment(tokens, profile);

  const positiveVotes = row.positive_votes ?? 0;
  const popularityScore =
    maxPositiveVotes > 0 ? Math.log1p(positiveVotes) / Math.log1p(maxPositiveVotes) : 0;

  const score = profileAlignment * 0.78 + thematicBoost * 0.17 + popularityScore * 0.05;
  return { score, matchedSignals };
}

async function rerankFilteredStorefrontCandidates(
  profile: UserProfile,
  filters: RecommendationFilters,
  limit: number,
  existingRecommendations: ScoredRecommendation[]
): Promise<ScoredRecommendation[]> {
  if (!hasExplicitRecommendationFilters(filters)) return [];

  const storefrontCandidates = await searchService.searchByGenres(
    filters.genres,
    filters.keyword,
    filters.playerCount,
    filters.os,
    Math.max(limit * 8, 80)
  );

  if (storefrontCandidates.length === 0) return [];

  const existingCanonicalIds = new Set<number>(
    existingRecommendations.map((rec) => canonicalizeAppId(rec.appId, rec.headerImage))
  );
  const filteredCandidates = storefrontCandidates.filter((candidate) => {
    const canonicalId = canonicalizeAppId(candidate.appId, candidate.headerImage);
    return !profile.ownedAppIds.has(canonicalId) && !existingCanonicalIds.has(canonicalId);
  });

  if (filteredCandidates.length === 0) return [];

  const repo = new PostgresGameMetadataRepository();
  const metadataRows = await repo.getFullMetadataForCandidates(filteredCandidates.map((candidate) => candidate.appId));
  const metadataByCanonicalId = new Map(
    metadataRows.map((row) => [canonicalizeAppId(row.app_id, row.header_image), row] as const)
  );

  return filteredCandidates
    .map((candidate, index, all) => {
      const canonicalId = canonicalizeAppId(candidate.appId, candidate.headerImage);
      const meta = metadataByCanonicalId.get(canonicalId);
      const displayGenres = meta?.genres
        ? meta.genres.split(',').map((entry) => entry.trim()).filter(Boolean)
        : candidate.genres;
      const displayTags = meta?.tags
        ? meta.tags.split(',').map((entry) => entry.trim()).filter(Boolean)
        : [];
      const tokens = collectNormalizedTokens(displayGenres, displayTags);
      const { profileAlignment, thematicBoost, matchedSignals } = scoreProfileSignalAlignment(tokens, profile);
      const socialScore = profile.friendOverlapSet.has(canonicalId) ? 1 : 0;
      const storefrontRankScore = all.length <= 1 ? 1 : 1 - index / (all.length - 1);
      const finalScore =
        profileAlignment * 0.58 +
        thematicBoost * 0.12 +
        socialScore * 0.15 +
        storefrontRankScore * 0.15;

      const reasons: string[] = ['Matches your current filters'];
      if (matchedSignals.length > 0) {
        reasons.push(`Aligned with your profile: ${matchedSignals.join(', ')}`);
      } else {
        reasons.push('Reranked for your library profile');
      }
      if (socialScore > 0) {
        reasons.push('Popular among your friends');
      }

      return {
        appId: canonicalId,
        name: candidate.name,
        score: parseFloat(finalScore.toFixed(6)),
        jaccardScore: 0,
        genreAlignmentScore: parseFloat(profileAlignment.toFixed(4)),
        socialScore,
        reason: reasons.join(' · '),
        headerImage: meta?.header_image ?? candidate.headerImage ?? null,
        genres: displayGenres,
        tags: displayTags,
        description: meta?.short_description ?? null,
        price: meta?.price != null ? parseFloat(meta.price) : candidate.price,
        isFree:
          meta?.price != null
            ? parseFloat(meta.price) === 0
            : candidate.price !== null
            ? candidate.price === 0
            : false,
        developers: [],
        publishers: [],
        releaseDate: null,
      } satisfies ScoredRecommendation;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function mergeRecommendations(
  primary: ScoredRecommendation[],
  backfill: ScoredRecommendation[],
  limit: number
): ScoredRecommendation[] {
  const merged: ScoredRecommendation[] = [];
  const seenCanonicalIds = new Set<number>();

  for (const rec of [...primary, ...backfill]) {
    const canonicalId = canonicalizeAppId(rec.appId, rec.headerImage);
    if (seenCanonicalIds.has(canonicalId)) continue;
    if (canonicalId !== rec.appId) {
      rec.appId = canonicalId;
    }
    seenCanonicalIds.add(canonicalId);
    merged.push(rec);
    if (merged.length >= limit) break;
  }

  return merged;
}

async function getFallbackPopularRecommendations(
  profile: UserProfile,
  limit: number
): Promise<ScoredRecommendation[]> {
  const ownedAppIds = profile.library.map((g) => g.appId);
  const sql = `
    SELECT app_id, game_name, genres, tags, header_image, short_description, price, positive_votes
    FROM games
    WHERE NOT (app_id = ANY($1::int[]))
    ORDER BY positive_votes DESC
    LIMIT GREATEST($2 * 40, 400)
  `;

  const result = await query<FallbackRow>(sql, [ownedAppIds, limit]);
  const maxPositiveVotes = result.rows.reduce((max, row) => {
    const votes = row.positive_votes ?? 0;
    return votes > max ? votes : max;
  }, 0);

  const ranked = result.rows
    .map((row) => {
      const scored = scoreFallbackCandidate(row, profile, maxPositiveVotes);
      return { row, score: scored.score, matchedSignals: scored.matchedSignals };
    })
    .sort((a, b) => b.score - a.score);

  const deduped: { row: FallbackRow; score: number; matchedSignals: string[] }[] = [];
  const seenCanonicalIds = new Set<number>();
  for (const entry of ranked) {
    const canonicalAppId = canonicalizeAppId(entry.row.app_id, entry.row.header_image);
    if (profile.ownedAppIds.has(canonicalAppId)) continue;
    if (seenCanonicalIds.has(canonicalAppId)) continue;
    seenCanonicalIds.add(canonicalAppId);

    if (canonicalAppId !== entry.row.app_id) {
      entry.row = { ...entry.row, app_id: canonicalAppId };
    }
    deduped.push(entry);
    if (deduped.length >= limit) break;
  }

  return deduped.map(({ row, score, matchedSignals }) => {
    const priceValue = row.price === null ? null : Number(row.price);
    const isFree = priceValue !== null ? priceValue === 0 : false;
    const reasonSuffix =
      matchedSignals.length > 0
        ? `Matched your profile signals: ${matchedSignals.join(', ')}`
        : 'Matched your profile and popularity baseline';

    return {
      appId: row.app_id,
      name: row.game_name,
      score: parseFloat(score.toFixed(6)),
      jaccardScore: 0,
      genreAlignmentScore: parseFloat(score.toFixed(4)),
      socialScore: 0,
      reason: `Personalized fallback while engine initializes. ${reasonSuffix}`,
      headerImage: row.header_image,
      genres: row.genres ? row.genres.split(',').map((g) => g.trim()).filter(Boolean) : [],
      tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      description: row.short_description,
      price: priceValue,
      isFree,
      developers: [],
      publishers: [],
      releaseDate: null,
    };
  });
}

// --- Zod Validation Schemas ---

const similarGamesSchema = z.object({
  params: z.object({
    appId: z.string().regex(/^\d+$/, 'appId must be a positive integer'),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
  }),
});

const userRecommendationsSchema = z.object({
  params: z.object({
    steamId: z
      .string()
      .length(17, 'Steam ID must be exactly 17 characters')
      .regex(/^\d+$/, 'Steam ID must be numeric'),
  }),
  query: z.object({
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
    genres: z.string().optional(),
    keyword: z.string().optional(),
    playerCount: z.string().optional(),
    os: z.enum(['windows', 'mac', 'linux']).optional(),
  }),
});

const byTagsSchema = z.object({
  body: z.object({
    tags: z.array(z.string()).min(1, 'You must provide at least one tag'),
    limit: z.number().int().positive('limit must be a positive integer').optional(),
  }),
});

// --- Routes ---

/**
 * GET /api/recommend/status
 */
router.get('/status', (req: Request, res: Response): void => {
  try {
    const recommender = getRecommenderService();
    const indexReady = recommender.isReady();
    res.json({
      ready: indexReady,
      status: indexReady ? 'Online' : 'Runtime fallback mode (index unavailable)',
    });
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      error: error.message,
      instructions: [
        "1. Download steam.csv from Kaggle to data/raw/",
        "2. Run: npm run data:process",
        "3. Run: npm run data:build-recommender"
      ]
    });
  }
});

/**
 * GET /api/recommend/similar/:appId
 */
router.get(
  '/similar/:appId',
  validate(similarGamesSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();

      const appId = parseInt(req.params.appId, 10);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const recommendations = await recommender.getSimilarGamesSmart(appId, limit);
      
      if (recommendations.length === 0) {
        res.status(404).json({ error: `No recommendations found for app ID ${appId}` });
        return;
      }

      res.json(recommendations);
    } catch (error: any) {
      if (error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    }
  }
);

/**
 * GET /api/recommend/user/:steamId
 */
router.get(
  '/user/:steamId',
  validate(userRecommendationsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();

      const steamId = req.params.steamId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const filters = extractRecommendationFilters({
        genres: typeof req.query.genres === 'string' ? req.query.genres : undefined,
        keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
        playerCount: typeof req.query.playerCount === 'string' ? req.query.playerCount : undefined,
        os: req.query.os as 'windows' | 'mac' | 'linux' | undefined,
      });

      // Build a full user profile (playtime vector + friend graph)
      const profile = await buildUserProfile(steamId);

      if (profile.library.length === 0) {
        res.status(404).json({
          error: 'Could not load Steam library. Profile may be private.',
        });
        return;
      }

      // Score candidates using the 3-signal composite engine.
      // This now supports runtime similarity fallback even if offline index files are missing.
      const candidatePoolLimit = computeRecommendationCandidatePoolLimit(limit, filters);
      const recommendations = await scoreWithUserContext(steamId, profile, candidatePoolLimit);
      const filteredRecommendations = await applyRecommendationFilters(recommendations, filters);
      const primaryRecommendations = filteredRecommendations.slice(0, limit);

      if (primaryRecommendations.length >= limit || !hasExplicitRecommendationFilters(filters)) {
        res.json(primaryRecommendations);
        return;
      }

      const storefrontBackfill = await rerankFilteredStorefrontCandidates(
        profile,
        filters,
        limit,
        primaryRecommendations
      );
      const combinedRecommendations = mergeRecommendations(primaryRecommendations, storefrontBackfill, limit);
      if (combinedRecommendations.length > 0) {
        res.json(combinedRecommendations);
        return;
      }

      // Final fallback if no candidates can be built.
      const fallbackPoolLimit = computeRecommendationCandidatePoolLimit(limit, filters);
      const fallbackRecommendations = await getFallbackPopularRecommendations(profile, fallbackPoolLimit);
      const filteredFallback = await applyRecommendationFilters(fallbackRecommendations, filters);
      res.json(filteredFallback.slice(0, limit));

    } catch (error: any) {
      console.error('User recommendation error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations', details: error.message });
    }
  }
);

/**
 * GET /api/recommend/user/:steamId/profile
 * Returns the aggregated user profile: genre vector, friend overlap stats, top genres.
 */
router.get(
  '/user/:steamId/profile',
  validate(userRecommendationsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const steamId = req.params.steamId;
      const profile = await buildUserProfile(steamId);

      // Serialize the profile for JSON — strip the internal Sets/Maps
      res.json({
        steamId: profile.steamId,
        personaName: profile.personaName,
        avatar: profile.avatar,
        librarySize: profile.librarySize,
        recentGamesCount: profile.recentGamesCount,
        topGenres: profile.topGenres,
        friendsAnalyzed: profile.friendsAnalyzed,
        friendOverlapGames: profile.friendOverlapGames,
      });
    } catch (error: any) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to build user profile', details: error.message });
    }
  }
);

/**
 * POST /api/recommend/bytags
 */
router.post(
  '/bytags',
  validate(byTagsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const recommender = getRecommenderService();
      
      if (!recommender.isReady()) {
        res.status(503).json({ error: 'Recommendation engine not ready' });
        return;
      }

      const { tags, limit = 10 } = req.body;
      const recommendations = recommender.getRecommendationsByTags(tags, limit);
      res.json(recommendations);
    } catch (error: any) {
      if (error.message.includes('not ready')) {
        res.status(503).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    }
  }
);

export default router;
