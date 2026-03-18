import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_SELECT_SCROLL_STRATEGY, MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BackendService } from '../../services/backend-service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserProfile } from '../../types/steam.types';
import { Overlay } from '@angular/cdk/overlay';

type SearchOs = '' | 'windows' | 'mac' | 'linux';

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
  providers: [
    {
      provide: MAT_SELECT_SCROLL_STRATEGY,
      deps: [Overlay],
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.reposition(),
    },
  ],
})
export class QueryScreen implements OnInit, OnDestroy {
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
  selected_player_count = 'Any';
  selected_os: SearchOs = '';
  keyword_input = '';
  steamId_input = '';
  isFormFocused = false;

  private isSearchLoading = false;
  private isRecommendationLoading = false;
  private awaitingSearchResults = false;
  private awaitingRecommendationResults = false;

  isLoadingProfile = false;
  error: string | null = null;
  userProfile: UserProfile | null = null;
  osDetectionError: string | null = null;
  mouseCoordinates = '35.6762 N / 139.6503 E';
  private lastCoordinateUpdate = 0;
  prefersReducedMotion = false;
  isKatanaCursorVisible = false;
  katanaCursorX = 0;
  katanaCursorY = 0;

  private readonly subs = new Subscription();

  constructor(private backendService: BackendService, private router: Router) {}

  get isLoading(): boolean {
    return this.isSearchLoading || this.isRecommendationLoading;
  }

  get selectedOsLabel(): string {
    switch (this.selected_os) {
      case 'windows':
        return 'Windows';
      case 'mac':
        return 'macOS';
      case 'linux':
        return 'Linux';
      default:
        return 'Any';
    }
  }

  get hasInput(): boolean {
    return !!(
      (this.steamId_input && this.steamId_input.length > 0) ||
      (this.selected_genre && this.selected_genre.length > 0) ||
      (this.keyword_input && this.keyword_input.length > 0) ||
      this.selected_os ||
      (this.selected_player_count && this.selected_player_count !== 'Any')
    );
  }

  get isSteamIdValid(): boolean {
    return /^\d{17}$/.test(this.steamId_input.trim());
  }

  ngOnInit() {
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.prefetchResultsScreen();

    this.subs.add(this.backendService.isLoadingSearch$.subscribe(l => this.isSearchLoading = l));
    this.subs.add(this.backendService.isLoadingRecommendations$.subscribe(l => this.isRecommendationLoading = l));
    this.subs.add(this.backendService.isLoadingProfile$.subscribe(l => this.isLoadingProfile = l));
    this.subs.add(this.backendService.error$.subscribe(e => this.error = e));
    this.subs.add(this.backendService.userProfile$.subscribe(p => this.userProfile = p));

    // Navigate after the requested query resolves, including empty-result searches.
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      if (this.awaitingSearchResults && !this.isLoading) {
        this.awaitingSearchResults = false;
        if (!this.error) {
          this.router.navigate(['/results'], { state: { results } });
        }
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(results => {
      if (this.awaitingRecommendationResults && !this.isLoading) {
        this.awaitingRecommendationResults = false;
        if (!this.error) {
          this.router.navigate(['/results'], { state: { results } });
        }
      }
    }));
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.prefersReducedMotion) return;

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    if (now - this.lastCoordinateUpdate < 80) return;
    this.lastCoordinateUpdate = now;

    const xPct = (e.clientX / window.innerWidth) * 100;
    const yPct = (e.clientY / window.innerHeight) * 100;

    // Map screen position to geographic-ish coordinates.
    const targetLat = (yPct * 0.9).toFixed(4);
    const targetLng = (xPct * 1.8).toFixed(4);
    this.mouseCoordinates = `${targetLat} N / ${targetLng} E`;
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  loadSteamProfile(): void {
    if (!this.isSteamIdValid) return;

    this.backendService.setSteamId(this.steamId_input);
    this.backendService.loadUserProfile();
    this.scrollToCenter('.steam-section');
  }

  onSteamIdInput(value: string): void {
    this.steamId_input = value.replace(/\D+/g, '').slice(0, 17);
  }

  onFocusIn(): void {
    this.isFormFocused = true;
  }

  onFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const nextFocused = event.relatedTarget as Node | null;
    if (!currentTarget || !nextFocused || !currentTarget.contains(nextFocused)) {
      this.isFormFocused = false;
    }
  }

  detectAndApplyOs(): void {
    this.osDetectionError = null;
    const detectedOs = this.detectCurrentOs();
    if (!detectedOs) {
      this.osDetectionError = 'Unable to detect your operating system in this browser.';
      return;
    }

    this.selected_os = detectedOs;
    this.scrollToCenter('.os-row');
  }

  clearOsFilter(): void {
    this.selected_os = '';
    this.osDetectionError = null;
  }

  onQuery(): void {
    const steamId = this.steamId_input || this.backendService.getSteamId();

    if (this.userProfile && steamId) {
      this.awaitingRecommendationResults = true;
      this.awaitingSearchResults = false;
      this.backendService.setSteamId(steamId);
      this.backendService.loadPersonalizedRecommendations(20);
    } else {
      this.awaitingSearchResults = true;
      this.awaitingRecommendationResults = false;
      const genresParam = this.selected_genre.join(',');
      this.backendService.executeSearch(
        genresParam,
        this.keyword_input,
        this.selected_player_count,
        this.selected_os || undefined
      );
    }
    this.scrollToCenter('app-game-list');
  }

  onSearchButtonHoverEnter(event: MouseEvent): void {
    this.isKatanaCursorVisible = true;
    this.updateKatanaCursor(event);
  }

  onSearchButtonHoverMove(event: MouseEvent): void {
    if (!this.isKatanaCursorVisible) return;
    this.updateKatanaCursor(event);
  }

  onSearchButtonHoverLeave(): void {
    this.isKatanaCursorVisible = false;
  }

  private updateKatanaCursor(event: MouseEvent): void {
    this.katanaCursorX = event.clientX;
    this.katanaCursorY = event.clientY;
  }

  private prefetchResultsScreen(): void {
    if (typeof window === 'undefined') return;
    const load = () => {
      void import('../result-screen/result-screen');
    };

    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number })
        .requestIdleCallback(load, { timeout: 1500 });
      return;
    }

    setTimeout(load, 350);
  }

  private scrollToCenter(selector: string): void {
    requestAnimationFrame(() => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  private detectCurrentOs(): SearchOs | null {
    if (typeof navigator === 'undefined') return null;

    const uaDataPlatform = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData?.platform || '';
    const fingerprint = `${navigator.userAgent} ${navigator.platform} ${uaDataPlatform}`.toLowerCase();

    if (fingerprint.includes('win')) return 'windows';
    if (
      fingerprint.includes('mac') ||
      fingerprint.includes('darwin') ||
      fingerprint.includes('iphone') ||
      fingerprint.includes('ipad')
    ) {
      return 'mac';
    }
    if (fingerprint.includes('linux') || fingerprint.includes('x11')) return 'linux';

    return null;
  }
}
