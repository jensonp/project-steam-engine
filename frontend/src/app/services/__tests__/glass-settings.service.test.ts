/**
 * Layer 1: Unit Tests — GlassSettingsService
 *
 * Tests the glass effect settings management service, including:
 * - Default settings initialization
 * - Settings persistence to localStorage
 * - Preset application
 * - Settings update and reset functionality
 */

import { GlassSettingsService, GlassSettings } from '../glass-settings.service';

describe('GlassSettingsService', () => {
  let service: GlassSettingsService;

  beforeEach(() => {
    localStorage.clear();
    service = new GlassSettingsService();
  });

  // ── Initialization ──────────────────────────────────────────────────────────
  describe('initialization', () => {
    it('should initialize with default settings when localStorage is empty', () => {
      const settings = service.settings();
      
      expect(settings.enabled).toBe(false);
      expect(settings.refraction).toBe(0.02);
      expect(settings.bevelDepth).toBe(0.08);
      expect(settings.bevelWidth).toBe(0.2);
      expect(settings.frost).toBe(1);
      expect(settings.shadow).toBe(true);
      expect(settings.specular).toBe(true);
      expect(settings.tilt).toBe(false);
      expect(settings.tiltFactor).toBe(5);
      expect(settings.magnify).toBe(1);
      expect(settings.preset).toBe('Default');
      expect(settings.animatedBackground).toBe('gradient');
    });

    it('should load settings from localStorage if available', () => {
      const customSettings: Partial<GlassSettings> = {
        enabled: false,
        refraction: 0.05,
        frost: 5,
        preset: 'Custom'
      };
      localStorage.setItem('liquidGL_settings', JSON.stringify(customSettings));

      const newService = new GlassSettingsService();
      const settings = newService.settings();

      expect(settings.enabled).toBe(false);
      expect(settings.refraction).toBe(0.05);
      expect(settings.frost).toBe(5);
      expect(settings.preset).toBe('Custom');
      // Should still have default values for non-overridden settings
      expect(settings.bevelDepth).toBe(0.08);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('liquidGL_settings', 'invalid json {{{');
      
      const newService = new GlassSettingsService();
      const settings = newService.settings();

      // Should fall back to defaults
      expect(settings.enabled).toBe(false);
      expect(settings.preset).toBe('Default');
    });
  });

  // ── Presets ─────────────────────────────────────────────────────────────────
  describe('presets', () => {
    it('should have 7 built-in presets', () => {
      expect(service.presets).toHaveLength(7);
      const presetNames = service.presets.map(p => p.name);
      expect(presetNames).toContain('Default');
      expect(presetNames).toContain('Liquid');
      expect(presetNames).toContain('Alien');
      expect(presetNames).toContain('Pulse');
      expect(presetNames).toContain('Frost');
      expect(presetNames).toContain('Crystal');
      expect(presetNames).toContain('Steam');
    });

    it('should apply preset settings correctly', () => {
      service.applyPreset('Alien');
      const settings = service.settings();

      expect(settings.refraction).toBe(0.073);
      expect(settings.bevelDepth).toBe(0.2);
      expect(settings.bevelWidth).toBe(0.156);
      expect(settings.frost).toBe(2);
      expect(settings.shadow).toBe(true);
      expect(settings.specular).toBe(false);
      expect(settings.preset).toBe('Alien');
      expect(settings.animatedBackground).toBe('plasma');
    });

    it('should apply Liquid preset with more liquidy settings', () => {
      service.applyPreset('Liquid');
      const settings = service.settings();

      expect(settings.refraction).toBe(0.05);
      expect(settings.bevelDepth).toBe(0.15);
      expect(settings.bevelWidth).toBe(0.25);
      expect(settings.frost).toBe(0);
      expect(settings.tilt).toBe(true);
      expect(settings.tiltFactor).toBe(8);
      expect(settings.animatedBackground).toBe('waves');
      expect(settings.preset).toBe('Liquid');
    });

    it('should apply Frost preset with correct frosted glass settings', () => {
      service.applyPreset('Frost');
      const settings = service.settings();

      expect(settings.refraction).toBe(0.01);
      expect(settings.bevelDepth).toBe(0.035);
      expect(settings.frost).toBe(4);
      expect(settings.specular).toBe(true);
      expect(settings.preset).toBe('Frost');
    });

    it('should not change settings for unknown preset', () => {
      const before = { ...service.settings() };
      service.applyPreset('NonExistentPreset');
      const after = service.settings();

      expect(after).toEqual(before);
    });
  });

  // ── Settings Management ─────────────────────────────────────────────────────
  describe('saveSettings()', () => {
    it('should update settings and persist to localStorage', () => {
      service.saveSettings({ refraction: 0.05, frost: 8 });
      
      const settings = service.settings();
      expect(settings.refraction).toBe(0.05);
      expect(settings.frost).toBe(8);

      // Verify persistence
      const stored = JSON.parse(localStorage.getItem('liquidGL_settings')!);
      expect(stored.refraction).toBe(0.05);
      expect(stored.frost).toBe(8);
    });

    it('should preserve existing settings when updating partial values', () => {
      service.saveSettings({ refraction: 0.05 });
      service.saveSettings({ frost: 10 });
      
      const settings = service.settings();
      expect(settings.refraction).toBe(0.05);
      expect(settings.frost).toBe(10);
      expect(settings.shadow).toBe(true); // default preserved
    });
  });

  describe('toggleEnabled()', () => {
    it('should toggle the enabled state from false to true', () => {
      expect(service.settings().enabled).toBe(false);
      
      service.toggleEnabled();
      
      expect(service.settings().enabled).toBe(true);
    });

    it('should toggle the enabled state from true to false', () => {
      service.saveSettings({ enabled: true });
      expect(service.settings().enabled).toBe(true);
      
      service.toggleEnabled();
      
      expect(service.settings().enabled).toBe(false);
    });

    it('should persist the toggled state to localStorage', () => {
      service.toggleEnabled();
      
      const stored = JSON.parse(localStorage.getItem('liquidGL_settings')!);
      expect(stored.enabled).toBe(true);
    });
  });

  describe('resetToDefault()', () => {
    it('should reset all settings to default values', () => {
      // First, change some settings
      service.saveSettings({
        enabled: true,
        refraction: 0.1,
        frost: 10,
        preset: 'Custom',
        animatedBackground: 'plasma'
      });

      service.resetToDefault();
      const settings = service.settings();

      expect(settings.enabled).toBe(false);
      expect(settings.refraction).toBe(0.02);
      expect(settings.frost).toBe(1);
      expect(settings.preset).toBe('Default');
      expect(settings.animatedBackground).toBe('gradient');
    });

    it('should clear localStorage on reset', () => {
      service.saveSettings({ frost: 10 });
      expect(localStorage.getItem('liquidGL_settings')).not.toBeNull();

      service.resetToDefault();

      expect(localStorage.getItem('liquidGL_settings')).toBeNull();
    });
  });

  // ── Animated Background ──────────────────────────────────────────────────────
  describe('animatedBackground', () => {
    it('should default to gradient animation', () => {
      expect(service.settings().animatedBackground).toBe('gradient');
    });

    it('should allow changing to waves animation', () => {
      service.saveSettings({ animatedBackground: 'waves' });
      expect(service.settings().animatedBackground).toBe('waves');
    });

    it('should allow changing to particles animation', () => {
      service.saveSettings({ animatedBackground: 'particles' });
      expect(service.settings().animatedBackground).toBe('particles');
    });

    it('should allow changing to plasma animation', () => {
      service.saveSettings({ animatedBackground: 'plasma' });
      expect(service.settings().animatedBackground).toBe('plasma');
    });

    it('should allow disabling animation with none', () => {
      service.saveSettings({ animatedBackground: 'none' });
      expect(service.settings().animatedBackground).toBe('none');
    });

    it('should persist animated background setting to localStorage', () => {
      service.saveSettings({ animatedBackground: 'waves' });
      
      const stored = JSON.parse(localStorage.getItem('liquidGL_settings')!);
      expect(stored.animatedBackground).toBe('waves');
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle boolean settings correctly', () => {
      service.saveSettings({ shadow: false, specular: false, tilt: true });
      const settings = service.settings();

      expect(settings.shadow).toBe(false);
      expect(settings.specular).toBe(false);
      expect(settings.tilt).toBe(true);
    });

    it('should handle numeric boundary values', () => {
      service.saveSettings({
        refraction: 0,
        bevelDepth: 1,
        frost: 0,
        magnify: 0.001
      });
      
      const settings = service.settings();
      expect(settings.refraction).toBe(0);
      expect(settings.bevelDepth).toBe(1);
      expect(settings.frost).toBe(0);
      expect(settings.magnify).toBe(0.001);
    });
  });
});
