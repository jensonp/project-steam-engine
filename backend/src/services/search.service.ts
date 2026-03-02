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
   * Search for top games matching the given genres, ordered by positive votes.
   * If no genres are provided, returns the top games overall.
   */
  async searchByGenres(genres: string[]): Promise<GameSearchResult[]> {
    if (genres.length === 0) {
      const result = await query(`
        SELECT app_id, game_name, genres, price, header_image
        FROM games
        ORDER BY positive_votes DESC
        LIMIT 10
      `);
      return this.mapRows(result.rows);
    }

    const params = genres.map(g => `%${g}%`);
    const conditions = genres.map((_, i) => `(genres ILIKE $${i + 1} OR tags ILIKE $${i + 1})`);

    const sqlQuery = `
      SELECT app_id, game_name, genres, price, header_image
      FROM games
      WHERE ${conditions.join(' AND ')}
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
