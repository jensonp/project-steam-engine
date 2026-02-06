// Steam API Types - shared with backend

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
  visibility: number;
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

export interface ApiError {
  error: string;
  code?: number;
}
