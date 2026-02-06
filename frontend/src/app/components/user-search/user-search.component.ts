import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-user-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="search-container">
      <h1>Steam Game Library</h1>
      <p class="subtitle">Enter a Steam ID to view their game collection</p>
      
      <div class="search-form">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Steam ID (64-bit)</mat-label>
          <input 
            matInput 
            [(ngModel)]="steamId" 
            placeholder="76561198012345678"
            (keyup.enter)="onSearch()"
            [disabled]="isLoading"
          >
          <mat-hint>Find your Steam ID at steamid.io</mat-hint>
        </mat-form-field>
        
        <button 
          mat-raised-button 
          color="primary" 
          (click)="onSearch()"
          [disabled]="!steamId || isLoading"
          class="search-button"
        >
          @if (isLoading) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <ng-container>
              <mat-icon>search</mat-icon>
              Search
            </ng-container>
          }
        </button>
      </div>

      @if (error) {
        <div class="error-message">
          <mat-icon>error</mat-icon>
          {{ error }}
        </div>
      }
    </div>
  `,
  styles: [`
    .search-container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: #1976d2;
    }

    .subtitle {
      color: #666;
      margin-bottom: 2rem;
    }

    .search-form {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      justify-content: center;
    }

    .search-field {
      flex: 1;
      max-width: 400px;
    }

    .search-button {
      height: 56px;
      min-width: 120px;
    }

    .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 1rem;
      background-color: #ffebee;
      color: #c62828;
      border-radius: 4px;
    }

    @media (max-width: 600px) {
      .search-form {
        flex-direction: column;
        align-items: stretch;
      }

      .search-field {
        max-width: none;
      }

      .search-button {
        width: 100%;
      }
    }
  `]
})
export class UserSearchComponent {
  @Output() search = new EventEmitter<string>();
  
  steamId = '';
  isLoading = false;
  error = '';

  onSearch(): void {
    if (this.steamId.trim()) {
      this.error = '';
      this.search.emit(this.steamId.trim());
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}
