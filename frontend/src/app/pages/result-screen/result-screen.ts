import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { Game } from '../../types/steam.types';
import { Router, RouterLink } from '@angular/router';
import { BackendService } from '../../services/backend-service';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-result-screen',
  standalone: true,
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [CommonModule, GameCardComponent, RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultScreen implements OnInit, OnDestroy {
  results: Game[] = [];
  visibleResults: Game[] = [];
  private readonly subs = new Subscription();
  private renderFrameId: number | null = null;
  private readonly renderBatchSize = 6;
  private hydratedFromNavigationState = false;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  constructor(
    private router: Router,
    private backendService: BackendService,
    private cdr: ChangeDetectorRef
  ) {
    // Fallback: Check router state first in case page was reloaded manually.
    const state = this.router.getCurrentNavigation()?.extras.state as { results: Game[] };
    if (state?.results) {
      this.hydratedFromNavigationState = true;
      this.setResults(state.results);
    }
  }

  ngOnInit(): void {
    // Subscribe to both general search results AND personalized recommendations.
    // Whichever emits data last will overwrite the view.
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      if (Array.isArray(results)) {
        if (this.shouldSkipInitialEmptyEmission(results)) return;
        if (this.shouldIgnoreCompetingEmptyEmission(results)) return;
        if (results.length > 0) this.hydratedFromNavigationState = false;
        this.setResults(results);
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(recs => {
      if (Array.isArray(recs)) {
        // The HTML template uses generic fields present in both types.
        const mapped = recs as unknown as Game[];
        if (this.shouldSkipInitialEmptyEmission(mapped)) return;
        if (this.shouldIgnoreCompetingEmptyEmission(mapped)) return;
        if (mapped.length > 0) this.hydratedFromNavigationState = false;
        this.setResults(mapped);
      }
    }));
  }

  trackByAppId(index: number, game: Game): number | string {
    return game.appId ?? `${game.name ?? 'game'}-${index}`;
  }

  ngOnDestroy(): void {
    this.cancelRenderFrame();
    this.subs.unsubscribe();
  }

  private setResults(nextResults: Game[]): void {
    this.cancelRenderFrame();
    this.results = Array.isArray(nextResults) ? nextResults : [];
    this.visibleResults = [];

    if (!this.results.length) {
      this.cdr.markForCheck();
      return;
    }

    if (typeof window === 'undefined') {
      this.visibleResults = [...this.results];
      this.cdr.markForCheck();
      return;
    }

    const initialCount = this.prefersReducedMotion
      ? this.results.length
      : Math.min(this.results.length, this.renderBatchSize);

    this.visibleResults = this.results.slice(0, initialCount);
    this.cdr.markForCheck();

    if (initialCount >= this.results.length) return;

    let cursor = initialCount;
    const appendBatch = () => {
      const nextCursor = Math.min(cursor + this.renderBatchSize, this.results.length);
      this.visibleResults = this.visibleResults.concat(this.results.slice(cursor, nextCursor));
      cursor = nextCursor;
      this.cdr.markForCheck();

      if (cursor < this.results.length) {
        this.renderFrameId = window.requestAnimationFrame(appendBatch);
      } else {
        this.renderFrameId = null;
      }
    };

    this.renderFrameId = window.requestAnimationFrame(appendBatch);
  }

  private cancelRenderFrame(): void {
    if (this.renderFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
  }

  private shouldSkipInitialEmptyEmission(next: Game[]): boolean {
    return this.hydratedFromNavigationState && next.length === 0 && this.results.length > 0;
  }

  private shouldIgnoreCompetingEmptyEmission(next: Game[]): boolean {
    // Search and recommendation streams both emit state updates.
    // Once one stream has populated results, ignore empty emissions
    // from the other stream so cards do not disappear unexpectedly.
    return next.length === 0 && this.results.length > 0;
  }
}
