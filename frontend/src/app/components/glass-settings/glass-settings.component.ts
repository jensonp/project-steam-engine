import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GlassSettingsService, GlassSettings } from '../../services/glass-settings.service';

@Component({
  selector: 'app-glass-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatTooltipModule
  ],
  template: `
    <div class="glass-settings-panel" [class.collapsed]="isCollapsed" data-liquid-ignore>
      <button class="toggle-btn" (click)="togglePanel()" [matTooltip]="isCollapsed ? 'Open Glass Settings' : 'Close'">
        <mat-icon>{{ isCollapsed ? 'auto_awesome' : 'close' }}</mat-icon>
      </button>

      @if (!isCollapsed) {
        <div class="panel-content">
          <h3>
            <mat-icon>blur_on</mat-icon>
            Liquid Glass Effect
          </h3>

          <div class="setting-row">
            <mat-slide-toggle
              [checked]="settings().enabled"
              (change)="onToggleEnabled()">
              Enable Glass Effect
            </mat-slide-toggle>
          </div>

          @if (settings().enabled) {
            <div class="setting-row">
              <label>Preset</label>
              <mat-form-field appearance="outline" class="preset-select">
                <mat-select [value]="settings().preset" (selectionChange)="onPresetChange($event.value)">
                  @for (preset of glassService.presets; track preset.name) {
                    <mat-option [value]="preset.name">{{ preset.name }}</mat-option>
                  }
                  <mat-option value="Custom">Custom</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="setting-row">
              <label>Refraction <span class="value">{{ (settings().refraction * 100).toFixed(0) }}%</span></label>
              <mat-slider min="0" max="0.1" step="0.001" class="full-width">
                <input matSliderThumb [value]="settings().refraction" (valueChange)="onSliderChange('refraction', $event)">
              </mat-slider>
            </div>

            <div class="setting-row">
              <label>Bevel Depth <span class="value">{{ (settings().bevelDepth * 100).toFixed(0) }}%</span></label>
              <mat-slider min="0" max="0.3" step="0.005" class="full-width">
                <input matSliderThumb [value]="settings().bevelDepth" (valueChange)="onSliderChange('bevelDepth', $event)">
              </mat-slider>
            </div>

            <div class="setting-row">
              <label>Bevel Width <span class="value">{{ (settings().bevelWidth * 100).toFixed(0) }}%</span></label>
              <mat-slider min="0" max="0.5" step="0.005" class="full-width">
                <input matSliderThumb [value]="settings().bevelWidth" (valueChange)="onSliderChange('bevelWidth', $event)">
              </mat-slider>
            </div>

            <div class="setting-row">
              <label>Frost <span class="value">{{ settings().frost.toFixed(1) }}px</span></label>
              <mat-slider min="0" max="10" step="0.1" class="full-width">
                <input matSliderThumb [value]="settings().frost" (valueChange)="onSliderChange('frost', $event)">
              </mat-slider>
            </div>

            <div class="setting-row">
              <label>Magnify <span class="value">{{ settings().magnify.toFixed(2) }}x</span></label>
              <mat-slider min="0.5" max="2" step="0.05" class="full-width">
                <input matSliderThumb [value]="settings().magnify" (valueChange)="onSliderChange('magnify', $event)">
              </mat-slider>
            </div>

            <div class="toggles-row">
              <mat-slide-toggle
                [checked]="settings().shadow"
                (change)="onToggleChange('shadow', $event.checked)">
                Shadow
              </mat-slide-toggle>

              <mat-slide-toggle
                [checked]="settings().specular"
                (change)="onToggleChange('specular', $event.checked)">
                Specular
              </mat-slide-toggle>
            </div>

            <div class="toggles-row">
              <mat-slide-toggle
                [checked]="settings().tilt"
                (change)="onToggleChange('tilt', $event.checked)">
                Tilt Effect
              </mat-slide-toggle>
            </div>

            @if (settings().tilt) {
              <div class="setting-row">
                <label>Tilt Factor <span class="value">{{ settings().tiltFactor }}°</span></label>
                <mat-slider min="1" max="25" step="1" class="full-width">
                  <input matSliderThumb [value]="settings().tiltFactor" (valueChange)="onSliderChange('tiltFactor', $event)">
                </mat-slider>
              </div>
            }

            <div class="setting-row">
              <label>Animated Background</label>
              <mat-form-field appearance="outline" class="preset-select">
                <mat-select [value]="settings().animatedBackground" (selectionChange)="onBackgroundChange($event.value)">
                  <mat-option value="none">None</mat-option>
                  <mat-option value="gradient">Gradient Flow</mat-option>
                  <mat-option value="waves">Ocean Waves</mat-option>
                  <mat-option value="particles">Particles</mat-option>
                  <mat-option value="plasma">Plasma</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="actions-row">
              <button mat-stroked-button (click)="onReset()">
                <mat-icon>refresh</mat-icon>
                Reset
              </button>
              <button mat-flat-button color="primary" (click)="onApply()">
                <mat-icon>check</mat-icon>
                Apply
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .glass-settings-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000;
      background: rgba(23, 29, 37, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      color: white;
      transition: all 0.3s ease;
      max-width: 320px;
      overflow: hidden;
    }

    .glass-settings-panel.collapsed {
      background: rgba(23, 29, 37, 0.8);
      border-radius: 50%;
      width: 48px;
      height: 48px;
    }

    .toggle-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    }

    .collapsed .toggle-btn {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .toggle-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .panel-content {
      padding: 16px;
      padding-top: 48px;
    }

    h3 {
      margin: 0 0 16px 0;
      font-size: 1rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h3 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .setting-row {
      margin-bottom: 16px;
    }

    .setting-row label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      margin-bottom: 4px;
      color: rgba(255, 255, 255, 0.9);
    }

    .setting-row .value {
      color: #66c0f4;
      font-weight: 500;
    }

    .full-width {
      width: 100%;
    }

    .preset-select {
      width: 100%;
    }

    ::ng-deep .preset-select .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .toggles-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .actions-row {
      display: flex;
      gap: 8px;
      margin-top: 20px;
      justify-content: flex-end;
    }

    .actions-row button {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .actions-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    ::ng-deep .mat-mdc-slide-toggle {
      --mdc-switch-selected-track-color: #66c0f4;
      --mdc-switch-selected-handle-color: #ffffff;
      --mdc-switch-selected-hover-track-color: #5aa8d8;
      --mdc-switch-selected-focus-track-color: #66c0f4;
      --mdc-switch-selected-pressed-track-color: #66c0f4;
    }

    ::ng-deep .mat-mdc-slider {
      --mdc-slider-active-track-color: #66c0f4;
      --mdc-slider-inactive-track-color: rgba(102, 192, 244, 0.3);
      --mdc-slider-handle-color: #66c0f4;
      --mdc-slider-focus-handle-color: #66c0f4;
      --mdc-slider-hover-handle-color: #5aa8d8;
    }

    ::ng-deep .preset-select .mat-mdc-select-value,
    ::ng-deep .preset-select .mat-mdc-select-arrow {
      color: white;
    }

    ::ng-deep .preset-select .mdc-notched-outline__leading,
    ::ng-deep .preset-select .mdc-notched-outline__notch,
    ::ng-deep .preset-select .mdc-notched-outline__trailing {
      border-color: rgba(255, 255, 255, 0.3) !important;
    }
  `]
})
export class GlassSettingsComponent {
  @Output() settingsChanged = new EventEmitter<GlassSettings>();

  isCollapsed = true;

  constructor(public glassService: GlassSettingsService) {}

  get settings() {
    return this.glassService.settings;
  }

  togglePanel(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onToggleEnabled(): void {
    this.glassService.toggleEnabled();
    this.settingsChanged.emit(this.settings());
  }

  onPresetChange(presetName: string): void {
    if (presetName !== 'Custom') {
      this.glassService.applyPreset(presetName);
    } else {
      this.glassService.saveSettings({ preset: 'Custom' });
    }
  }

  onSliderChange(key: keyof GlassSettings, value: number): void {
    this.glassService.saveSettings({ [key]: value, preset: 'Custom' });
  }

  onToggleChange(key: keyof GlassSettings, value: boolean): void {
    this.glassService.saveSettings({ [key]: value, preset: 'Custom' });
  }

  onBackgroundChange(value: string): void {
    this.glassService.saveSettings({ animatedBackground: value as GlassSettings['animatedBackground'], preset: 'Custom' });
    this.settingsChanged.emit(this.settings());
  }

  onReset(): void {
    this.glassService.resetToDefault();
  }

  onApply(): void {
    this.settingsChanged.emit(this.settings());
  }
}
