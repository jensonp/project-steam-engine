import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { Game } from '../../types/steam.types';
import { Router, RouterLink } from '@angular/router';
import { BackendService } from '../../services/backend-service';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

type ResultSource = 'search' | 'recommendations';
type LiquidLens = {
  options: Record<string, unknown>;
  setShadow?: (enabled: boolean) => void;
  setTilt?: (enabled: boolean) => void;
};
type LiquidRenderer = {
  _rafId?: number | null;
  canvas?: HTMLCanvasElement;
  render?: () => void;
};
type LiquidGuiInstance = {
  domElement: HTMLElement;
  addFolder: (name: string) => {
    add: (obj: Record<string, unknown>, key: string, ...rest: unknown[]) => { onChange: (cb: (value: unknown) => void) => unknown };
    close: () => void;
  };
  destroy: () => void;
};

@Component({
  selector: 'app-result-screen',
  standalone: true,
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [CommonModule, GameCardComponent, RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultScreen implements OnInit, AfterViewInit, OnDestroy {
  results: Game[] = [];
  visibleResults: Game[] = [];
  private readonly subs = new Subscription();
  private renderFrameId: number | null = null;
  private readonly renderBatchSize = 6;
  private hydratedFromNavigationState = false;
  private activeResultSource: ResultSource | null = null;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  private liquidGui: LiquidGuiInstance | null = null;
  private liquidScriptPromise: Promise<void> | null = null;
  private liquidBootstrapped = false;
  private liquidInitTimer: number | null = null;
  private scrollRenderListener: (() => void) | null = null;
  private mouseRenderListener: (() => void) | null = null;

  constructor(
    private router: Router,
    private backendService: BackendService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Fallback: Check router state first in case page was reloaded manually.
    const state = this.router.getCurrentNavigation()?.extras.state as
      | { results?: Game[]; source?: ResultSource }
      | undefined;
    if (state?.source === 'search' || state?.source === 'recommendations') {
      this.activeResultSource = state.source;
    }
    if (state?.results) {
      this.hydratedFromNavigationState = true;
      this.setResults(state.results);
    }
  }

  ngAfterViewInit(): void {
    this.scheduleLiquidBootstrap();
  }

  ngOnInit(): void {
    this.subs.add(
      this.backendService.lastResultSource$.subscribe(source => {
        if (!source) return;
        this.activeResultSource = source;
      })
    );

    // Subscribe to both streams, but only apply the currently active result source.
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      if (Array.isArray(results)) {
        if (!this.shouldAcceptSource('search')) return;
        if (this.shouldSkipInitialEmptyEmission(results)) return;
        if (this.shouldIgnoreCompetingEmptyEmission(results)) return;
        if (results.length > 0) this.hydratedFromNavigationState = false;
        this.setResults(results);
      }
    }));

    this.subs.add(this.backendService.recommendations$.subscribe(recs => {
      if (Array.isArray(recs)) {
        if (!this.shouldAcceptSource('recommendations')) return;
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
    this.teardownLiquidGl();
    this.subs.unsubscribe();
  }

  private setResults(nextResults: Game[]): void {
    this.cancelRenderFrame();
    this.results = Array.isArray(nextResults) ? nextResults : [];
    this.visibleResults = [];

    if (!this.results.length) {
      this.teardownLiquidGl();
      this.cdr.markForCheck();
      return;
    }

    if (typeof window === 'undefined') {
      this.visibleResults = [...this.results];
      this.scheduleLiquidBootstrap();
      this.cdr.markForCheck();
      return;
    }

    const initialCount = this.prefersReducedMotion
      ? this.results.length
      : Math.min(this.results.length, this.renderBatchSize);

    this.visibleResults = this.results.slice(0, initialCount);
    this.cdr.markForCheck();
    this.scheduleLiquidBootstrap();

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
        this.scheduleLiquidBootstrap();
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

  private scheduleLiquidBootstrap(): void {
    if (this.prefersReducedMotion || typeof window === 'undefined') return;
    if (this.liquidInitTimer !== null) {
      window.clearTimeout(this.liquidInitTimer);
    }
    this.liquidInitTimer = window.setTimeout(() => {
      this.liquidInitTimer = null;
      this.ngZone.runOutsideAngular(() => {
        void this.bootstrapLiquidGl();
      });
    }, 120);
  }

  private async bootstrapLiquidGl(): Promise<void> {
    const shells = Array.from(
      document.querySelectorAll<HTMLElement>('.results-container .liquid-shell')
    );

    if (!shells.length) {
      this.teardownLiquidGl();
      return;
    }

    try {
      await this.ensureLiquidScripts();
      this.rebuildLiquidRenderer(shells);
      this.attachLiquidRenderListeners();
      this.liquidBootstrapped = true;
    } catch (error) {
      this.liquidBootstrapped = false;
      console.error('Failed to initialize liquidGL assets.', error);
    }
  }

  private ensureLiquidScripts(): Promise<void> {
    const w = window as Window & {
      liquidGL?: ((options: Record<string, unknown>) => LiquidLens | LiquidLens[] | undefined) & {
        syncWith?: (config?: Record<string, unknown>) => unknown;
      };
      lil?: { GUI: new (options?: Record<string, unknown>) => LiquidGuiInstance };
    };

    if (w.liquidGL && w.lil?.GUI) {
      return Promise.resolve();
    }

    if (!this.liquidScriptPromise) {
      this.liquidScriptPromise = this.loadScript('/vendor/liquidgl/html2canvas.min.js')
        .then(() => this.loadScript('/vendor/liquidgl/liquidGL.js'))
        .then(() => this.loadScript('/vendor/liquidgl/lil-gui.umd.min.js'));
    }

    return this.liquidScriptPromise;
  }

  private loadScript(src: string): Promise<void> {
    const absoluteSrc = new URL(src, window.location.origin).toString();
    const existingScript = Array.from(document.querySelectorAll<HTMLScriptElement>('script')).find(
      script => script.src === absoluteSrc
    );

    if (existingScript?.dataset['loaded'] === '1') {
      return Promise.resolve();
    }

    if (existingScript) {
      return new Promise((resolve, reject) => {
        existingScript.addEventListener(
          'load',
          () => resolve(),
          { once: true }
        );
        existingScript.addEventListener(
          'error',
          () => reject(new Error(`Failed to load script: ${src}`)),
          { once: true }
        );
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset['loaded'] = '0';
      script.addEventListener('load', () => {
        script.dataset['loaded'] = '1';
        resolve();
      });
      script.addEventListener('error', () => {
        reject(new Error(`Failed to load script: ${src}`));
      });
      document.head.appendChild(script);
    });
  }

  private rebuildLiquidRenderer(shells: HTMLElement[]): void {
    const w = window as Window & {
      liquidGL?: ((options: Record<string, unknown>) => LiquidLens | LiquidLens[] | undefined) & {
        syncWith?: (config?: Record<string, unknown>) => unknown;
      };
      __liquidGLRenderer__?: LiquidRenderer;
      lil?: { GUI: new (options?: Record<string, unknown>) => LiquidGuiInstance };
    };
    if (!w.liquidGL) return;

    this.destroyLiquidGui();
    this.destroyLiquidRenderer();

    const cardCount = shells.length;
    const selector = shells
      .map((shell, index) => {
        if (!shell.id) {
          shell.id = `liquid-shell-${Date.now().toString(36)}-${index}`;
        }
        return `#${this.escapeSelector(shell.id)}`;
      })
      .join(', ');

    const created = w.liquidGL({
      target: selector,
      snapshot: '.result-screen',
      resolution: this.getAdaptiveLiquidResolution(cardCount),
      refraction: 0.026,
      bevelDepth: 0.119,
      bevelWidth: 0.057,
      frost: 0,
      shadow: true,
      specular: true,
      reveal: 'fade',
      tilt: false,
      tiltFactor: 5,
      magnify: 1.06,
    });

    const lensList = Array.isArray(created) ? created : created ? [created] : [];
    const firstLens = lensList[0];
    if (firstLens) {
      this.mountLiquidControls(firstLens, lensList);
    }
    this.setLiquidActiveClass(true);

    w.liquidGL.syncWith?.({
      gsap: false,
      lenis: false,
      locomotiveScroll: false,
    });
  }

  private mountLiquidControls(firstLens: LiquidLens, lensList: LiquidLens[]): void {
    const w = window as Window & { lil?: { GUI: new (options?: Record<string, unknown>) => LiquidGuiInstance } };
    const LilGui = w.lil?.GUI;
    if (!LilGui) return;

    const gui = new LilGui({ title: 'Controls' });
    gui.domElement.style.zIndex = '12000';
    gui.domElement.style.position = 'fixed';
    gui.domElement.style.top = '88px';
    gui.domElement.style.right = '12px';
    gui.domElement.style.setProperty('--background-color', 'rgba(12, 12, 12, 0.9)');
    gui.domElement.style.setProperty('--text-color', '#f4ece0');
    gui.domElement.style.setProperty('--widget-color', 'rgba(255, 87, 56, 0.2)');
    gui.domElement.style.setProperty('--focus-color', '#ff5738');
    gui.domElement.style.setProperty('--number-color', '#f4ece0');

    const folder = gui.addFolder('liquidGL Effect');
    const updateAll = (key: string, value: unknown) => {
      lensList.forEach(lens => {
        if (!lens?.options) return;
        lens.options[key] = value;
        if (key === 'shadow') lens.setShadow?.(Boolean(value));
        if (key === 'tilt') lens.setTilt?.(Boolean(value));
      });
    };

    folder.add(firstLens.options, 'refraction', 0, 0.1, 0.001).onChange(v => updateAll('refraction', v));
    folder.add(firstLens.options, 'bevelDepth', 0, 0.2, 0.001).onChange(v => updateAll('bevelDepth', v));
    folder.add(firstLens.options, 'bevelWidth', 0, 0.5, 0.001).onChange(v => updateAll('bevelWidth', v));
    folder.add(firstLens.options, 'frost', 0, 10, 0.1).onChange(v => updateAll('frost', v));
    folder.add(firstLens.options, 'magnify', 1, 5, 0.1).onChange(v => updateAll('magnify', v));
    folder.add(firstLens.options, 'shadow').onChange(v => updateAll('shadow', v));
    folder.add(firstLens.options, 'specular').onChange(v => updateAll('specular', v));
    folder.add(firstLens.options, 'tilt').onChange(v => updateAll('tilt', v));
    folder.add(firstLens.options, 'tiltFactor', 0, 25, 0.1).onChange(v => updateAll('tiltFactor', v));
    folder.add(firstLens.options, 'reveal', ['none', 'fade']).onChange(v => updateAll('reveal', v));
    folder.close();

    this.liquidGui = gui;
  }

  private attachLiquidRenderListeners(): void {
    const w = window as Window & { __liquidGLRenderer__?: LiquidRenderer };
    this.detachLiquidRenderListeners();

    const render = () => w.__liquidGLRenderer__?.render?.();
    this.scrollRenderListener = render;
    this.mouseRenderListener = render;

    window.addEventListener('scroll', this.scrollRenderListener, { passive: true });
    document.addEventListener('mousemove', this.mouseRenderListener, { passive: true });
  }

  private detachLiquidRenderListeners(): void {
    if (this.scrollRenderListener) {
      window.removeEventListener('scroll', this.scrollRenderListener);
      this.scrollRenderListener = null;
    }
    if (this.mouseRenderListener) {
      document.removeEventListener('mousemove', this.mouseRenderListener);
      this.mouseRenderListener = null;
    }
  }

  private destroyLiquidGui(): void {
    if (!this.liquidGui) return;
    this.liquidGui.destroy();
    this.liquidGui = null;
  }

  private destroyLiquidRenderer(): void {
    const w = window as Window & { __liquidGLRenderer__?: LiquidRenderer };
    const renderer = w.__liquidGLRenderer__;
    if (!renderer) return;

    if (renderer._rafId !== null && renderer._rafId !== undefined) {
      window.cancelAnimationFrame(renderer._rafId);
      renderer._rafId = null;
    }
    if (renderer.canvas?.parentNode) {
      renderer.canvas.parentNode.removeChild(renderer.canvas);
    }

    delete w.__liquidGLRenderer__;
  }

  private teardownLiquidGl(): void {
    if (typeof window === 'undefined') return;
    if (this.liquidInitTimer !== null) {
      window.clearTimeout(this.liquidInitTimer);
      this.liquidInitTimer = null;
    }
    if (!this.liquidBootstrapped && !this.liquidGui && !(window as { __liquidGLRenderer__?: LiquidRenderer }).__liquidGLRenderer__) {
      return;
    }
    this.detachLiquidRenderListeners();
    this.destroyLiquidGui();
    this.destroyLiquidRenderer();
    this.setLiquidActiveClass(false);
    this.liquidBootstrapped = false;
  }

  private getAdaptiveLiquidResolution(cardCount: number): number {
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
    const lowPowerDevice = hardwareConcurrency <= 4;
    if (lowPowerDevice || cardCount > 14) return 1.1;
    if (cardCount > 8) return 1.2;
    return 1.35;
  }

  private escapeSelector(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  private setLiquidActiveClass(active: boolean): void {
    const container = document.querySelector('.results-container');
    if (!container) return;
    container.classList.toggle('liquidgl-active', active);
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

  private shouldAcceptSource(source: ResultSource): boolean {
    if (!this.activeResultSource) return true;
    return this.activeResultSource === source;
  }
}
