import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

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
  getRecommendations(genres: string, keywords: string, os_compat: boolean): Observable<string[]> {
    const url = `${this.backendUrl}/query`;
    let params = new HttpParams();

    params = params.set('genres', genres);
    params = params.set('keywords', keywords);
    params = params.set('os_compat', String(os_compat));

    return this.http.get<string[]>(url, { params });
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
