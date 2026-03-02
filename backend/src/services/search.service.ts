import { query } from '../config/db';

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

    // 1. Genre Flags
    if (genres.length > 0) {
      const genreConditions = genres.map(g => {
        params.push(`%${g}%`);
        const clause = `(genres ILIKE $${paramIndex} OR tags ILIKE $${paramIndex})`;
        paramIndex++;
        return clause;
      });
      whereClauses.push(`(${genreConditions.join(' AND ')})`);
    }

    // 2. Keyword Filter (Title or Description)
    if (keyword) {
      params.push(`%${keyword}%`);
      whereClauses.push(`(game_name ILIKE $${paramIndex} OR short_description ILIKE $${paramIndex})`);
      paramIndex++;
    }

    // 3. Player Count Filter (Multiplayer, Co-op, Single-player mappings)
    if (playerCount && playerCount !== 'Any') {
      let mappedTerm = playerCount;
      if (playerCount === 'Online') mappedTerm = 'Online PvP';
      
      params.push(`%${mappedTerm}%`);
      whereClauses.push(`categories ILIKE $${paramIndex}`);
      paramIndex++;
    }

    // Construct the final WHERE clause dynamically
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT app_id, game_name, genres, price, header_image
      FROM games
      ${whereString}
      ORDER BY positive_votes DESC
      LIMIT 10
    `;

    const result = await query(sqlQuery, params);
    return this.mapRows(result.rows);
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
