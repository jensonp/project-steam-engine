// Steam API Response Types

export interface OwnedGame {
  appId: number;
  name: string | null;
  playtimeMinutes: number;
  playtime2Weeks: number | null;
  imgIconUrl?: string;
}

export interface UserLibrary {
  steamId: string;
  gameCount: number;
  games: OwnedGame[];
}

export interface PlayerSummary {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: string | null;
  visibility: number; // 1 = private, 3 = public
}

export interface Friend {
  steamId: string;
  relationship: string; // 'friend' | 'all'
  friendSince: number;  // Unix timestamp
}

export interface UserGenreProfile {
  genre: string;
  weight: number; // L1-normalized share of total weighted playtime
}

export interface UserProfile {
  steamId: string;
  personaName: string;
  avatar: string | null;
  librarySize: number;
  recentGamesCount: number;
  topGenres: UserGenreProfile[];
  friendsAnalyzed: number;
  friendOverlapGames: number;
  ownedAppIds: Set<number>;
  friendOverlapSet: Set<number>;
  genreVector: Map<string, number>;
  library: OwnedGame[];
}

export interface Game {
  appId: number;
  name: string;
  genres: string[];
  tags: string[];
  description: string | null;
  headerImage: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  price: number | null;
  isFree: boolean;
}

// Steam API Raw Response Types
export interface SteamOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name?: string;
      playtime_forever: number;
      playtime_2weeks?: number;
      img_icon_url?: string;
    }>;
  };
}

export interface SteamPlayerSummaryResponse {
  response: {
    players: Array<{
      steamid: string;
      personaname: string;
      profileurl: string;
      avatarfull?: string;
      communityvisibilitystate: number;
    }>;
  };
}

export interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      short_description?: string;
      header_image?: string;
      genres?: Array<{ description: string }>;
      categories?: Array<{ description: string }>;
      release_date?: { date: string };
      developers?: string[];
      publishers?: string[];
      is_free?: boolean;
      price_overview?: {
        final: number; // Price in cents
      };
    };
  };
}

// API Error
export class SteamApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SteamApiError';
  }
}

// Steam Friend List Raw API Response
export interface SteamFriendListResponse {
  friendslist: {
    friends: Array<{
      steamid: string;
      relationship: string;
      friend_since: number;
    }>;
  };
}
