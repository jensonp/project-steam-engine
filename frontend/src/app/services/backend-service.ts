import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { Game, UserProfile, ScoredRecommendation } from '../types/steam.types';

// State interface for strict typing
interface AppState {
  steamId: string;
  userProfile: UserProfile | null;
  recommendations: ScoredRecommendation[];
  searchResults: Game[];
  isLoadingProfile: boolean;
  isLoadingRecommendations: boolean;
  isLoadingSearch: boolean;
  error: string | null;
}

const defaultState: AppState = {
  steamId: '',
  userProfile: null,
  recommendations: [],
  searchResults: [],
  isLoadingProfile: false,
  isLoadingRecommendations: false,
  isLoadingSearch: false,
  error: null
};

const loadInitialState = (): AppState => {
  try {
    const savedState = localStorage.getItem('appState');
    if (!savedState) {
      return { ...defaultState };
    }

    const parsedState = JSON.parse(savedState) as Partial<AppState>;
    return { ...defaultState, ...parsedState };
  } catch (error) {
    console.warn('Failed to load app state from localStorage, using defaults.');
    return { ...defaultState };
  }
};

const initialState: AppState = loadInitialState();

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  private readonly backendUrl = 'http://localhost:3000';
  
  // Single Source of Truth (The Store)
  private state = new BehaviorSubject<AppState>(initialState);

  // ─── Queries (Observables) ──────────────────────────────────────────────────
  steamId$ = new Observable<string>(subscriber => this.state.subscribe(s => subscriber.next(s.steamId)));
  userProfile$ = new Observable<UserProfile | null>(subscriber => this.state.subscribe(s => subscriber.next(s.userProfile)));
  recommendations$ = new Observable<ScoredRecommendation[]>(subscriber => this.state.subscribe(s => subscriber.next(s.recommendations)));
  searchResults$ = new Observable<Game[]>(subscriber => this.state.subscribe(s => subscriber.next(s.searchResults)));
  
  isLoadingProfile$ = new Observable<boolean>(subscriber => this.state.subscribe(s => subscriber.next(s.isLoadingProfile)));
  isLoadingRecommendations$ = new Observable<boolean>(subscriber => this.state.subscribe(s => subscriber.next(s.isLoadingRecommendations)));
  isLoadingSearch$ = new Observable<boolean>(subscriber => this.state.subscribe(s => subscriber.next(s.isLoadingSearch)));
  error$ = new Observable<string | null>(subscriber => this.state.subscribe(s => subscriber.next(s.error)));

  constructor(private http: HttpClient) {}

  // Helper to update partial state immutably and persist to localStorage
  private patchState(partialState: Partial<AppState>) {
    const newState = { ...this.state.value, ...partialState };
    this.state.next(newState);
    try {
      localStorage.setItem('appState', JSON.stringify(newState));
    } catch (error) {
      console.warn('Failed to persist app state to localStorage.');
    }
  }

  // ─── Commands (Actions) ─────────────────────────────────────────────────────

  setSteamId(id: string): void {
    this.patchState({ steamId: id, error: null });
  }

  // Request backend to index user data based on the provided Steam ID
  indexUser(): void {
    const url = `${this.backendUrl}/login/${encodeURIComponent(this.state.value.steamId)}`;
    let params = new HttpParams();

    this.http.post(url, { params }).subscribe({ // request backend to index the user given the steamId
      next: (response) => {
        console.log('Indexing user data successful:', response);
      },
      error: (error) => {
        console.error('Error indexing user:', error);
      }
    });
  }

  // Command: Fetch personalized recommendations
  loadPersonalizedRecommendations(limit: number = 20): void {
    const currentState = this.state.value;
    if (!currentState.steamId) {
      this.patchState({ error: 'Please set a Steam ID first.' });
      return;
    }

    this.patchState({ isLoadingRecommendations: true, error: null });

    const url = `${this.backendUrl}/api/recommend/user/${encodeURIComponent(currentState.steamId)}`;
    const params = new HttpParams().set('limit', limit.toString());

    this.http.get<ScoredRecommendation[]>(url, { params }).pipe(
      tap(recommendations => this.patchState({ recommendations })),
      catchError(error => {
        this.patchState({ error: error.message || 'Failed to load recommendations' });
        return throwError(() => error);
      }),
      finalize(() => this.patchState({ isLoadingRecommendations: false }))
    ).subscribe();
  }

  // Command: Fetch User Profile
  loadUserProfile(): void {
    const currentState = this.state.value;
    if (!currentState.steamId) return;

    this.patchState({ isLoadingProfile: true, error: null });
    
    const url = `${this.backendUrl}/api/recommend/user/${encodeURIComponent(currentState.steamId)}/profile`;
    
    this.http.get<UserProfile>(url).pipe(
      tap(userProfile => this.patchState({ userProfile })),
      catchError(error => {
        this.patchState({ error: error.message || 'Failed to load user profile' });
        return throwError(() => error);
      }),
      finalize(() => this.patchState({ isLoadingProfile: false }))
    ).subscribe();
  }

  // Command: Execute Search
  executeSearch(genres: string, keyword: string, playerCount: string, os?: string): void {
    this.patchState({ isLoadingSearch: true, error: null });

    const url = `${this.backendUrl}/api/search`;
    let params = new HttpParams();

    if (genres?.length > 0) params = params.set('genres', genres);
    if (keyword?.trim().length > 0) params = params.set('keyword', keyword.trim());
    if (playerCount && playerCount !== 'Any') params = params.set('playerCount', playerCount);
    if (os) params = params.set('os', os);

    this.http.get<Game[]>(url, { params }).pipe(
      tap(searchResults => this.patchState({ searchResults })),
      catchError(error => {
        this.patchState({ error: error.message || 'Search failed' });
        return throwError(() => error);
      }),
      finalize(() => this.patchState({ isLoadingSearch: false }))
    ).subscribe();
  }

  // Trigger the backend to index the Steam storefront dataset into PSQL
  indexStorefront(): Observable<unknown> {
    const url = `${this.backendUrl}/index`;
    return this.http.post(url, {});
  }

  // Legacy getters (to avoid breaking components instantly)
  getSteamId(): string {
    return this.state.value.steamId;
  }
}
