import { Component, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BackendService } from '../../services/backend-service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserProfile, Game, ScoredRecommendation } from '../../types/steam.types';

@Component({
  selector: 'app-query-screen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './query-screen.html',
  styleUrl: './query-screen.css',
})
export class QueryScreen {
  genres: string[] = [
    'Action',
    'Adventure',
    'RPG',
    'Strategy',
    'Simulation',
    'Sports',
    'Racing',
    'Indie',
    'Casual',
    'Horror'
  ]

  player_counts: string[] = [
    'Any',
    'Single-player',
    'Multiplayer',
    'Co-op',
    'Online'
  ]

  selected_genre: string[] = [];
  selected_player_count: string = '';
  keyword_input: string = '';
  steamId_input: string = '';
  
  steamID_configured: boolean = false;
  
  // Strict RxJS State Subscriptions
  isLoading = false;
  isLoadingProfile = false;
  error: string | null = null;
  userProfile: UserProfile | null = null;
  
  private subs = new Subscription();

  constructor(private backendService: BackendService, private router: Router) {
    this.steamID_configured = Boolean(this.backendService.getSteamId());
  }

  ngOnInit() {
    this.subs.add(this.backendService.isLoadingSearch$.subscribe(l => this.isLoading = l));
    this.subs.add(this.backendService.isLoadingRecommendations$.subscribe(l => this.isLoading = l));
    this.subs.add(this.backendService.isLoadingProfile$.subscribe(l => this.isLoadingProfile = l));
    this.subs.add(this.backendService.error$.subscribe(e => this.error = e));
    this.subs.add(this.backendService.userProfile$.subscribe(p => this.userProfile = p));

    // Listen to changes in search and recommendation lists and navigate immediately upon receiving data
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      // Only navigate if we actually have a result payload emitted explicitly
      if (results && results.length > 0 && !this.isLoading) {
        this.router.navigate(['/results'], { state: { results } });
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(results => {
      if (results && results.length > 0 && !this.isLoading) {
        this.router.navigate(['/results'], { state: { results } });
      }
    }));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  /**
   * Fetches the user's Steam profile (genre vector, friend stats, top genres)
   * and populates the profile card in the UI.
   */
  /**
   * Fetches the user's Steam profile via Command/Query
   */
  loadSteamProfile(): void {
    if (!this.steamId_input || this.steamId_input.length !== 17) return;

    this.backendService.setSteamId(this.steamId_input);
    this.backendService.loadUserProfile();
  }

  /**
   * If a Steam profile is loaded, fires the personalized 3-signal recommendation engine.
   * Falls back to the generic genre/keyword search when no Steam ID is provided.
   */
  /**
   * Dispatches a command to load recommendations or generic search
   */
  onQuery(): void {
    if (this.userProfile && this.steamId_input) {
      this.backendService.setSteamId(this.steamId_input);
      this.backendService.loadPersonalizedRecommendations(20);
    } else {
      const genresParam = this.selected_genre.join(',');
      this.backendService.executeSearch(genresParam, this.keyword_input, this.selected_player_count);
    }
  }

}
