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
  templateUrl: "./game-library.component.html",
  styleUrl: "./game-library.component.css"
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
