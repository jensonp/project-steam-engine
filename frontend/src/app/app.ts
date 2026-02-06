import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { UserSearchComponent } from './components/user-search/user-search.component';
import { GameLibraryComponent } from './components/game-library/game-library.component';
import { SteamApiService } from './services/steam-api.service';
import { UserLibrary, PlayerSummary } from './types/steam.types';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    UserSearchComponent,
    GameLibraryComponent,
  ],
  templateUrl: "./app.html",
  styleUrl:"./app.css"
})
export class App {
  @ViewChild('searchComponent') searchComponent!: UserSearchComponent;

  library: UserLibrary | null = null;
  profile: PlayerSummary | null = null;
  isLoading = false;

  constructor(private steamApi: SteamApiService) {}

  onSearch(steamId: string): void {
    this.isLoading = true;
    this.library = null;
    this.profile = null;
    this.searchComponent.setLoading(true);
    this.searchComponent.setError('');

    // Fetch both profile and library in parallel
    forkJoin({
      profile: this.steamApi.getUserProfile(steamId),
      library: this.steamApi.getUserLibrary(steamId),
    }).subscribe({
      next: ({ profile, library }) => {
        this.profile = profile;
        this.library = library;
        this.isLoading = false;
        this.searchComponent.setLoading(false);
      },
      error: (error) => {
        this.isLoading = false;
        this.searchComponent.setLoading(false);
        this.searchComponent.setError(error.message);
      }
    });
  }
}
