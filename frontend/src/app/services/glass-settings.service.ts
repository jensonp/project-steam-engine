import { Injectable, signal } from '@angular/core';

export interface GlassSettings {
  enabled: boolean;
  refraction: number;
  bevelDepth: number;
  bevelWidth: number;
  frost: number;
  shadow: boolean;
  specular: boolean;
  tilt: boolean;
  tiltFactor: number;
  magnify: number;
  preset: string;
  animatedBackground: 'none' | 'waves' | 'particles' | 'gradient' | 'plasma';
}

export interface GlassPreset {
  name: string;
  settings: Partial<GlassSettings>;
}

@Injectable({
  providedIn: 'root'
})
export class GlassSettingsService {
  private readonly STORAGE_KEY = 'liquidGL_settings';

  readonly presets: GlassPreset[] = [
    {
      name: 'Default',
      settings: { refraction: 0.02, bevelDepth: 0.08, bevelWidth: 0.2, frost: 1, shadow: true, specular: true, animatedBackground: 'gradient' }
    },
    {
      name: 'Liquid',
      settings: { refraction: 0.05, bevelDepth: 0.15, bevelWidth: 0.25, frost: 0, shadow: true, specular: true, tilt: true, tiltFactor: 8, animatedBackground: 'waves' }
    },
    {
      name: 'Alien',
      settings: { refraction: 0.073, bevelDepth: 0.2, bevelWidth: 0.156, frost: 2, shadow: true, specular: false, animatedBackground: 'plasma' }
    },
    {
      name: 'Pulse',
      settings: { refraction: 0.04, bevelDepth: 0.1, bevelWidth: 0.273, frost: 0, shadow: false, specular: true, animatedBackground: 'particles' }
    },
    {
      name: 'Frost',
      settings: { refraction: 0.01, bevelDepth: 0.035, bevelWidth: 0.119, frost: 4, shadow: true, specular: true, animatedBackground: 'gradient' }
    },
    {
      name: 'Crystal',
      settings: { refraction: 0.03, bevelDepth: 0.12, bevelWidth: 0.2, frost: 0, shadow: true, specular: true, tilt: true, animatedBackground: 'waves' }
    },
    {
      name: 'Steam',
      settings: { refraction: 0.025, bevelDepth: 0.1, bevelWidth: 0.18, frost: 2, shadow: true, specular: true, animatedBackground: 'gradient' }
    }
  ];

  private defaultSettings: GlassSettings = {
    enabled: false,
    refraction: 0.02,
    bevelDepth: 0.08,
    bevelWidth: 0.2,
    frost: 1,
    shadow: true,
    specular: true,
    tilt: false,
    tiltFactor: 5,
    magnify: 1,
    preset: 'Default',
    animatedBackground: 'gradient'
  };

  settings = signal<GlassSettings>(this.loadSettings());

  private loadSettings(): GlassSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load glass settings from localStorage');
    }
    return { ...this.defaultSettings };
  }

  saveSettings(settings: Partial<GlassSettings>): void {
    const current = this.settings();
    const updated = { ...current, ...settings };
    this.settings.set(updated);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save glass settings to localStorage');
    }
  }

  applyPreset(presetName: string): void {
    const preset = this.presets.find(p => p.name === presetName);
    if (preset) {
      this.saveSettings({ ...preset.settings, preset: presetName });
    }
  }

  resetToDefault(): void {
    this.settings.set({ ...this.defaultSettings });
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear glass settings from localStorage');
    }
  }

  toggleEnabled(): void {
    this.saveSettings({ enabled: !this.settings().enabled });
  }
}
