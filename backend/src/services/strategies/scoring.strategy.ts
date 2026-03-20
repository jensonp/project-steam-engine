import { getRecommenderService } from '../recommender.service';
import { UserProfile, ScoredRecommendation } from '../../types/steam.types';
import { IGameMetadataRepository } from '../../repositories/interfaces';

const WEIGHT_JACCARD  = 0.50;
const WEIGHT_GENRE    = 0.30;
const WEIGHT_SOCIAL   = 0.20;

export class RecommendationScoringStrategy {
  constructor(private readonly repo: IGameMetadataRepository) {}

  async scoreCandidates(
    profile: UserProfile,
    limit: number = 20
  ): Promise<ScoredRecommendation[]> {
    const recommender = getRecommenderService();
    const candidateScores = new Map<number, { jaccardScore: number; name: string }>();
    const anchorGames = [...profile.library]
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
      .slice(0, 35);

    for (const game of anchorGames) {
      const similar = await recommender.getSimilarGamesSmart(game.appId, 30);
      for (const s of similar) {
        if (profile.ownedAppIds.has(s.appId)) continue;
        const existing = candidateScores.get(s.appId);
        if (!existing || s.similarity > existing.jaccardScore) {
          candidateScores.set(s.appId, { jaccardScore: s.similarity, name: s.name });
        }
      }
    }

    if (candidateScores.size === 0) return [];

    const candidateIds = [...candidateScores.keys()];
    const rows = await this.repo.getFullMetadataForCandidates(candidateIds);

    const candidateGenres = new Map<number, string[]>();
    const candidateMeta  = new Map<number, typeof rows[0]>();
    for (const row of rows) {
      const combined = [
        ...(row.genres || '').split(','),
        ...(row.tags   || '').split(','),
      ].map((s) => s.trim().toLowerCase()).filter(Boolean);
      candidateGenres.set(row.app_id, [...new Set(combined)]);
      candidateMeta.set(row.app_id, row);
    }

    const scored: ScoredRecommendation[] = [];

    for (const [appId, { jaccardScore, name }] of candidateScores) {
      const genres = candidateGenres.get(appId) || [];

      const genreAlignmentScore = genres.reduce(
        (sum, g) => sum + (profile.genreVector.get(g) ?? 0),
        0
      );

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

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}
