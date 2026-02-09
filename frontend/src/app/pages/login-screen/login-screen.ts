import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


@Component({
  selector: 'app-login-screen',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login-screen.html',
  styleUrl: './login-screen.css',
})
export class LoginScreen {
  @Output() search = new EventEmitter<string>();
  
  steamID = '';
  isLoading = false;
  error = '';

  onEnter(): void {
    if (this.steamID.trim()) {
      this.error = '';
      this.search.emit(this.steamID.trim());
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string): void {
    this.error = error;
  }
}
