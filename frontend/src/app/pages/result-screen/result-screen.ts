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
import { Game } from '../../types/steam.types';
import { Router, RouterLink } from '@angular/router';
import { BackendService } from '../../services/backend-service';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

type ResultSource = 'search' | 'recommendations';
type LiquidReveal = 'none' | 'fade';
type LiquidControlState = {
  refraction: number;
  bevelDepth: number;
  bevelWidth: number;
  frost: number;
  magnify: number;
  shadow: boolean;
  specular: boolean;
  tilt: boolean;
  tiltFactor: number;
  reveal: LiquidReveal;
};
type LiquidLens = {
  options: LiquidControlState;
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

const DEMO4_CARD_DEFAULTS: LiquidControlState = {
  refraction: 0,
  bevelDepth: 0.052,
  bevelWidth: 0.18,
  frost: 2,
  magnify: 1,
  shadow: true,
  specular: true,
  tilt: false,
  tiltFactor: 5,
  reveal: 'fade',
};

const DEMO5_SHAPE_DEFAULTS: LiquidControlState = {
  refraction: 0.026,
  bevelDepth: 0.119,
  bevelWidth: 0.057,
  frost: 0,
  magnify: 1,
  shadow: true,
  specular: true,
  tilt: false,
  tiltFactor: 5,
  reveal: 'fade',
};

@Component({
  selector: 'app-result-screen',
  standalone: true,
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [CommonModule, RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultScreen implements OnInit, AfterViewInit, OnDestroy {
  results: Game[] = [];
  visibleResults: Game[] = [];
  liquidDiagnostics: string | null = null;
  magnifierExpanded = false;
  magnifierDragging = false;
  magnifierTopPx: number | null = null;
  magnifierLeftPx: number | null = null;
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
  private liquidRetryCount = 0;
  private readonly maxLiquidRetries = 8;
  private scrollRenderListener: (() => void) | null = null;
  private mouseRenderListener: (() => void) | null = null;
  private dragPointerId: number | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragMoved = false;
  private suppressMagnifierToggle = false;
  private readonly boundMagnifierPointerMove = (event: PointerEvent) => this.onMagnifierPointerMove(event);
  private readonly boundMagnifierPointerUp = (event: PointerEvent) => this.onMagnifierPointerUp(event);

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
      this.liquidRetryCount = 0;
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

  steamUrl(game: Game): string {
    return `https://store.steampowered.com/app/${game.appId}/`;
  }

  truncateDescription(description: string): string {
    return description.length > 210 ? `${description.slice(0, 210)}...` : description;
  }

  onResultImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'steam.png';
  }

  ngOnDestroy(): void {
    this.cancelRenderFrame();
    this.cleanupMagnifierDrag();
    this.teardownLiquidGl();
    this.subs.unsubscribe();
  }

  toggleLiquidMagnifier(): void {
    this.magnifierExpanded = !this.magnifierExpanded;
    if (!this.magnifierExpanded) {
      this.cleanupMagnifierDrag();
    }
    this.cdr.markForCheck();

    this.ngZone.runOutsideAngular(() => {
      window.requestAnimationFrame(() => this.renderLiquidNow());
      window.setTimeout(() => {
        this.renderLiquidNow();
        this.scheduleLiquidBootstrap();
      }, 360);
    });
  }

  onMagnifierClick(event: MouseEvent): void {
    if (this.suppressMagnifierToggle) {
      this.suppressMagnifierToggle = false;
      event.preventDefault();
      return;
    }
    this.toggleLiquidMagnifier();
  }

  onMagnifierPointerDown(event: PointerEvent): void {
    if (!this.magnifierExpanded || event.button !== 0) return;
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    this.dragPointerId = event.pointerId;
    this.dragOffsetX = event.clientX - rect.left;
    this.dragOffsetY = event.clientY - rect.top;
    this.dragMoved = false;
    this.magnifierDragging = true;
    target.setPointerCapture?.(event.pointerId);

    window.addEventListener('pointermove', this.boundMagnifierPointerMove, { passive: true });
    window.addEventListener('pointerup', this.boundMagnifierPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.boundMagnifierPointerUp, { passive: true });
    this.cdr.markForCheck();
  }

  private onMagnifierPointerMove(event: PointerEvent): void {
    if (!this.magnifierDragging || event.pointerId !== this.dragPointerId) return;

    const shape = document.querySelector<HTMLElement>('.liquid-shape-trigger');
    const shapeWidth = shape?.offsetWidth ?? 0;
    const shapeHeight = shape?.offsetHeight ?? 0;
    const maxLeft = Math.max(0, window.innerWidth - shapeWidth);
    const maxTop = Math.max(0, window.innerHeight - shapeHeight);

    const nextLeft = this.clamp(event.clientX - this.dragOffsetX, 0, maxLeft);
    const nextTop = this.clamp(event.clientY - this.dragOffsetY, 0, maxTop);
    const prevLeft = this.magnifierLeftPx ?? nextLeft;
    const prevTop = this.magnifierTopPx ?? nextTop;

    if (Math.hypot(nextLeft - prevLeft, nextTop - prevTop) > 2) {
      this.dragMoved = true;
    }

    this.magnifierLeftPx = nextLeft;
    this.magnifierTopPx = nextTop;
    this.cdr.markForCheck();
    this.renderLiquidNow();
  }

  private onMagnifierPointerUp(event: PointerEvent): void {
    if (this.dragPointerId !== null && event.pointerId !== this.dragPointerId) return;
    const moved = this.dragMoved;
    this.cleanupMagnifierDrag();
    if (moved) {
      this.suppressMagnifierToggle = true;
    }
    this.ngZone.runOutsideAngular(() => {
      window.requestAnimationFrame(() => this.renderLiquidNow());
    });
  }

  onMagnifierTransitionEnd(event: Event): void {
    const transitionEvent = event as TransitionEvent;
    if (
      transitionEvent.propertyName !== 'width' &&
      transitionEvent.propertyName !== 'height' &&
      transitionEvent.propertyName !== 'transform'
    ) {
      return;
    }
    this.renderLiquidNow();
  }

  private setResults(nextResults: Game[]): void {
    this.cancelRenderFrame();
    this.results = Array.isArray(nextResults) ? nextResults : [];
    this.visibleResults = [];

    if (!this.results.length) {
      this.magnifierExpanded = false;
      this.cleanupMagnifierDrag();
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
    if (typeof window === 'undefined') return;
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
    const toolbarValveModel = document.querySelector('.toolbar-valve-model');
    if (toolbarValveModel) {
      // Wait for competing WebGL model-viewer context to unmount on /results.
      this.liquidRetryCount = Math.min(this.maxLiquidRetries, this.liquidRetryCount + 1);
      this.scheduleLiquidBootstrap();
      return;
    }

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.results-container .result-card-lens')
    );

    if (!cards.length) {
      this.teardownLiquidGl();
      return;
    }

    try {
      await this.ensureLiquidScripts();
      const lensCount = this.rebuildLiquidRenderer(cards.length);
      this.attachLiquidRenderListeners();
      this.liquidBootstrapped = lensCount > 0;
      if (lensCount > 0) {
        this.liquidRetryCount = 0;
      } else if (this.liquidRetryCount < this.maxLiquidRetries) {
        this.liquidRetryCount += 1;
        this.scheduleLiquidBootstrap();
      }
    } catch (error) {
      this.liquidBootstrapped = false;
      this.liquidRetryCount = Math.min(this.maxLiquidRetries, this.liquidRetryCount + 1);
      if (this.liquidRetryCount < this.maxLiquidRetries) {
        this.scheduleLiquidBootstrap();
      }
      this.setLiquidDiagnostics('LiquidGL init failed. Check browser WebGL support.');
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

  private rebuildLiquidRenderer(cardCount: number): number {
    const w = window as Window & {
      liquidGL?: ((options: Record<string, unknown>) => LiquidLens | LiquidLens[] | undefined) & {
        syncWith?: (config?: Record<string, unknown>) => unknown;
      };
      __liquidGLRenderer__?: LiquidRenderer;
      lil?: { GUI: new (options?: Record<string, unknown>) => LiquidGuiInstance };
    };
    if (!w.liquidGL) return 0;

    this.destroyLiquidGui();
    this.destroyLiquidRenderer();
    delete (window as { __liquidGLNoWebGL__?: boolean }).__liquidGLNoWebGL__;

    // Keep card and shape lens rendering on separate passes.
    // liquidGL uses one shared canvas tied to highest target z-index, so running
    // both target groups together can obscure card content under the shape layer.
    const shouldRenderCardLens = !this.magnifierExpanded;
    const shouldRenderShapeLens = this.magnifierExpanded;

    // Demo-4 profile for cards (bound to inert overlay targets).
    const createdCards = shouldRenderCardLens
      ? w.liquidGL({
          target: '.results-container .result-card-lens',
          refraction: DEMO4_CARD_DEFAULTS.refraction,
          bevelDepth: DEMO4_CARD_DEFAULTS.bevelDepth,
          bevelWidth: DEMO4_CARD_DEFAULTS.bevelWidth,
          frost: DEMO4_CARD_DEFAULTS.frost,
          shadow: DEMO4_CARD_DEFAULTS.shadow,
          specular: DEMO4_CARD_DEFAULTS.specular,
          tilt: DEMO4_CARD_DEFAULTS.tilt,
          tiltFactor: DEMO4_CARD_DEFAULTS.tiltFactor,
          reveal: DEMO4_CARD_DEFAULTS.reveal,
        })
      : undefined;

    // Demo-5 profile for the large .shape lens.
    const createdShape = shouldRenderShapeLens
      ? w.liquidGL({
          target: '.shape.liquid-shape-trigger',
          snapshot: '.main-content',
          refraction: DEMO5_SHAPE_DEFAULTS.refraction,
          bevelDepth: DEMO5_SHAPE_DEFAULTS.bevelDepth,
          bevelWidth: DEMO5_SHAPE_DEFAULTS.bevelWidth,
          frost: DEMO5_SHAPE_DEFAULTS.frost,
          specular: DEMO5_SHAPE_DEFAULTS.specular,
          shadow: DEMO5_SHAPE_DEFAULTS.shadow,
          reveal: DEMO5_SHAPE_DEFAULTS.reveal,
        })
      : undefined;

    const cardLensList = this.normalizeLensList(createdCards);
    const shapeLensList = this.normalizeLensList(createdShape);
    const lensList = cardLensList.concat(shapeLensList);

    if (lensList.length > 0) {
      const cardsControls = this.resolveControlState(cardLensList[0], DEMO4_CARD_DEFAULTS);
      const shapeControls = this.resolveControlState(shapeLensList[0], DEMO5_SHAPE_DEFAULTS);

      this.mountLiquidControls({
        cards: {
          state: cardsControls,
          update: (key, value) => this.updateLensGroup(cardLensList, key, value),
        },
        shape: {
          state: shapeControls,
          update: (key, value) => this.updateLensGroup(shapeLensList, key, value),
        },
      });
      this.setLiquidDiagnostics(null);
      this.setLiquidActiveClass(cardLensList.length > 0);
    } else {
      // Menu still appears even in fallback mode, but effect is disabled without WebGL.
      this.mountLiquidControls({
        cards: {
          state: { ...DEMO4_CARD_DEFAULTS },
          update: () => undefined,
        },
        shape: {
          state: { ...DEMO5_SHAPE_DEFAULTS },
          update: () => undefined,
        },
      });
      this.setLiquidDiagnostics('LiquidGL fallback mode active (WebGL unavailable).');
      this.setLiquidActiveClass(false);
    }

    const totalTargetCount =
      (shouldRenderCardLens ? cardCount : 0) +
      (shouldRenderShapeLens && document.querySelector('.liquid-shape-trigger') ? 1 : 0);
    this.verifyLiquidChecks(totalTargetCount, lensList.length, shouldRenderCardLens);

    w.liquidGL.syncWith?.({
      gsap: false,
      lenis: false,
      locomotiveScroll: false,
    });

    return lensList.length;
  }

  private mountLiquidControls(config: {
    cards: {
      state: LiquidControlState;
      update: <K extends keyof LiquidControlState>(key: K, value: LiquidControlState[K]) => void;
    };
    shape: {
      state: LiquidControlState;
      update: <K extends keyof LiquidControlState>(key: K, value: LiquidControlState[K]) => void;
    };
  }): void {
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
    gui.domElement.setAttribute('data-ui-check', 'liquid-glass-menu');

    const cardsFolder = gui.addFolder('liquidGL Effect (Demo 4 Cards)');
    this.addStandardControls(cardsFolder, config.cards.state, config.cards.update);
    cardsFolder.close();

    const shapeFolder = gui.addFolder('liquidGL Effect (Demo 5 Lens)');
    this.addStandardControls(shapeFolder, config.shape.state, config.shape.update);
    shapeFolder.close();

    this.liquidGui = gui;
  }

  private addStandardControls(
    folder: {
      add: (obj: Record<string, unknown>, key: string, ...rest: unknown[]) => { onChange: (cb: (value: unknown) => void) => unknown };
      close: () => void;
    },
    controlState: LiquidControlState,
    updateAll: <K extends keyof LiquidControlState>(key: K, value: LiquidControlState[K]) => void
  ): void {
    folder.add(controlState, 'refraction', 0, 0.1, 0.001).onChange(v => updateAll('refraction', v as number));
    folder.add(controlState, 'bevelDepth', 0, 0.2, 0.001).onChange(v => updateAll('bevelDepth', v as number));
    folder.add(controlState, 'bevelWidth', 0, 0.5, 0.001).onChange(v => updateAll('bevelWidth', v as number));
    folder.add(controlState, 'frost', 0, 10, 0.1).onChange(v => updateAll('frost', v as number));
    folder.add(controlState, 'magnify', 1, 5, 0.1).onChange(v => updateAll('magnify', v as number));
    folder.add(controlState, 'shadow').onChange(v => updateAll('shadow', v as boolean));
    folder.add(controlState, 'specular').onChange(v => updateAll('specular', v as boolean));
    folder.add(controlState, 'tilt').onChange(v => updateAll('tilt', v as boolean));
    folder.add(controlState, 'tiltFactor', 0, 25, 0.1).onChange(v => updateAll('tiltFactor', v as number));
    folder.add(controlState, 'reveal', ['none', 'fade']).onChange(v => updateAll('reveal', v as LiquidReveal));
  }

  private normalizeLensList(
    created: LiquidLens | LiquidLens[] | undefined
  ): LiquidLens[] {
    const rawInstances = Array.isArray(created) ? created : created ? [created] : [];
    return rawInstances.filter(instance => this.isLiquidLens(instance));
  }

  private resolveControlState(lens: LiquidLens | undefined, fallback: LiquidControlState): LiquidControlState {
    const options = lens?.options;
    if (!options) return { ...fallback };

    return {
      refraction: this.asNumber(options.refraction, fallback.refraction),
      bevelDepth: this.asNumber(options.bevelDepth, fallback.bevelDepth),
      bevelWidth: this.asNumber(options.bevelWidth, fallback.bevelWidth),
      frost: this.asNumber(options.frost, fallback.frost),
      magnify: this.asNumber(options.magnify, fallback.magnify),
      shadow: this.asBoolean(options.shadow, fallback.shadow),
      specular: this.asBoolean(options.specular, fallback.specular),
      tilt: this.asBoolean(options.tilt, fallback.tilt),
      tiltFactor: this.asNumber(options.tiltFactor, fallback.tiltFactor),
      reveal: this.asReveal(options.reveal, fallback.reveal),
    };
  }

  private updateLensGroup<K extends keyof LiquidControlState>(
    lenses: LiquidLens[],
    key: K,
    value: LiquidControlState[K]
  ): void {
    lenses.forEach(lens => {
      lens.options[key] = value;
      if (key === 'shadow') lens.setShadow?.(Boolean(value));
      if (key === 'tilt') lens.setTilt?.(Boolean(value));
    });
  }

  private asNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private asReveal(value: unknown, fallback: LiquidReveal): LiquidReveal {
    return value === 'none' || value === 'fade' ? value : fallback;
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
    this.cleanupMagnifierDrag();
    if (this.liquidInitTimer !== null) {
      window.clearTimeout(this.liquidInitTimer);
      this.liquidInitTimer = null;
    }
    this.liquidRetryCount = 0;
    if (!this.liquidBootstrapped && !this.liquidGui && !(window as { __liquidGLRenderer__?: LiquidRenderer }).__liquidGLRenderer__) {
      return;
    }
    this.detachLiquidRenderListeners();
    this.destroyLiquidGui();
    this.destroyLiquidRenderer();
    this.setLiquidActiveClass(false);
    this.setLiquidDiagnostics(null);
    this.liquidBootstrapped = false;
  }

  private cleanupMagnifierDrag(): void {
    const wasDragging = this.magnifierDragging;
    this.magnifierDragging = false;
    this.dragPointerId = null;
    this.dragMoved = false;
    window.removeEventListener('pointermove', this.boundMagnifierPointerMove);
    window.removeEventListener('pointerup', this.boundMagnifierPointerUp);
    window.removeEventListener('pointercancel', this.boundMagnifierPointerUp);
    if (wasDragging) {
      this.cdr.markForCheck();
    }
  }

  private setLiquidActiveClass(active: boolean): void {
    const container = document.querySelector('.results-container');
    if (!container) return;
    container.classList.toggle('liquidgl-active', active);
  }

  private verifyLiquidChecks(targetCount: number, lensCount: number, cardModeActive: boolean): void {
    const hasGui = !!document.querySelector('.lil-gui');
    const hasRenderer = !!(window as { __liquidGLRenderer__?: LiquidRenderer }).__liquidGLRenderer__;
    const canvas = document.querySelector('canvas[data-liquid-ignore]') as HTMLElement | null;
    const container = document.querySelector('.results-container') as HTMLElement | null;
    const parseZ = (z: string): number => {
      const value = Number.parseInt(z, 10);
      return Number.isFinite(value) ? value : 0;
    };
    if (targetCount === 0) {
      console.warn('[liquidGL-check] No target cards found.');
    }
    if (!hasGui) {
      console.warn('[liquidGL-check] Controls menu did not mount.');
    }
    if (lensCount === 0 || !hasRenderer) {
      console.warn('[liquidGL-check] WebGL lens not active (fallback mode).');
    }
    if (cardModeActive && hasRenderer && canvas && container) {
      const canvasZ = parseZ(getComputedStyle(canvas).zIndex);
      const containerZ = parseZ(getComputedStyle(container).zIndex);
      if (canvasZ >= containerZ) {
        console.warn(
          `[liquidGL-check] Card occlusion risk detected (canvas z=${canvasZ}, container z=${containerZ}).`
        );
      }
    }
  }

  private isLiquidLens(value: unknown): value is LiquidLens {
    if (!value || typeof value !== 'object') return false;
    return 'options' in value;
  }

  private setLiquidDiagnostics(message: string | null): void {
    this.ngZone.run(() => {
      this.liquidDiagnostics = message;
      this.cdr.markForCheck();
    });
  }

  private renderLiquidNow(): void {
    if (typeof window === 'undefined') return;
    const w = window as Window & {
      __liquidGLRenderer__?: LiquidRenderer;
      liquidGL?: { syncWith?: (config?: Record<string, unknown>) => unknown };
    };

    w.liquidGL?.syncWith?.({
      gsap: false,
      lenis: false,
      locomotiveScroll: false,
    });
    w.__liquidGLRenderer__?.render?.();
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

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
