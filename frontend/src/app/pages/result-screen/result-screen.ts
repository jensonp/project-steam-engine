import { Component } from '@angular/core';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { Game } from '../../types/steam.types';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-result-screen',
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [GameCardComponent, RouterLink]
})
export class ResultScreen {
  results: Game[] = [];
  constructor(private router: Router) {
    const state = this.router.getCurrentNavigation()?.extras.state as { results: Game[] };
    if (state?.results) {
      this.results = state.results;
    }
  }
  onBack() {
    this.router.navigate(['/']);
  }
  
}
