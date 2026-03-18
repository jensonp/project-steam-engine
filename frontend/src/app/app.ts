import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { UserSearchComponent } from './components/user-search/user-search.component';
// import { GameLibraryComponent } from './components/game-library/game-library.component';
import { SteamApiService } from './services/steam-api.service';
import { UserLibrary, PlayerSummary } from './types/steam.types';
import { forkJoin } from 'rxjs';
import { RouterOutlet, RouterLinkWithHref } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    RouterOutlet,
    RouterLinkWithHref
],
  templateUrl: "./app.html",
  styleUrl:"./app.css",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App {
  @ViewChild('searchComponent') searchComponent!: UserSearchComponent;

  library: UserLibrary | null = null;
  profile: PlayerSummary | null = null;
  isLoading = false;
  valveEnabled = true;
  readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  private readonly valveStorageKey = 'ui.query.valveEnabled';
  private modelViewerImportPromise: Promise<unknown> | null = null;

  constructor(private steamApi: SteamApiService) {
    if (typeof window !== 'undefined') {
      const savedValveState = window.localStorage.getItem(this.valveStorageKey);
      if (savedValveState !== null) {
        this.valveEnabled = savedValveState === '1';
      }
    }

    if (this.valveEnabled) {
      this.ensureModelViewerLoaded();
    }
  }

  toggleValveBackdrop(): void {
    this.valveEnabled = !this.valveEnabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.valveStorageKey, this.valveEnabled ? '1' : '0');
    }
    if (this.valveEnabled) {
      this.ensureModelViewerLoaded();
    }
  }

  private ensureModelViewerLoaded(): void {
    if (typeof window === 'undefined' || this.modelViewerImportPromise) return;

    this.modelViewerImportPromise = import('@google/model-viewer').catch((error) => {
      console.warn('Failed to load model-viewer module for valve button.', error);
      this.modelViewerImportPromise = null;
    });
  }

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
