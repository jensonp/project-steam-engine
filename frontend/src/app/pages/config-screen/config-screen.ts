import { Component, OnInit, OnDestroy } from '@angular/core';
// import { UserSearchComponent } from '../../components/user-search/user-search.component';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BackendService } from '../../services/backend-service';
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-config-screen',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatProgressSpinner],
  templateUrl: './config-screen.html',
  styleUrl: './config-screen.css',
})
export class ConfigScreen implements OnInit, OnDestroy {
  steamID_updated: boolean = false;
  steamID: string = 'None';
  isIndexing: boolean = false;
  
  private subs = new Subscription();

  constructor(private backendService: BackendService) {}

  ngOnInit() {
    this.subs.add(this.backendService.steamId$.subscribe(id => {
      this.steamID = id || 'None';
    }));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  onSteamIDReceived($event: string) {
    console.log('Received new Steam ID:', $event);
    this.steamID_updated = true;
    this.backendService.setSteamId($event); // Command updates behavior subject automatically
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
}