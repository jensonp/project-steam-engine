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
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.close(),
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

  private isSearchLoading = false;
  private isRecommendationLoading = false;
  private awaitingSearchResults = false;
  private awaitingRecommendationResults = false;

  isLoadingProfile = false;
  error: string | null = null;
  userProfile: UserProfile | null = null;
  osDetectionError: string | null = null;
  mouseCoordinates = '35.6762 N / 139.6503 E';

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

  ngOnInit() {
    this.subs.add(this.backendService.isLoadingSearch$.subscribe(l => this.isSearchLoading = l));
    this.subs.add(this.backendService.isLoadingRecommendations$.subscribe(l => this.isRecommendationLoading = l));
    this.subs.add(this.backendService.isLoadingProfile$.subscribe(l => this.isLoadingProfile = l));
    this.subs.add(this.backendService.error$.subscribe(e => this.error = e));
    this.subs.add(this.backendService.userProfile$.subscribe(p => this.userProfile = p));

    // Navigate after the requested query resolves, including empty-result searches.
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      if (this.awaitingSearchResults && !this.isLoading) {
        this.awaitingSearchResults = false;
        this.router.navigate(['/results'], { state: { results } });
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(results => {
      if (this.awaitingRecommendationResults && !this.isLoading) {
        this.awaitingRecommendationResults = false;
        this.router.navigate(['/results'], { state: { results } });
      }
    }));
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    const xPct = (e.clientX / window.innerWidth) * 100;
    const yPct = (e.clientY / window.innerHeight) * 100;
    
    // Map screen position to geographic-ish coordinates
    // Latitude: 0-90N, Longitude: 0-180E
    const lat = (yPct * 0.9).toFixed(4);
    const lng = (xPct * 1.8).toFixed(4);
    
    this.mouseCoordinates = `${lat} N / ${lng} E`;
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  loadSteamProfile(): void {
    if (!this.steamId_input || this.steamId_input.length !== 17) return;

    this.backendService.setSteamId(this.steamId_input);
    this.backendService.loadUserProfile();
  }

  detectAndApplyOs(): void {
    this.osDetectionError = null;
    const detectedOs = this.detectCurrentOs();
    if (!detectedOs) {
      this.osDetectionError = 'Unable to detect your operating system in this browser.';
      return;
    }

    this.selected_os = detectedOs;
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
