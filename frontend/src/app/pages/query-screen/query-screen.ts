import { Component, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserSearchComponent } from '../../components/user-search/user-search.component';
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
    MatSelectModule,
    UserSearchComponent
],
  templateUrl: './query-screen.html',
  styleUrl: './query-screen.css',
})
export class QueryScreen {

  constructor(private backendService: BackendService, private router: Router) {}

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

  selected_genre: string = '';
  selected_player_count: string = '';
  keyword_input: string = '';
  steamID = '';  
  isLoading = false;
  error = '';

  onQuery(): void {
    if (this.keyword_input.trim()) {
      this.error = '';
    }

    this.router.navigate(['/results']); // Go to results page immediately, results will load when backend responds
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }

  // This will be called by UserSearchComponent when a valid Steam ID is entered
  onSteamIDReceived($event: string): void {
    this.steamID = $event;
  }
}
