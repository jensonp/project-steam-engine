import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  backendUrl = 'http://localhost:3000';
  
  constructor(private http: HttpClient) {}

  // Request backend to index user data based on the provided Steam ID
  indexUser(steamId: string): void {
    const url = `${this.backendUrl}/login/${encodeURIComponent(steamId)}`;
    this.http.post(url, {}).subscribe({ // request backend to index the user given the steamId
      next: (response) => {
        console.log('Indexing user data successful:', response);
      },
      error: (error) => {
        console.error('Error indexing user:', error);
      }
    });
  }

  // Return list of recommended games for the user based on the query and their user data
  getRecommendations(steamId: string, genres: string, keywords: string, os_compat: boolean): Observable<string[]> {
    const url = `${this.backendUrl}/query`;
    let params = new HttpParams();

    params = params.set('genres', genres);
    params = params.set('keywords', keywords);
    params = params.set('os_compat', String(os_compat));

    return this.http.get<string[]>(url, { params });
  }

  // Trigger the backend to index the Steam storefront dataset into PSQL
  indexStorefront(): void {
    const url = `${this.backendUrl}/index`;
    this.http.post(url, {}).subscribe({
      next: (response) => {
        console.log('Indexing storefront successful:', response);
      },
      error: (error) => {
        console.error('Error indexing storefront:', error);
      }
    });
  }
}
