import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BackendService } from '../../services/backend-service';

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
    MatProgressSpinnerModule
  ],
  templateUrl: "./user-search.component.html",
  styleUrl: "./user-search.component.css"
})
export class UserSearchComponent {
  @Output() hasSteamID = new EventEmitter<string>();
  
  @Input() entered_text: string = '';
  @Input() credential_type: 'Steam ID' = 'Steam ID';
  isLoading = false;
  error = '';

  constructor(private backendService: BackendService) {}

  onSteamIdEnter(): void {
    this.isLoading = true;
    if (this.entered_text.trim()) { // Only set Steam ID if it's not empty, otherwise the backend will reject requests and log an error
      this.error = '';
      this.backendService.setSteamId(this.entered_text.trim());
    }

    // send steamID to backend to fetch library and generate recommendations
    this.backendService.indexUser();
    this.hasSteamID.emit(this.entered_text.trim());
    this.isLoading = false;
  }

  onEnter(): void {
    if (this.credential_type === 'Steam ID') {
      this.onSteamIdEnter();
    } 
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}