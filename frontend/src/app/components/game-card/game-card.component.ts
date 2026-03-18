import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
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
  templateUrl:"./game-card.component.html",
  styleUrl: "./game-card.component.css",
  host: { 'class': 'game-card-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCardComponent {
  @Input() game?: Game;
  @Input() prioritizeImage = false;

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
}
