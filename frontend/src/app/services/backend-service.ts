import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { Game } from '../types/steam.types';

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  backendUrl = 'http://localhost:3000';
  private steamId: string = '';
  private apiKey: string = '';
  
  constructor(private http: HttpClient) {}

  // Request backend to index user data based on the provided Steam ID
  // This should not be called without a valid Steam ID and API key set in the service, otherwise the backend will reject the request and log an error
  indexUser(): void {
    const url = `${this.backendUrl}/login/${encodeURIComponent(this.steamId)}`;
    let params = new HttpParams();
    params = params.set('apiKey', this.apiKey);

    this.http.post(url, { params }).subscribe({ // request backend to index the user given the steamId
      next: (response) => {
        console.log('Indexing user data successful:', response);
      },
      error: (error) => {
        console.error('Error indexing user:', error);
      }
    });
  }

  // Return list of recommended games for the user based on the query and their user data
  getRecommendations(genres: string, keyword: string, playerCount: string): Observable<Game[]> {
    const url = `${this.backendUrl}/api/search`;
    let params = new HttpParams();

    if (genres && genres.length > 0) {
      params = params.set('genres', genres);
    }
    
    if (keyword && keyword.trim().length > 0) {
      params = params.set('keyword', keyword.trim());
    }
    
    if (playerCount && playerCount !== 'Any') {
      params = params.set('playerCount', playerCount);
    }

    return this.http.get<Game[]>(url, { params });
  }

  // Fetch the aggregated Steam profile (genre vector, friend stats, top genres)
  getUserProfile(steamId: string): Observable<any> {
    const url = `${this.backendUrl}/api/recommend/user/${encodeURIComponent(steamId)}/profile`;
    return this.http.get<any>(url);
  }

  // Fetch personalized recommendations driven by the user's Steam library + friend graph
  getPersonalizedRecommendations(steamId: string, limit: number = 20): Observable<any[]> {
    const url = `${this.backendUrl}/api/recommend/user/${encodeURIComponent(steamId)}`;
    let params = new HttpParams().set('limit', limit.toString());
    return this.http.get<any[]>(url, { params });
  }

  // Trigger the backend to index the Steam storefront dataset into PSQL
  indexStorefront(): Observable<unknown> {
    const url = `${this.backendUrl}/index`;
    return this.http.post(url, {});
  }

  getSteamId(): string {
    return this.steamId;
  }

  setSteamId(id: string): void {
    this.steamId = id;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }
}
