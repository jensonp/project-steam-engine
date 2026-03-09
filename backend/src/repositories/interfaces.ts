// src/repositories/interfaces.ts

export interface GameMetadata {
  app_id: number;
  genres: string;
  tags: string;
  header_image: string | null;
  short_description: string | null;
  price: string | null;
}

export interface GameSearchResultRow {
  app_id: number;
  game_name: string;
  genres: string;
  price: string | null;
  header_image: string;
}

export interface IGameMetadataRepository {
  /**
   * Fetch genre and tag metadata for a specific list of app IDs
   */
  getMetadataForApps(appIds: number[]): Promise<GameMetadata[]>;

  /**
   * Fetch full display metadata for candidate recommendations
   */
  getFullMetadataForCandidates(appIds: number[]): Promise<GameMetadata[]>;
  
  /**
   * Search database based on genres, keyword, and multiplayer status
   */
  searchGames(sqlQuery: string, params: any[]): Promise<GameSearchResultRow[]>;
}
