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
  steamID_configured: boolean = false;
  apiKey_configured: boolean = false;
  isLoading = false;
  error = '';

  constructor(private backendService: BackendService, private router: Router) {
    this.steamID_configured = Boolean(this.backendService.getSteamId());
    this.apiKey_configured = Boolean(this.backendService.getApiKey());
  }

  onQuery(): void {
    this.isLoading = true;
    if (this.keyword_input.trim()) {
      this.error = '';
    }

    const genresParam = this.selected_genre.join(',')
    this.backendService.getRecommendations(genresParam, this.keyword_input, this.selected_player_count === 'Online').subscribe({
      next: (response) => {
        console.log('Received recommendations:', response);
        this.isLoading = false;
        this.router.navigate(['/results'], { state: { results: response } }); // Pass results to results page via router state
      },
      error: (error) => {
        console.error('Error fetching recommendations:', error);
        this.error = 'An error occurred while fetching recommendations. Please try again.';
        this.isLoading = false;
      }
    });

  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}
