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
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <mat-icon>sports_esports</mat-icon>
      <span>Steam Game Recommender</span>
    </mat-toolbar>

    <main class="main-content">
      <app-user-search 
        #searchComponent
        (search)="onSearch($event)"
      ></app-user-search>

      <app-game-library
        [library]="library"
        [profile]="profile"
        [isLoading]="isLoading"
      ></app-game-library>
    </main>

    <footer class="app-footer">
      <p>Built with Angular + Node.js | Steam Web API</p>
    </footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-toolbar {
      gap: 0.5rem;
    }

    .app-toolbar mat-icon {
      font-size: 28px;
    }

    .main-content {
      flex: 1;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    .app-footer {
      text-align: center;
      padding: 1rem;
      background-color: #f5f5f5;
      color: #666;
      font-size: 0.875rem;
    }

    @media (max-width: 600px) {
      .main-content {
        padding: 1rem;
      }
    }
  `]
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
