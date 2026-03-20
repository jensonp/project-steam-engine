import { PostgresGameMetadataRepository } from '../repositories/game.repository';
import { canonicalizeAppId } from '../utils/canonical-app-id';

export interface GameSearchResult {
  appId: number;
  name: string;
  genres: string[];
  headerImage: string;
  price: number | null;
  isFree: boolean;
}

export class SearchService {
  private static readonly FULL_TEXT_VECTOR_SQL = [
    "setweight(to_tsvector('english', coalesce(game_name, '')), 'A')",
    "setweight(to_tsvector('english', coalesce(short_description, '')), 'B')",
  ].join(' || ');

  /**
   * Search for top games matching the given filters, ordered by positive votes.
   */
  async searchByGenres(
    genres: string[],
    keyword?: string,
    playerCount?: string,
    os?: string,
    limit: number = 10
  ): Promise<GameSearchResult[]> {
    const repo = new PostgresGameMetadataRepository();
    const primaryQuery = this.buildSearchQuery(genres, keyword, playerCount, os, limit, true);

    try {
      const rows = await repo.searchGames(primaryQuery.sqlQuery, primaryQuery.params);
      return this.mapRows(rows, limit);
    } catch (error: any) {
      if (os && this.isMissingOsSupportColumnError(error)) {
        console.warn(
          '[SearchService] OS support columns missing in games table. Retrying search without OS filter.'
        );

        const fallbackQuery = this.buildSearchQuery(genres, keyword, playerCount, os, limit, false);
        const rows = await repo.searchGames(fallbackQuery.sqlQuery, fallbackQuery.params);
        return this.mapRows(rows, limit);
      }

      throw error;
    }
  }

  private buildSearchQuery(
    genres: string[],
    keyword?: string,
    playerCount?: string,
    os?: string,
    limit: number = 10,
    includeOsFilter = true
  ): { sqlQuery: string; params: any[] } {
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // 1. Genre/Tag Flags using pg_trgm
    if (genres.length > 0) {
      const genreConditions = genres.map(g => {
        params.push(g);
        const clause = `(genres % $${paramIndex} OR tags % $${paramIndex})`;
        paramIndex++;
        return clause;
      });
      whereClauses.push(`(${genreConditions.join(' AND ')})`);
    }

    // 2. Keyword Filter using tsvector native full-text search
    let keywordParamIndex: number | null = null;
    if (keyword) {
      params.push(keyword);
      keywordParamIndex = paramIndex;
      // Plainto_tsquery automatically handles spaces and word stemming
      whereClauses.push(
        `(${SearchService.FULL_TEXT_VECTOR_SQL}) @@ plainto_tsquery('english', $${paramIndex})`
      );
      paramIndex++;
    }

    // 3. Player Count Filter using pg_trgm overlap
    if (playerCount && playerCount !== 'Any') {
      let mappedTerm = playerCount;
      if (playerCount === 'Online') mappedTerm = 'Online PvP';
      
      params.push(mappedTerm);
      whereClauses.push(`categories % $${paramIndex}`);
      paramIndex++;
    }

    // 4. Native OS Support Filter
    if (os && includeOsFilter) {
      const normalizedOs = os.toLowerCase();
      if (normalizedOs === 'windows') {
        whereClauses.push('windows_support = TRUE');
      } else if (normalizedOs === 'mac') {
        whereClauses.push('mac_support = TRUE');
      } else if (normalizedOs === 'linux') {
        whereClauses.push('linux_support = TRUE');
      }
    }

    // Construct the final WHERE clause dynamically
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sqlLimit =
      limit <= 20
        ? Math.max(limit * 4, 40)
        : Math.min(Math.max(limit * 2, 80), 240);

    const sqlQuery = `
      SELECT app_id, game_name, genres, price, header_image
      FROM games
      ${whereString}
      ${keyword 
        ? `ORDER BY ts_rank_cd((${SearchService.FULL_TEXT_VECTOR_SQL}), plainto_tsquery('english', $${keywordParamIndex})) DESC, positive_votes DESC` 
        : `ORDER BY positive_votes DESC`}
      LIMIT ${sqlLimit}
    `;

    return { sqlQuery, params };
  }

  private isMissingOsSupportColumnError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    return (
      error?.code === '42703' &&
      (message.includes('windows_support') ||
        message.includes('mac_support') ||
        message.includes('linux_support'))
    );
  }

  /**
   * Helper to map raw database rows into strongly-typed frontend objects
   */
  private mapRows(rows: any[], limit: number): GameSearchResult[] {
    const deduped: GameSearchResult[] = [];
    const seenCanonicalIds = new Set<number>();

    for (const row of rows) {
      const canonicalAppId = canonicalizeAppId(row.app_id, row.header_image);
      if (seenCanonicalIds.has(canonicalAppId)) continue;
      seenCanonicalIds.add(canonicalAppId);

      deduped.push({
        appId: canonicalAppId,
        name: row.game_name,
        genres: row.genres ? row.genres.split(',') : [],
        headerImage: row.header_image,
        price: row.price ? parseFloat(row.price) : null,
        isFree: parseFloat(row.price) === 0
      });

      if (deduped.length >= limit) break;
    }

    return deduped;
  }
}
