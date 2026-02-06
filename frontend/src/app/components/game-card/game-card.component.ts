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
  template: `
    <mat-card class="game-card" [class.has-details]="details">
      <div class="game-image">
        @if (details?.headerImage) {
          <img [src]="details!.headerImage" [alt]="game.name || 'Game'" />
        } @else {
          <div class="placeholder-image">
            <mat-icon>sports_esports</mat-icon>
          </div>
        }
      </div>
      
      <mat-card-content>
        <h3 class="game-title" [matTooltip]="game.name || ''">
          {{ game.name || 'Unknown Game' }}
        </h3>
        
        <div class="playtime">
          <mat-icon>schedule</mat-icon>
          <span>{{ formatPlaytime(game.playtimeMinutes) }}</span>
        </div>

        @if (game.playtime2Weeks) {
          <div class="recent-playtime">
            <small>{{ formatPlaytime(game.playtime2Weeks) }} last 2 weeks</small>
          </div>
        }

        @if (details) {
          <div class="game-details">
            @if (details.genres.length > 0) {
              <div class="genres">
                @for (genre of details.genres.slice(0, 3); track genre) {
                  <mat-chip>{{ genre }}</mat-chip>
                }
              </div>
            }
            
            @if (details.description) {
              <p class="description">{{ truncateDescription(details.description) }}</p>
            }

            <div class="price-info">
              @if (details.isFree) {
                <span class="free-badge">Free to Play</span>
              } @else if (details.price) {
                <span class="price">\${{ details.price.toFixed(2) }}</span>
              }
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .game-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }

    .game-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .game-image {
      width: 100%;
      height: 140px;
      overflow: hidden;
      background-color: #1a1a2e;
    }

    .game-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }

    .placeholder-image mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4a4a6a;
    }

    mat-card-content {
      padding: 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .game-title {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .playtime {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: #666;
      font-size: 0.875rem;
    }

    .playtime mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .recent-playtime {
      color: #1976d2;
      margin-top: 0.25rem;
    }

    .game-details {
      margin-top: 0.75rem;
      flex: 1;
    }

    .genres {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .genres mat-chip {
      font-size: 0.75rem;
    }

    .description {
      font-size: 0.8rem;
      color: #666;
      line-height: 1.4;
      margin: 0.5rem 0;
    }

    .price-info {
      margin-top: auto;
    }

    .free-badge {
      background-color: #4caf50;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .price {
      font-weight: 600;
      color: #1976d2;
    }
  `]
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
