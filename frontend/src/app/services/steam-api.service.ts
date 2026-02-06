import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserLibrary, PlayerSummary, Game, OwnedGame } from '../types/steam.types';

@Injectable({
  providedIn: 'root'
})
export class SteamApiService {
  private readonly apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  /**
   * Get user's game library
   */
  getUserLibrary(steamId: string, includeFreeGames: boolean = true): Observable<UserLibrary> {
    const params = { includeFreeGames: String(includeFreeGames) };
    return this.http
      .get<UserLibrary>(`${this.apiUrl}/user/${steamId}/library`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Get user's recently played games
   */
  getRecentlyPlayed(steamId: string, count: number = 10): Observable<OwnedGame[]> {
    const params = { count: String(count) };
    return this.http
      .get<OwnedGame[]>(`${this.apiUrl}/user/${steamId}/recent`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Get user's profile summary
   */
  getUserProfile(steamId: string): Observable<PlayerSummary> {
    return this.http
      .get<PlayerSummary>(`${this.apiUrl}/user/${steamId}/profile`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get game details
   */
  getGameDetails(appId: number): Observable<Game> {
    return this.http
      .get<Game>(`${this.apiUrl}/game/${appId}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Check API health
   */
  checkHealth(): Observable<{ status: string; apiKeyConfigured: boolean }> {
    return this.http.get<{ status: string; apiKeyConfigured: boolean }>(
      `${this.apiUrl}/health`
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.status === 403) {
        errorMessage = 'User profile is private. Cannot access game library.';
      } else if (error.status === 404) {
        errorMessage = 'User or game not found.';
      } else if (error.error?.error) {
        errorMessage = error.error.error;
      } else {
        errorMessage = `Server error: ${error.status}`;
      }
    }

    console.error('API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
