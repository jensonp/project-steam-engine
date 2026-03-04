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
  apiKey_configured: boolean = false;
  isLoading = false;
  isLoadingProfile = false;
  error = '';
  userProfile: any = null;

  constructor(private backendService: BackendService, private router: Router) {
    this.steamID_configured = Boolean(this.backendService.getSteamId());
    this.apiKey_configured = Boolean(this.backendService.getApiKey());
  }

  /**
   * Fetches the user's Steam profile (genre vector, friend stats, top genres)
   * and populates the profile card in the UI.
   */
  loadSteamProfile(): void {
    if (!this.steamId_input || this.steamId_input.length !== 17) return;

    this.isLoadingProfile = true;
    this.error = '';
    this.userProfile = null;

    this.backendService.getUserProfile(this.steamId_input).subscribe({
      next: (profile) => {
        this.userProfile = profile;
        this.isLoadingProfile = false;
      },
      error: (err) => {
        console.error('Error loading Steam profile:', err);
        this.error = 'Failed to load Steam profile. Ensure your Steam profile is set to public.';
        this.isLoadingProfile = false;
      }
    });
  }

  /**
   * If a Steam profile is loaded, fires the personalized 3-signal recommendation engine.
   * Falls back to the generic genre/keyword search when no Steam ID is provided.
   */
  onQuery(): void {
    this.isLoading = true;
    this.error = '';

    if (this.userProfile && this.steamId_input) {
      // Personalized path: Steam library + friend graph + genre alignment
      this.backendService.getPersonalizedRecommendations(this.steamId_input, 20).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.router.navigate(['/results'], { state: { results: response } });
        },
        error: (err) => {
          console.error('Error fetching personalized recommendations:', err);
          this.error = 'An error occurred while fetching recommendations. Please try again.';
          this.isLoading = false;
        }
      });
    } else {
      // Generic path: genre / keyword / player count search
      const genresParam = this.selected_genre.join(',');
      this.backendService.getRecommendations(genresParam, this.keyword_input, this.selected_player_count).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.router.navigate(['/results'], { state: { results: response } });
        },
        error: (error) => {
          console.error('Error fetching recommendations:', error);
          this.error = 'An error occurred while fetching recommendations. Please try again.';
          this.isLoading = false;
        }
      });
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}
