import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { UserSearchComponent } from './components/user-search/user-search.component';
// import { GameLibraryComponent } from './components/game-library/game-library.component';
import { SteamApiService } from './services/steam-api.service';
import { UserLibrary, PlayerSummary } from './types/steam.types';
import { forkJoin } from 'rxjs';
import { NavigationEnd, Router, RouterOutlet, RouterLinkWithHref } from '@angular/router';

type ValveSpinMode = 'flat' | 'full';

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
export class App implements OnDestroy {
  @ViewChild('searchComponent') searchComponent!: UserSearchComponent;

  library: UserLibrary | null = null;
  profile: PlayerSummary | null = null;
  isLoading = false;
  valveEnabled = true;
  valveSpinMode: ValveSpinMode = 'flat';
  readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  private readonly valveStorageKey = 'ui.query.valveEnabled';
  private readonly valveSpinModeStorageKey = 'ui.query.valveSpinMode';
  private modelViewerImportPromise: Promise<unknown> | null = null;
  private valvePointerDownX = 0;
  private valvePointerDownY = 0;
  private suppressNextValveToggle = false;
  private readonly valveDragThresholdPx = 6;
  private readonly valveBackdropEventName = 'pse:valveBackdropChanged';
  private readonly valveSpinModeEventName = 'pse:valveSpinModeChanged';
  private isResultsRoute = false;

  constructor(
    private steamApi: SteamApiService,
    private router: Router
  ) {
    if (typeof window !== 'undefined') {
      const savedValveState = window.localStorage.getItem(this.valveStorageKey);
      if (savedValveState !== null) {
        this.valveEnabled = savedValveState === '1';
      }

      const savedValveSpinMode = window.localStorage.getItem(this.valveSpinModeStorageKey);
      if (savedValveSpinMode === 'flat' || savedValveSpinMode === 'full') {
        this.valveSpinMode = savedValveSpinMode;
      }
    }

    if (this.valveEnabled) {
      this.ensureModelViewerLoaded();
    }

    this.publishValveBackdropState();
    this.publishValveSpinMode();

    this.isResultsRoute = this.router.url.startsWith('/results');
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isResultsRoute = event.urlAfterRedirects.startsWith('/results');
      }
    });
  }

  ngOnDestroy(): void {
    // No-op for now; route event subscription is app-lifetime.
  }

  get shouldRenderToolbarValveModel(): boolean {
    return this.valveEnabled && !this.isResultsRoute;
  }

  toggleValveBackdrop(): void {
    if (this.suppressNextValveToggle) {
      this.suppressNextValveToggle = false;
      return;
    }

    this.valveEnabled = !this.valveEnabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.valveStorageKey, this.valveEnabled ? '1' : '0');
    }
    if (this.valveEnabled) {
      this.ensureModelViewerLoaded();
    }
    this.publishValveBackdropState();
  }

  toggleValveSpinMode(): void {
    this.valveSpinMode = this.valveSpinMode === 'full' ? 'flat' : 'full';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.valveSpinModeStorageKey, this.valveSpinMode);
    }
    this.publishValveSpinMode();
  }

  onValvePointerDown(event: PointerEvent): void {
    if (!this.valveEnabled) return;
    this.valvePointerDownX = event.clientX;
    this.valvePointerDownY = event.clientY;
    this.suppressNextValveToggle = false;
  }

  onValvePointerMove(event: PointerEvent): void {
    if (!this.valveEnabled || this.suppressNextValveToggle) return;

    const deltaX = event.clientX - this.valvePointerDownX;
    const deltaY = event.clientY - this.valvePointerDownY;
    if (Math.hypot(deltaX, deltaY) >= this.valveDragThresholdPx) {
      this.suppressNextValveToggle = true;
    }
  }

  private ensureModelViewerLoaded(): void {
    if (typeof window === 'undefined' || this.modelViewerImportPromise) return;

    this.modelViewerImportPromise = import('@google/model-viewer').catch((error) => {
      console.warn('Failed to load model-viewer module for valve button.', error);
      this.modelViewerImportPromise = null;
    });
  }

  private publishValveBackdropState(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<boolean>(this.valveBackdropEventName, {
        detail: this.valveEnabled,
      })
    );
  }

  private publishValveSpinMode(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<ValveSpinMode>(this.valveSpinModeEventName, {
        detail: this.valveSpinMode,
      })
    );
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
