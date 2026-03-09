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

export interface UserGenreProfile {
  genre: string;
  weight: number; 
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

export interface ScoredRecommendation {
  appId: number;
  name: string;
  score: number;
  jaccardScore: number;
  genreAlignmentScore: number;
  socialScore: number;
  reason: string;
  headerImage: string | null;
  genres: string[];
  tags: string[];
  description: string | null;
  price: number | null;
  isFree: boolean;
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
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
