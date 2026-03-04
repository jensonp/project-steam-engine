/**
 * Layer 1: Unit Tests — GlassSettingsComponent
 *
 * Tests the glass settings UI component behavior, including:
 * - Panel toggle functionality
 * - Settings change emission
 * - Preset selection
 * - Slider and toggle interactions
 */

import { GlassSettingsComponent } from '../glass-settings/glass-settings.component';
import { GlassSettingsService, GlassSettings } from '../../services/glass-settings.service';

describe('GlassSettingsComponent', () => {
  let component: GlassSettingsComponent;
  let mockGlassService: GlassSettingsService;

  beforeEach(() => {
    localStorage.clear();
    mockGlassService = new GlassSettingsService();
    component = new GlassSettingsComponent(mockGlassService);
  });

  // ── Initialization ──────────────────────────────────────────────────────────
  describe('initialization', () => {
    it('should start with collapsed panel', () => {
      expect(component.isCollapsed).toBe(true);
    });

    it('should have access to glass service settings', () => {
      const settings = component.settings();
      expect(settings).toBeDefined();
      expect(settings.enabled).toBe(false);
    });

    it('should expose glassService presets', () => {
      expect(component.glassService.presets.length).toBeGreaterThan(0);
    });
  });

  // ── Panel Toggle ────────────────────────────────────────────────────────────
  describe('togglePanel()', () => {
    it('should expand panel when collapsed', () => {
      expect(component.isCollapsed).toBe(true);
      
      component.togglePanel();
      
      expect(component.isCollapsed).toBe(false);
    });

    it('should collapse panel when expanded', () => {
      component.isCollapsed = false;
      
      component.togglePanel();
      
      expect(component.isCollapsed).toBe(true);
    });
  });

  // ── Enable Toggle ───────────────────────────────────────────────────────────
  describe('onToggleEnabled()', () => {
    it('should toggle the enabled state via service', () => {
      const initialEnabled = component.settings().enabled;
      
      component.onToggleEnabled();
      
      expect(component.settings().enabled).toBe(!initialEnabled);
    });

    it('should emit settingsChanged event', () => {
      const emitSpy = jest.spyOn(component.settingsChanged, 'emit');
      
      component.onToggleEnabled();
      
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true
      }));
    });
  });

  // ── Preset Change ───────────────────────────────────────────────────────────
  describe('onPresetChange()', () => {
    it('should apply preset when selecting a valid preset', () => {
      component.onPresetChange('Alien');
      
      const settings = component.settings();
      expect(settings.preset).toBe('Alien');
      expect(settings.refraction).toBe(0.073);
    });

    it('should set preset to Custom when selecting Custom', () => {
      component.onPresetChange('Custom');
      
      expect(component.settings().preset).toBe('Custom');
    });

    it('should not change other settings when selecting Custom', () => {
      const beforeRefraction = component.settings().refraction;
      
      component.onPresetChange('Custom');
      
      expect(component.settings().refraction).toBe(beforeRefraction);
    });
  });

  // ── Slider Changes ──────────────────────────────────────────────────────────
  describe('onSliderChange()', () => {
    it('should update refraction value', () => {
      component.onSliderChange('refraction', 0.05);
      
      expect(component.settings().refraction).toBe(0.05);
    });

    it('should update frost value', () => {
      component.onSliderChange('frost', 7.5);
      
      expect(component.settings().frost).toBe(7.5);
    });

    it('should update bevelDepth value', () => {
      component.onSliderChange('bevelDepth', 0.15);
      
      expect(component.settings().bevelDepth).toBe(0.15);
    });

    it('should update magnify value', () => {
      component.onSliderChange('magnify', 1.5);
      
      expect(component.settings().magnify).toBe(1.5);
    });

    it('should set preset to Custom when slider changes', () => {
      component.onPresetChange('Alien');
      expect(component.settings().preset).toBe('Alien');
      
      component.onSliderChange('refraction', 0.02);
      
      expect(component.settings().preset).toBe('Custom');
    });
  });

  // ── Toggle Changes ──────────────────────────────────────────────────────────
  describe('onToggleChange()', () => {
    it('should update shadow toggle', () => {
      component.onToggleChange('shadow', false);
      
      expect(component.settings().shadow).toBe(false);
    });

    it('should update specular toggle', () => {
      component.onToggleChange('specular', false);
      
      expect(component.settings().specular).toBe(false);
    });

    it('should update tilt toggle', () => {
      component.onToggleChange('tilt', true);
      
      expect(component.settings().tilt).toBe(true);
    });

    it('should set preset to Custom when toggle changes', () => {
      component.onPresetChange('Default');
      
      component.onToggleChange('shadow', false);
      
      expect(component.settings().preset).toBe('Custom');
    });
  });

  // ── Reset ───────────────────────────────────────────────────────────────────
  describe('onReset()', () => {
    it('should reset all settings to defaults', () => {
      // Change some settings first
      component.onSliderChange('refraction', 0.1);
      component.onSliderChange('frost', 10);
      component.onToggleChange('shadow', false);
      
      component.onReset();
      
      const settings = component.settings();
      expect(settings.refraction).toBe(0.02);
      expect(settings.frost).toBe(1);
      expect(settings.shadow).toBe(true);
      expect(settings.preset).toBe('Default');
      expect(settings.animatedBackground).toBe('gradient');
    });
  });

  // ── Apply ───────────────────────────────────────────────────────────────────
  describe('onApply()', () => {
    it('should emit current settings', () => {
      const emitSpy = jest.spyOn(component.settingsChanged, 'emit');
      component.onSliderChange('frost', 5);
      
      component.onApply();
      
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        frost: 5
      }));
    });
  });

  // ── Background Change ────────────────────────────────────────────────────────
  describe('onBackgroundChange()', () => {
    it('should update animated background setting', () => {
      component.onBackgroundChange('waves');
      
      expect(component.settings().animatedBackground).toBe('waves');
    });

    it('should emit settingsChanged when background changes', () => {
      const emitSpy = jest.spyOn(component.settingsChanged, 'emit');
      
      component.onBackgroundChange('particles');
      
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        animatedBackground: 'particles'
      }));
    });

    it('should set preset to Custom when background changes', () => {
      component.onPresetChange('Default');
      
      component.onBackgroundChange('plasma');
      
      expect(component.settings().preset).toBe('Custom');
    });
  });

  // ── Integration with Service ────────────────────────────────────────────────
  describe('service integration', () => {
    it('should reflect service settings changes', () => {
      mockGlassService.saveSettings({ frost: 8, refraction: 0.05 });
      
      expect(component.settings().frost).toBe(8);
      expect(component.settings().refraction).toBe(0.05);
    });

    it('should persist changes through service', () => {
      component.onSliderChange('bevelWidth', 0.25);
      
      // Create new service instance to verify persistence
      const newService = new GlassSettingsService();
      expect(newService.settings().bevelWidth).toBe(0.25);
    });

    it('should persist animated background changes', () => {
      component.onBackgroundChange('waves');
      
      const newService = new GlassSettingsService();
      expect(newService.settings().animatedBackground).toBe('waves');
    });
  });
});
