import { PostgresGameMetadataRepository } from '../repositories/game.repository';

export interface GameSearchResult {
  appId: number;
  name: string;
  genres: string[];
  headerImage: string;
  price: number | null;
  isFree: boolean;
}

export class SearchService {
  /**
   * Search for top games matching the given filters, ordered by positive votes.
   */
  async searchByGenres(genres: string[], keyword?: string, playerCount?: string): Promise<GameSearchResult[]> {
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
      whereClauses.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
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

    // Construct the final WHERE clause dynamically
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT app_id, game_name, genres, price, header_image
      FROM games
      ${whereString}
      ${keyword 
        ? `ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', $${keywordParamIndex})) DESC, positive_votes DESC` 
        : `ORDER BY positive_votes DESC`}
      LIMIT 10
    `;

    const repo = new PostgresGameMetadataRepository();
    const rows = await repo.searchGames(sqlQuery, params);
    return this.mapRows(rows);
  }

  /**
   * Helper to map raw database rows into strongly-typed frontend objects
   */
  private mapRows(rows: any[]): GameSearchResult[] {
    return rows.map(row => ({
      appId: row.app_id,
      name: row.game_name,
      genres: row.genres ? row.genres.split(',') : [],
      headerImage: row.header_image,
      price: row.price ? parseFloat(row.price) : null,
      isFree: parseFloat(row.price) === 0
    }));
  }
}
