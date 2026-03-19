import {
  Component,
  OnDestroy,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
  NgZone,
  ChangeDetectorRef,
  ElementRef,
  ViewChild
} from '@angular/core';
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
type ValveSpinMode = 'flat' | 'full';
type ValveModelViewerElement = HTMLElement & {
  cameraOrbit?: string;
  orientation?: string;
};

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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
  isProfileClearing = false;
  valveBackdropEnabled = true;
  valveSpinMode: ValveSpinMode = 'flat';
  valveOpacity = 0.84;
  private focusUpdateTimeoutId: number | null = null;
  private valveScrollRafId: number | null = null;
  private valveGyroRafId: number | null = null;
  private valveGyroStartTimeMs = 0;
  private valveModelViewerElement: ValveModelViewerElement | null = null;
  private removePointerMoveListener: (() => void) | null = null;
  private removeScrollListener: (() => void) | null = null;
  private readonly valveStorageKey = 'ui.query.valveEnabled';
  private readonly valveBackdropEventName = 'pse:valveBackdropChanged';
  private readonly valveSpinModeStorageKey = 'ui.query.valveSpinMode';
  private readonly valveSpinModeEventName = 'pse:valveSpinModeChanged';
  private readonly valveDefaultCameraOrbit = '0deg 78deg 3.9m';
  private readonly valveDefaultOrientation = '0deg 0deg 0deg';
  private readonly runValveGyroStep = (timestampMs: number) => this.stepValveGyro(timestampMs);

  private readonly subs = new Subscription();

  @ViewChild('valveModelViewer')
  set valveModelViewerRef(ref: ElementRef<ValveModelViewerElement> | undefined) {
    this.valveModelViewerElement = ref?.nativeElement ?? null;
    this.syncValveGyroAnimation();
  }

  constructor(
    private backendService: BackendService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

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

  get searchButtonLabel(): string {
    if (!this.hasExplicitSearchFilters() && this.userProfile) {
      return '[ Suggest for me ]';
    }
    return '[ Suggest games ]';
  }

  get isSteamIdValid(): boolean {
    return /^\d{17}$/.test(this.steamId_input.trim());
  }

  ngOnInit() {
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    if (typeof window !== 'undefined') {
      const savedValveState = window.localStorage.getItem(this.valveStorageKey);
      if (savedValveState !== null) {
        this.valveBackdropEnabled = savedValveState === '1';
      }
      const savedValveSpinMode = window.localStorage.getItem(this.valveSpinModeStorageKey);
      if (savedValveSpinMode === 'flat' || savedValveSpinMode === 'full') {
        this.valveSpinMode = savedValveSpinMode;
      }
      window.addEventListener(this.valveBackdropEventName, this.onValveBackdropChanged as EventListener);
      window.addEventListener(this.valveSpinModeEventName, this.onValveSpinModeChanged as EventListener);
    }

    this.updateValveOpacity();
    this.prefetchResultsScreen();
    this.setupViewportListeners();
    this.syncValveGyroAnimation();

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
          this.router.navigate(['/results'], { state: { results, source: 'search' } });
        }
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(results => {
      if (this.awaitingRecommendationResults && !this.isLoading) {
        this.awaitingRecommendationResults = false;
        if (!this.error) {
          this.router.navigate(['/results'], { state: { results, source: 'recommendations' } });
        }
      }
    }));
  }

  private onPointerMove(e: MouseEvent | PointerEvent): void {
    if (typeof window === 'undefined') return;

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
    const nextCoordinates = `${targetLat} N / ${targetLng} E`;
    if (nextCoordinates === this.mouseCoordinates) return;

    this.ngZone.run(() => {
      this.mouseCoordinates = nextCoordinates;
      this.cdr.detectChanges();
    });
  }

  private onWindowScroll(): void {
    if (typeof window === 'undefined' || this.valveScrollRafId !== null) return;

    this.valveScrollRafId = window.requestAnimationFrame(() => {
      this.valveScrollRafId = null;
      const nextOpacity = this.computeValveOpacity();
      if (Math.abs(nextOpacity - this.valveOpacity) < 0.01) return;
      this.ngZone.run(() => {
        this.valveOpacity = nextOpacity;
        this.syncValveGyroAnimation();
      });
    });
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener(this.valveBackdropEventName, this.onValveBackdropChanged as EventListener);
      window.removeEventListener(this.valveSpinModeEventName, this.onValveSpinModeChanged as EventListener);
    }
    if (this.valveScrollRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.valveScrollRafId);
      this.valveScrollRafId = null;
    }
    this.stopValveGyroAnimation(false);
    this.removePointerMoveListener?.();
    this.removeScrollListener?.();
    this.removePointerMoveListener = null;
    this.removeScrollListener = null;
    this.subs.unsubscribe();
    this.clearFocusUpdateTimeout();
  }

  loadSteamProfile(): void {
    if (!this.isSteamIdValid) return;

    this.backendService.setSteamId(this.steamId_input);
    this.backendService.loadUserProfile();
    this.scrollToCenter('.steam-section');
  }

  clearSteamProfile(): void {
    this.isProfileClearing = true;
    setTimeout(() => {
      this.ngZone.run(() => {
        this.steamId_input = '';
        this.backendService.clearUserProfile();
        this.error = null;
        this.isProfileClearing = false;
        this.cdr.markForCheck();
      });
    }, 400);
  }

  onSteamIdInput(value: string): void {
    this.steamId_input = value.replace(/\D+/g, '').slice(0, 17);
  }

  onFocusIn(): void {
    this.clearFocusUpdateTimeout();
    this.isFormFocused = true;
  }

  onFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const nextFocused = event.relatedTarget as Node | null;
    if (!currentTarget || !nextFocused || !currentTarget.contains(nextFocused)) {
      this.clearFocusUpdateTimeout();

      if (typeof window === 'undefined') {
        this.isFormFocused = false;
        return;
      }

      // Defer focus-class updates to avoid ExpressionChanged errors
      // when focus shifts during submit/disabled-state transitions.
      this.focusUpdateTimeoutId = window.setTimeout(() => {
        this.isFormFocused = false;
        this.focusUpdateTimeoutId = null;
      }, 0);
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
    const usePersonalizedMode = !!(this.userProfile && steamId && !this.hasExplicitSearchFilters());

    if (usePersonalizedMode) {
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

  private clearFocusUpdateTimeout(): void {
    if (this.focusUpdateTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.focusUpdateTimeoutId);
      this.focusUpdateTimeoutId = null;
    }
  }

  private onValveBackdropChanged = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    this.ngZone.run(() => {
      this.valveBackdropEnabled = Boolean(event.detail);
      this.updateValveOpacity();
      this.syncValveGyroAnimation();
      this.cdr.markForCheck();
    });
  };

  private onValveSpinModeChanged = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const nextMode = event.detail;
    if (nextMode !== 'flat' && nextMode !== 'full') return;
    this.ngZone.run(() => {
      this.valveSpinMode = nextMode;
      this.syncValveGyroAnimation();
      this.cdr.markForCheck();
    });
  };

  private updateValveOpacity(): void {
    const nextOpacity = this.computeValveOpacity();
    if (Math.abs(nextOpacity - this.valveOpacity) < 0.001) {
      this.syncValveGyroAnimation();
      return;
    }
    this.valveOpacity = nextOpacity;
    this.syncValveGyroAnimation();
  }

  private computeValveOpacity(): number {
    if (!this.valveBackdropEnabled) {
      return 0;
    }

    if (typeof window === 'undefined') {
      return 0.84;
    }

    const scrollY = window.scrollY || 0;
    const fadeStart = 12;
    const fadeEnd = 300;
    const progress = Math.min(Math.max((scrollY - fadeStart) / (fadeEnd - fadeStart), 0), 1);
    return 0.84 * (1 - progress);
  }

  private setupViewportListeners(): void {
    if (typeof window === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      const handlePointerMove = (event: MouseEvent | PointerEvent) => this.onPointerMove(event);
      const handleWindowScroll = () => this.onWindowScroll();

      if ('PointerEvent' in window) {
        document.addEventListener('pointermove', handlePointerMove as EventListener, { passive: true });
        this.removePointerMoveListener = () =>
          document.removeEventListener('pointermove', handlePointerMove as EventListener);
      } else {
        document.addEventListener('mousemove', handlePointerMove as EventListener, { passive: true });
        this.removePointerMoveListener = () =>
          document.removeEventListener('mousemove', handlePointerMove as EventListener);
      }

      window.addEventListener('scroll', handleWindowScroll, { passive: true });
      this.removeScrollListener = () => window.removeEventListener('scroll', handleWindowScroll);
    });
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

  private shouldRunValveGyroAnimation(): boolean {
    return (
      typeof window !== 'undefined' &&
      !this.prefersReducedMotion &&
      this.valveBackdropEnabled &&
      this.valveOpacity > 0.02 &&
      this.valveSpinMode === 'full'
    );
  }

  private syncValveGyroAnimation(): void {
    if (this.shouldRunValveGyroAnimation()) {
      this.startValveGyroAnimation();
      return;
    }
    this.stopValveGyroAnimation();
  }

  private startValveGyroAnimation(): void {
    if (typeof window === 'undefined' || this.valveGyroRafId !== null) return;
    this.valveGyroStartTimeMs =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    this.ngZone.runOutsideAngular(() => {
      this.valveGyroRafId = window.requestAnimationFrame(this.runValveGyroStep);
    });
  }

  private stopValveGyroAnimation(resetPose = true): void {
    if (typeof window !== 'undefined' && this.valveGyroRafId !== null) {
      window.cancelAnimationFrame(this.valveGyroRafId);
    }
    this.valveGyroRafId = null;
    if (resetPose) {
      this.resetValveModelPose();
    }
  }

  private stepValveGyro(timestampMs: number): void {
    if (typeof window === 'undefined') return;
    if (!this.shouldRunValveGyroAnimation()) {
      this.stopValveGyroAnimation();
      return;
    }

    const modelViewer = this.getValveModelViewer();
    if (!modelViewer) {
      this.valveGyroRafId = window.requestAnimationFrame(this.runValveGyroStep);
      return;
    }
    if (!this.isValveModelViewerReady(modelViewer)) {
      this.valveGyroRafId = window.requestAnimationFrame(this.runValveGyroStep);
      return;
    }

    const elapsedSeconds = Math.max((timestampMs - this.valveGyroStartTimeMs) / 1000, 0);
    const orbitAzimuthDeg = (elapsedSeconds * 112) % 360;
    const orbitPolarDeg = 78 + Math.sin(elapsedSeconds * 1.4) * 12 + Math.sin(elapsedSeconds * 0.58) * 4;
    const orbitRadiusMeters = 3.9 + Math.sin(elapsedSeconds * 0.92) * 0.14;
    const pitchDeg = Math.sin(elapsedSeconds * 1.78) * 10;
    const yawDeg = (elapsedSeconds * 138) % 360;
    const rollDeg = Math.cos(elapsedSeconds * 1.22) * 8;

    this.setValveModelPose(
      modelViewer,
      `${orbitAzimuthDeg.toFixed(2)}deg ${orbitPolarDeg.toFixed(2)}deg ${orbitRadiusMeters.toFixed(2)}m`,
      `${pitchDeg.toFixed(2)}deg ${yawDeg.toFixed(2)}deg ${rollDeg.toFixed(2)}deg`
    );

    this.valveGyroRafId = window.requestAnimationFrame(this.runValveGyroStep);
  }

  private getValveModelViewer(): ValveModelViewerElement | null {
    if (this.valveModelViewerElement) {
      return this.valveModelViewerElement;
    }
    if (typeof document === 'undefined') return null;
    return document.querySelector('.valve-model');
  }

  private setValveModelPose(
    modelViewer: ValveModelViewerElement,
    cameraOrbit: string,
    orientation: string
  ): void {
    modelViewer.cameraOrbit = cameraOrbit;
    modelViewer.orientation = orientation;
  }

  private resetValveModelPose(): void {
    const modelViewer = this.getValveModelViewer();
    if (!modelViewer) return;
    if (!this.isValveModelViewerReady(modelViewer)) return;
    this.setValveModelPose(modelViewer, this.valveDefaultCameraOrbit, this.valveDefaultOrientation);
  }

  private isValveModelViewerReady(modelViewer: ValveModelViewerElement): boolean {
    const viewer = modelViewer as ValveModelViewerElement & { loaded?: boolean; model?: unknown };
    return Boolean(viewer.loaded && viewer.model);
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

  private hasExplicitSearchFilters(): boolean {
    return !!(
      this.keyword_input.trim().length > 0 ||
      this.selected_genre.length > 0 ||
      this.selected_player_count !== 'Any' ||
      this.selected_os
    );
  }
}
