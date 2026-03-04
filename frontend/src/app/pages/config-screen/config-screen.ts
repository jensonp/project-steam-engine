import { Component } from '@angular/core';
import { UserSearchComponent } from '../../components/user-search/user-search.component';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BackendService } from '../../services/backend-service';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-config-screen',
  standalone: true,
  imports: [UserSearchComponent, RouterLink, MatIconModule, MatProgressSpinner],
  templateUrl: './config-screen.html',
  styleUrl: './config-screen.css',
})
export class ConfigScreen {
  steamID_updated: boolean = false;
  apiKey_updated: boolean = false;
  apiKey_set: boolean = false;
  steamID: string = '';
  isIndexing: boolean = false;

  constructor(private backendService: BackendService) {
    this.steamID = this.backendService.getSteamId() || 'None'; // Initialize local steamID from backend service
    this.apiKey_set = Boolean(this.backendService.getApiKey());
  }

  onSteamIDReceived($event: string) {
    console.log('Received new Steam ID:', $event);
    this.steamID_updated = true;
    this.steamID = this.backendService.getSteamId(); // Update local steamID from backend service
  }

  buildIndex() {
    this.isIndexing = true;
    this.steamID_updated = false;
    this.backendService.indexStorefront().subscribe({
      next: (response) => {
        console.log('Indexing storefront successful:', response);
        this.isIndexing = false;
      },
      error: (error) => {
        console.error('Error indexing storefront:', error);
        this.isIndexing = false;
      }
    });
  }

  onAPIKeyEnter($event: string) {
    console.log('Received new API Key:', $event);
    this.apiKey_updated = true;
    this.apiKey_set = true;
  }
}