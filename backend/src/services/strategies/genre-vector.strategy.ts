import { OwnedGame } from '../../types/steam.types';
import { IGameMetadataRepository } from '../../repositories/interfaces';

const RECENCY_BOOST = 1.5;

export class GenreVectorStrategy {
  constructor(private readonly repo: IGameMetadataRepository) {}

  async buildVector(library: OwnedGame[], recentAppIds: Set<number>): Promise<Map<string, number>> {
    if (library.length === 0) return new Map();

    const appIds = library.map((g) => g.appId);
    const rows = await this.repo.getMetadataForApps(appIds);

    const genreMap = new Map<number, string[]>();
    for (const row of rows) {
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

    const total = [...rawVector.values()].reduce((s, v) => s + v, 0);
    if (total === 0) return rawVector;

    for (const [genre, weight] of rawVector) {
      rawVector.set(genre, weight / total);
    }

    return rawVector;
  }
}
