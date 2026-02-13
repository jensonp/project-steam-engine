import { Component, Input } from '@angular/core';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { BackendService } from '../../services/backend-service';
import { Game } from '../../types/steam.types';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-result-screen',
  templateUrl: './result-screen.html',
  styleUrl: './result-screen.css',
  imports: [GameCardComponent, RouterLink]
})
export class ResultScreen {
  @Input() results?: Game[] = [];

  constructor(private backendService: BackendService) {}

  onBack() {
    
  }
  
}
