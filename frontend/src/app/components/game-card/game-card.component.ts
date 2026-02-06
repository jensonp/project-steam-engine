import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OwnedGame, Game } from '../../types/steam.types';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl:"./game-card.component.html",
  styleUrl: "./game-card.component.css"
})
export class GameCardComponent {
  @Input() game!: OwnedGame;
  @Input() details?: Game;

  formatPlaytime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 100) {
      return `${hours.toFixed(1)} hrs`;
    }
    return `${hours} hrs`;
  }

  truncateDescription(description: string): string {
    if (description.length > 100) {
      return description.substring(0, 100) + '...';
    }
    return description;
  }
}
