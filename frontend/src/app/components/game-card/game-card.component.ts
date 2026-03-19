import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Game } from '../../types/steam.types';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
  ],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.css',
  host: { 'class': 'game-card-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCardComponent implements OnDestroy {
  @Input() game?: Game;
  @Input() prioritizeImage = false;
  private animationFrameId: number | null = null;
  private activeCardElement: HTMLElement | null = null;
  private targetTiltX = 0;
  private targetTiltY = 0;
  private currentTiltX = 0;
  private currentTiltY = 0;
  private pointerActive = false;
  private readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  truncateDescription(description: string): string {
    if (description.length > 210) {
      return description.substring(0, 210) + '...';
    }
    return description;
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.classList.add('loaded');
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'steam.png';
    img.classList.add('loaded');
  }

  onCardPointerMove(event: PointerEvent): void {
    if (this.prefersReducedMotion || event.pointerType === 'touch') return;
    const cardElement = this.resolveCardElement(event);
    if (!cardElement) return;

    const rect = cardElement.getBoundingClientRect();
    const relativeX = this.clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const relativeY = this.clamp((event.clientY - rect.top) / rect.height, 0, 1);

    this.pointerActive = true;
    this.activeCardElement = cardElement;
    cardElement.classList.add('is-pointer-active');

    this.targetTiltX = (0.5 - relativeY) * 5.8;
    this.targetTiltY = (relativeX - 0.5) * 7.2;

    this.ensureAnimation();
  }

  onCardPointerLeave(event: PointerEvent | FocusEvent): void {
    if (this.prefersReducedMotion) return;
    const cardElement = this.resolveCardElement(event);
    if (!cardElement) return;

    this.pointerActive = false;
    this.activeCardElement = cardElement;
    this.targetTiltX = 0;
    this.targetTiltY = 0;
    this.ensureAnimation();
  }

  onCardFocus(event: FocusEvent): void {
    if (this.prefersReducedMotion) return;
    const cardElement = this.resolveCardElement(event);
    if (!cardElement) return;

    this.pointerActive = true;
    this.activeCardElement = cardElement;
    cardElement.classList.add('is-pointer-active');
    this.ensureAnimation();
  }

  onCardBlur(event: FocusEvent): void {
    this.onCardPointerLeave(event);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private ensureAnimation(): void {
    if (this.animationFrameId !== null || typeof window === 'undefined') return;
    this.animationFrameId = window.requestAnimationFrame(() => this.animateCard());
  }

  private animateCard(): void {
    const cardElement = this.activeCardElement;
    if (!cardElement) {
      this.animationFrameId = null;
      return;
    }

    const easing = this.pointerActive ? 0.2 : 0.12;
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * easing;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * easing;

    cardElement.style.setProperty('--card-tilt-x', `${this.currentTiltX.toFixed(3)}deg`);
    cardElement.style.setProperty('--card-tilt-y', `${this.currentTiltY.toFixed(3)}deg`);

    const tiltSettled =
      Math.abs(this.targetTiltX - this.currentTiltX) < 0.015 &&
      Math.abs(this.targetTiltY - this.currentTiltY) < 0.015;

    if (!this.pointerActive && tiltSettled) {
      cardElement.classList.remove('is-pointer-active');
      this.animationFrameId = null;
      return;
    }

    if (typeof window !== 'undefined') {
      this.animationFrameId = window.requestAnimationFrame(() => this.animateCard());
    } else {
      this.animationFrameId = null;
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private resolveCardElement(event: Event): HTMLElement | null {
    const current = event.currentTarget;
    if (current instanceof HTMLElement) {
      return current;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) return null;
    return target.closest('.game-card') as HTMLElement | null;
  }
}
