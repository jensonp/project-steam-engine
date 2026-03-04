import { Component, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { GlassSettingsComponent } from '../../components/glass-settings/glass-settings.component';
import { Game } from '../../types/steam.types';
import { Router, RouterLink } from '@angular/router';
import { GlassSettingsService, GlassSettings } from '../../services/glass-settings.service';
import { MatButtonModule } from '@angular/material/button';

interface LiquidGLApi {
  (options: Record<string, unknown>): unknown;
  registerDynamic?: (el: Element | string) => void;
}

declare global {
  interface Window {
    liquidGL?: LiquidGLApi;
    __liquidGLRenderer__?: { destroy?: () => void; _rafId?: number };
  }
}

@Component({
  selector: 'app-result-screen',
  standalone: true,
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [CommonModule, GameCardComponent, RouterLink, GlassSettingsComponent, MatButtonModule]
})
export class ResultScreen implements AfterViewInit, OnDestroy {
  @ViewChild('animatedBg') animatedBgCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('resultScreen') resultScreenEl?: ElementRef<HTMLElement>;

  results: Game[] = [];
  private glassInstance: unknown = null;
  private animationFrameId: number | null = null;

  constructor(
    private router: Router,
    public glassService: GlassSettingsService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private renderer2: Renderer2
  ) {
    if (this.glassService.settings().enabled) {
      this.glassService.saveSettings({ enabled: false });
    }

    const state = this.router.getCurrentNavigation()?.extras.state as { results: Game[] };
    if (state?.results) {
      this.results = state.results;
    }
  }

  get glassEnabled(): boolean {
    return this.glassService.settings().enabled;
  }

  get animatedBackground(): string {
    return this.glassService.settings().animatedBackground;
  }

  ngAfterViewInit(): void {
    if (this.results.length > 0 && this.glassEnabled) {
      this.activateGlass();
    }
  }

  ngOnDestroy(): void {
    this.deactivateGlass();
  }

  onBack(): void {
    this.router.navigate(['/']);
  }

  onToggleGlass(): void {
    this.glassService.toggleEnabled();
    this.onGlassSettingsChanged(this.glassService.settings());
  }

  onGlassSettingsChanged(settings: GlassSettings): void {
    this.deactivateGlass();
    this.cdr.detectChanges();

    if (settings.enabled && this.results.length > 0) {
      this.activateGlass();
    }
  }

  private activateGlass(): void {
    document.body.classList.add('glass-active');

    setTimeout(() => {
      this.cdr.detectChanges();
      setTimeout(() => {
        this.startAnimatedBackground();
        setTimeout(() => this.initLiquidGL(), 400);
      }, 100);
    }, 50);
  }

  private deactivateGlass(): void {
    this.destroyLiquidGL();
    this.stopAnimatedBackground();
    document.body.classList.remove('glass-active');
  }

  private startAnimatedBackground(): void {
    const settings = this.glassService.settings();
    if (settings.animatedBackground === 'none') return;

    this.ngZone.runOutsideAngular(() => {
      const canvas = this.animatedBgCanvas?.nativeElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.scrollWidth;
        canvas.height = container.scrollHeight;
      }

      let time = 0;
      const animate = () => {
        time += 0.016;

        switch (settings.animatedBackground) {
          case 'waves':
            this.drawWaves(ctx, canvas.width, canvas.height, time);
            break;
          case 'particles':
            this.drawParticles(ctx, canvas.width, canvas.height, time);
            break;
          case 'gradient':
            this.drawGradientFlow(ctx, canvas.width, canvas.height, time);
            break;
          case 'plasma':
            this.drawPlasma(ctx, canvas.width, canvas.height, time);
            break;
        }

        this.animationFrameId = requestAnimationFrame(animate);
      };

      animate();
    });
  }

  private stopAnimatedBackground(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private drawWaves(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a1628');
    bg.addColorStop(0.5, '#0d2137');
    bg.addColorStop(1, '#061018');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (let layer = 0; layer < 4; layer++) {
      const off = layer * 0.3;
      const amp = 30 + layer * 15;
      const freq = 0.008 - layer * 0.001;
      const spd = t * (0.8 + layer * 0.2);
      const a = 0.15 - layer * 0.03;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const y = h * (0.4 + layer * 0.12) +
          Math.sin(x * freq + spd + off) * amp +
          Math.sin(x * freq * 2 + spd * 1.5) * amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const wg = ctx.createLinearGradient(0, h * 0.3, 0, h);
      wg.addColorStop(0, `rgba(102, 192, 244, ${a})`);
      wg.addColorStop(0.5, `rgba(64, 156, 255, ${a * 0.8})`);
      wg.addColorStop(1, `rgba(30, 80, 150, ${a * 0.5})`);
      ctx.fillStyle = wg;
      ctx.fill();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const s = i * 137.5;
      const x = (s * 2.3 + t * 20 * (0.5 + (i % 3) * 0.3)) % w;
      const y = (s * 1.7 + t * 15 * (0.3 + (i % 5) * 0.2)) % h;
      const sz = 2 + Math.sin(t * 2 + i) * 1.5;
      const a = 0.3 + Math.sin(t * 3 + i * 0.5) * 0.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 3);
      g.addColorStop(0, `rgba(102, 192, 244, ${a})`);
      g.addColorStop(0.5, `rgba(147, 112, 219, ${a * 0.5})`);
      g.addColorStop(1, 'rgba(102, 192, 244, 0)');
      ctx.beginPath();
      ctx.arc(x, y, sz * 3, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(102, 192, 244, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 30; i++) {
      const s1 = i * 137.5, s2 = (i + 1) * 137.5;
      const x1 = (s1 * 2.3 + t * 20 * 0.5) % w, y1 = (s1 * 1.7 + t * 15 * 0.3) % h;
      const x2 = (s2 * 2.3 + t * 20 * 0.8) % w, y2 = (s2 * 1.7 + t * 15 * 0.5) % h;
      if (Math.hypot(x2 - x1, y2 - y1) < 150) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  }

  private drawGradientFlow(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const cx = w / 2 + Math.sin(t * 0.5) * w * 0.3;
    const cy = h / 2 + Math.cos(t * 0.4) * h * 0.3;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    const h1 = (t * 20) % 360, h2 = (h1 + 60) % 360, h3 = (h1 + 180) % 360;
    g.addColorStop(0, `hsla(${h1}, 70%, 30%, 1)`);
    g.addColorStop(0.3, `hsla(${h2}, 60%, 25%, 1)`);
    g.addColorStop(0.6, `hsla(210, 50%, 15%, 1)`);
    g.addColorStop(1, `hsla(${h3}, 40%, 10%, 1)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const ox = w * (0.2 + 0.6 * Math.sin(t * 0.3 + i * 1.3));
      const oy = h * (0.2 + 0.6 * Math.cos(t * 0.25 + i * 1.7));
      const os = 100 + Math.sin(t + i) * 30;
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, os);
      og.addColorStop(0, 'rgba(102, 192, 244, 0.2)');
      og.addColorStop(0.5, 'rgba(147, 112, 219, 0.1)');
      og.addColorStop(1, 'rgba(102, 192, 244, 0)');
      ctx.fillStyle = og;
      ctx.fillRect(ox - os, oy - os, os * 2, os * 2);
    }
  }

  private drawPlasma(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const sc = 0.02;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const v = Math.sin(x * sc + t) + Math.sin(y * sc + t * 0.7) +
          Math.sin((x + y) * sc * 0.5 + t * 0.5) +
          Math.sin(Math.sqrt(x * x + y * y) * sc * 0.5 + t * 0.8);
        const n = (v + 4) / 8;
        const r = Math.floor(Math.sin(n * Math.PI * 2) * 50 + 30);
        const g = Math.floor(Math.sin(n * Math.PI * 2 + 2) * 60 + 50);
        const b = Math.floor(Math.sin(n * Math.PI * 2 + 4) * 80 + 120);
        for (let dy = 0; dy < 2 && y + dy < h; dy++) {
          for (let dx = 0; dx < 2 && x + dx < w; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private initLiquidGL(): void {
    this.ngZone.runOutsideAngular(() => {
      const settings = this.glassService.settings();

      this.waitForLiquidGL()
        .then((liquid) => {
          const targets = document.querySelectorAll('.liquidGL');
          if (!targets.length) {
            console.warn('liquidGL: no .liquidGL targets found in DOM');
            return;
          }

          this.glassInstance = liquid({
            snapshot: 'body',
            target: '.liquidGL',
            resolution: 2.0,
            refraction: settings.refraction,
            bevelDepth: settings.bevelDepth,
            bevelWidth: settings.bevelWidth,
            frost: settings.frost,
            shadow: settings.shadow,
            specular: settings.specular,
            reveal: 'fade',
            tilt: settings.tilt,
            tiltFactor: settings.tiltFactor,
            magnify: settings.magnify,
            on: {
              init: () => {
                console.log('liquidGL initialized on', targets.length, 'game cards');
                const canvas = this.animatedBgCanvas?.nativeElement;
                if (canvas && liquid.registerDynamic) {
                  liquid.registerDynamic(canvas);
                }
              }
            }
          });
        })
        .catch((err: unknown) => {
          console.error('Failed to initialize liquidGL:', err);
        });
    });
  }

  private waitForLiquidGL(retries = 50, delayMs = 100): Promise<LiquidGLApi> {
    return new Promise((resolve, reject) => {
      const attempt = (remaining: number) => {
        if (window.liquidGL) { resolve(window.liquidGL); return; }
        if (remaining <= 0) { reject(new Error('liquidGL script did not load')); return; }
        setTimeout(() => attempt(remaining - 1), delayMs);
      };
      attempt(retries);
    });
  }

  private destroyLiquidGL(): void {
    this.glassInstance = null;

    const renderer = window.__liquidGLRenderer__;
    if (renderer) {
      if (renderer._rafId) {
        cancelAnimationFrame(renderer._rafId);
        renderer._rafId = undefined;
      }
      window.__liquidGLRenderer__ = undefined;
    }

    document.querySelectorAll('canvas[data-liquid-ignore]').forEach(c => {
      if (c !== this.animatedBgCanvas?.nativeElement) {
        c.remove();
      }
    });
  }
}
