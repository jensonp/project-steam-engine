import { Component, OnDestroy, OnInit } from '@angular/core';
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
  imports: [CommonModule, GameCardComponent, RouterLink, MatButtonModule]
})
export class ResultScreen implements OnInit, OnDestroy {
  results: Game[] = [];
  private subs = new Subscription();

  constructor(
    private router: Router,
    private backendService: BackendService
  ) {
    // Fallback: Check router state first in case page was reloaded manually
    const state = this.router.getCurrentNavigation()?.extras.state as { results: Game[] };
    if (state?.results) {
      this.results = state.results;
    }
  }

  ngOnInit(): void {
    // Subscribe to both general search results AND personalized recommendations
    // Whichever emits data last will overwrite the view. 
    this.subs.add(this.backendService.searchResults$.subscribe(results => {
      if (results && results.length > 0) {
        this.results = results;
      }
    }));
    
    this.subs.add(this.backendService.recommendations$.subscribe(recs => {
      if (recs && recs.length > 0) {
        // Map ScoredRecommendation to Game if needed, or update child components to handle both
        // The HTML template uses generic fields present in both, so it's structurally compatible.
        this.results = recs as unknown as Game[]; 
      }
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
