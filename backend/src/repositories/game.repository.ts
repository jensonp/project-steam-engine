import { query } from '../config/db';
import { IGameMetadataRepository, GameMetadata, GameSearchResultRow } from './interfaces';

export class PostgresGameMetadataRepository implements IGameMetadataRepository {
  
  async getMetadataForApps(appIds: number[]): Promise<GameMetadata[]> {
    if (appIds.length === 0) return [];
    
    const placeholders = appIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query<{ app_id: number; genres: string; tags: string; header_image: string | null; short_description: string | null; price: string | null; }>(
      `SELECT app_id, genres, tags, header_image, short_description, price FROM games WHERE app_id IN (${placeholders})`,
      appIds
    );
    
    return result.rows;
  }

  async getFullMetadataForCandidates(appIds: number[]): Promise<GameMetadata[]> {
    if (appIds.length === 0) return [];

    const placeholders = appIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query<{ app_id: number; genres: string; tags: string; header_image: string | null; short_description: string | null; price: string | null; }>(
      `SELECT app_id, genres, tags, header_image, short_description, price FROM games WHERE app_id IN (${placeholders})`,
      appIds
    );
    
    return result.rows;
  }

  async searchGames(sqlQuery: string, params: any[]): Promise<GameSearchResultRow[]> {
    const result = await query<GameSearchResultRow>(sqlQuery, params);
    return result.rows;
  }
}
