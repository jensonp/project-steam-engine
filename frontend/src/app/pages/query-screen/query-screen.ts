import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserSearchComponent } from '../../components/user-search/user-search.component';

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

  @Output() search = new EventEmitter<string>();
  
  isLoading = false;
  error = '';

  onSearch(): void {
    if (this.keyword_input.trim()) {
      this.error = '';
      this.search.emit(this.keyword_input.trim());
    }
  }

  onSteamIdEnter(): void {
    if (this.steamID.trim()) {
      this.error = '';
      this.search.emit(this.steamID.trim());
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}
