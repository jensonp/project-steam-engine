import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { GameCardComponent } from '../game-card/game-card.component';
import { UserLibrary, PlayerSummary, OwnedGame, Game } from '../../types/steam.types';
import { SteamApiService } from '../../services/steam-api.service';

type SortOption = 'playtime' | 'name' | 'recent';

@Component({
  selector: 'app-game-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    GameCardComponent,
  ],
  template: `
    @if (profile) {
      <div class="library-header">
        <div class="profile-info">
          @if (profile.avatar) {
            <img [src]="profile.avatar" [alt]="profile.personaName" class="avatar" />
          }
          <div class="profile-details">
            <h2>{{ profile.personaName }}</h2>
            <p>{{ library?.gameCount || 0 }} games in library</p>
          </div>
        </div>

        <div class="controls">
          <mat-form-field appearance="outline" class="sort-select">
            <mat-label>Sort by</mat-label>
            <mat-select [(ngModel)]="sortBy" (selectionChange)="sortGames()">
              <mat-option value="playtime">Most Played</mat-option>
              <mat-option value="name">Name (A-Z)</mat-option>
              <mat-option value="recent">Recently Played</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-button-toggle-group [(ngModel)]="viewMode" class="view-toggle">
            <mat-button-toggle value="grid">
              <mat-icon>grid_view</mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="list">
              <mat-icon>view_list</mat-icon>
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>
    }

    @if (isLoading) {
      <div class="loading">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading game library...</p>
      </div>
    } @else if (sortedGames.length > 0) {
      <div class="games-grid" [class.list-view]="viewMode === 'list'">
        @for (game of sortedGames; track game.appId) {
          <app-game-card 
            [game]="game" 
            [details]="gameDetails.get(game.appId)"
          ></app-game-card>
        }
      </div>
    } @else if (library) {
      <div class="empty-state">
        <mat-icon>sports_esports</mat-icon>
        <p>No games found in this library.</p>
      </div>
    }
  `,
  styles: [`
    .library-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      background-color: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .profile-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 3px solid #1976d2;
    }

    .profile-details h2 {
      margin: 0;
      font-size: 1.5rem;
    }

    .profile-details p {
      margin: 0.25rem 0 0 0;
      color: #666;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .sort-select {
      width: 180px;
    }

    .view-toggle {
      border-radius: 4px;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: #666;
    }

    .loading p {
      margin-top: 1rem;
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      padding: 1rem 0;
    }

    .games-grid.list-view {
      grid-template-columns: 1fr;
    }

    .games-grid.list-view app-game-card {
      max-width: 600px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 1rem;
    }

    @media (max-width: 600px) {
      .library-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .controls {
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class GameLibraryComponent implements OnChanges {
  @Input() library: UserLibrary | null = null;
  @Input() profile: PlayerSummary | null = null;
  @Input() isLoading = false;

  sortBy: SortOption = 'playtime';
  viewMode: 'grid' | 'list' = 'grid';
  sortedGames: OwnedGame[] = [];
  gameDetails = new Map<number, Game>();

  private loadedDetails = new Set<number>();

  constructor(private steamApi: SteamApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['library'] && this.library) {
      this.sortGames();
      this.loadTopGameDetails();
    }
  }

  sortGames(): void {
    if (!this.library?.games) {
      this.sortedGames = [];
      return;
    }

    const games = [...this.library.games];

    switch (this.sortBy) {
      case 'playtime':
        games.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);
        break;
      case 'name':
        games.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'recent':
        games.sort((a, b) => (b.playtime2Weeks || 0) - (a.playtime2Weeks || 0));
        break;
    }

    this.sortedGames = games;
  }

  /**
   * Load details for top games (most played)
   */
  private loadTopGameDetails(): void {
    if (!this.library?.games) return;

    // Get top 20 games by playtime
    const topGames = [...this.library.games]
      .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
      .slice(0, 20);

    // Load details for games we haven't loaded yet
    for (const game of topGames) {
      if (!this.loadedDetails.has(game.appId)) {
        this.loadedDetails.add(game.appId);
        this.loadGameDetails(game.appId);
      }
    }
  }

  private loadGameDetails(appId: number): void {
    this.steamApi.getGameDetails(appId).subscribe({
      next: (details) => {
        this.gameDetails.set(appId, details);
      },
      error: (err) => {
        console.warn(`Failed to load details for ${appId}:`, err);
      }
    });
  }
}
