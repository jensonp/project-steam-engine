import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import {
  OwnedGame,
  UserLibrary,
  PlayerSummary,
  Game,
  SteamOwnedGamesResponse,
  SteamPlayerSummaryResponse,
  SteamAppDetailsResponse,
  SteamApiError,
} from '../types/steam.types';

/**
 * Service for interacting with the Steam Web API
 */
export class SteamService {
  private apiClient: AxiosInstance;
  private storeClient: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.steamApiKey;
    
    if (!this.apiKey) {
      throw new Error(
        'Steam API key is required. Set STEAM_API_KEY in .env file.'
      );
    }

    // Client for main Steam API
    this.apiClient = axios.create({
      baseURL: config.steamApiBaseUrl,
      timeout: 30000,
    });

    // Client for Steam Store API
    this.storeClient = axios.create({
      baseURL: config.steamStoreApiUrl,
      timeout: 30000,
    });
  }

  /**
   * Fetch a user's owned games
   */
  async getOwnedGames(
    steamId: string,
    includeAppInfo: boolean = true,
    includeFreeGames: boolean = true
  ): Promise<UserLibrary> {
    try {
      const response = await this.apiClient.get<SteamOwnedGamesResponse>(
        '/IPlayerService/GetOwnedGames/v1/',
        {
          params: {
            key: this.apiKey,
            steamid: steamId,
            include_appinfo: includeAppInfo ? 1 : 0,
            include_played_free_games: includeFreeGames ? 1 : 0,
            format: 'json',
          },
        }
      );

      const data = response.data.response;

      // Empty response usually means private profile
      if (!data || !data.games) {
        throw new SteamApiError(
          'No data returned. User profile may be private.',
          403
        );
      }

      const games: OwnedGame[] = data.games.map((game) => ({
        appId: game.appid,
        name: game.name || null,
        playtimeMinutes: game.playtime_forever || 0,
        playtime2Weeks: game.playtime_2weeks || null,
        imgIconUrl: game.img_icon_url,
      }));

      return {
        steamId,
        gameCount: data.game_count || games.length,
        games,
      };
    } catch (error) {
      if (error instanceof SteamApiError) throw error;
      if (axios.isAxiosError(error)) {
        throw new SteamApiError(
          `HTTP error: ${error.response?.status || 'unknown'}`,
          error.response?.status
        );
      }
      throw new SteamApiError(`Request failed: ${error}`);
    }
  }

  /**
   * Fetch a user's recently played games
   */
  async getRecentlyPlayedGames(
    steamId: string,
    count: number = 10
  ): Promise<OwnedGame[]> {
    try {
      const response = await this.apiClient.get<SteamOwnedGamesResponse>(
        '/IPlayerService/GetRecentlyPlayedGames/v1/',
        {
          params: {
            key: this.apiKey,
            steamid: steamId,
            count,
            format: 'json',
          },
        }
      );

      const games = response.data.response?.games || [];

      return games.map((game) => ({
        appId: game.appid,
        name: game.name || null,
        playtimeMinutes: game.playtime_forever || 0,
        playtime2Weeks: game.playtime_2weeks || null,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SteamApiError(
          `HTTP error: ${error.response?.status || 'unknown'}`,
          error.response?.status
        );
      }
      throw new SteamApiError(`Request failed: ${error}`);
    }
  }

  /**
   * Fetch a player's profile summary
   */
  async getPlayerSummary(steamId: string): Promise<PlayerSummary> {
    try {
      const response = await this.apiClient.get<SteamPlayerSummaryResponse>(
        '/ISteamUser/GetPlayerSummaries/v2/',
        {
          params: {
            key: this.apiKey,
            steamids: steamId,
            format: 'json',
          },
        }
      );

      const players = response.data.response?.players || [];

      if (players.length === 0) {
        throw new SteamApiError(`Player not found: ${steamId}`, 404);
      }

      const player = players[0];

      return {
        steamId: player.steamid,
        personaName: player.personaname || 'Unknown',
        profileUrl: player.profileurl || '',
        avatar: player.avatarfull || null,
        visibility: player.communityvisibilitystate || 1,
      };
    } catch (error) {
      if (error instanceof SteamApiError) throw error;
      if (axios.isAxiosError(error)) {
        throw new SteamApiError(
          `HTTP error: ${error.response?.status || 'unknown'}`,
          error.response?.status
        );
      }
      throw new SteamApiError(`Request failed: ${error}`);
    }
  }

  /**
   * Fetch detailed information about a game from the Steam Store API
   */
  async getAppDetails(appId: number): Promise<Game | null> {
    try {
      const response = await this.storeClient.get<SteamAppDetailsResponse>(
        '/appdetails',
        {
          params: {
            appids: appId,
            cc: 'us',
            l: 'en',
          },
        }
      );

      const appData = response.data[String(appId)];

      if (!appData?.success || !appData.data) {
        return null;
      }

      const details = appData.data;

      // Extract genres
      const genres = details.genres?.map((g) => g.description) || [];

      // Extract categories as tags
      const tags = details.categories?.map((c) => c.description) || [];

      // Extract price
      let price: number | null = null;
      const isFree = details.is_free || false;

      if (!isFree && details.price_overview) {
        price = details.price_overview.final / 100; // Convert cents to dollars
      }

      return {
        appId,
        name: details.name || 'Unknown',
        genres,
        tags,
        description: details.short_description || null,
        headerImage: details.header_image || null,
        releaseDate: details.release_date?.date || null,
        developers: details.developers || [],
        publishers: details.publishers || [],
        price,
        isFree,
      };
    } catch (error) {
      // Store API errors shouldn't crash - just return null
      console.error(`Failed to fetch app details for ${appId}:`, error);
      return null;
    }
  }
}

// Singleton instance
let steamServiceInstance: SteamService | null = null;

/**
 * Get or create a SteamService instance
 */
export function getSteamService(): SteamService {
  if (!steamServiceInstance) {
    steamServiceInstance = new SteamService();
  }
  return steamServiceInstance;
}
