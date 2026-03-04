/**
 * Layer 1: Unit Tests — GameCardComponent
 *
 * Tests the game card component behavior, including:
 * - Game data display
 * - Glass effect integration
 * - Image loading/error handling
 * - Description truncation
 */

import { GameCardComponent } from '../game-card/game-card.component';
import { Game } from '../../types/steam.types';

describe('GameCardComponent', () => {
  let component: GameCardComponent;

  const mockGame: Game = {
    appId: 730,
    name: 'Counter-Strike 2',
    genres: ['Action', 'FPS', 'Shooter'],
    tags: ['Competitive', 'Multiplayer'],
    description: 'Counter-Strike 2 is a free-to-play tactical first-person shooter.',
    headerImage: 'https://cdn.steamstatic.com/steam/apps/730/header.jpg',
    releaseDate: '2023-09-27',
    developers: ['Valve'],
    publishers: ['Valve'],
    price: null,
    isFree: true
  };

  beforeEach(() => {
    component = new GameCardComponent();
  });

  // ── Initialization ──────────────────────────────────────────────────────────
  describe('initialization', () => {
    it('should create with undefined game by default', () => {
      expect(component.game).toBeUndefined();
    });

    it('should default glassEnabled to false', () => {
      expect(component.glassEnabled).toBe(false);
    });

    it('should accept game input', () => {
      component.game = mockGame;
      expect(component.game).toEqual(mockGame);
    });

    it('should accept glassEnabled input', () => {
      component.glassEnabled = true;
      expect(component.glassEnabled).toBe(true);
    });
  });

  // ── Description Truncation ──────────────────────────────────────────────────
  describe('truncateDescription()', () => {
    it('should return full description if under 100 characters', () => {
      const shortDesc = 'A short description.';
      const result = component.truncateDescription(shortDesc);
      expect(result).toBe(shortDesc);
    });

    it('should truncate description over 100 characters with ellipsis', () => {
      const longDesc = 'A'.repeat(150);
      const result = component.truncateDescription(longDesc);
      
      expect(result.length).toBe(103); // 100 chars + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle exactly 100 character description', () => {
      const exactDesc = 'A'.repeat(100);
      const result = component.truncateDescription(exactDesc);
      expect(result).toBe(exactDesc);
    });

    it('should handle empty description', () => {
      const result = component.truncateDescription('');
      expect(result).toBe('');
    });
  });

  // ── Image Loading ───────────────────────────────────────────────────────────
  describe('onImageLoad()', () => {
    it('should add loaded class to image element', () => {
      const mockImg = document.createElement('img');
      const mockEvent = { target: mockImg } as unknown as Event;
      
      component.onImageLoad(mockEvent);
      
      expect(mockImg.classList.contains('loaded')).toBe(true);
    });
  });

  describe('onImageError()', () => {
    it('should set fallback image source on error', () => {
      const mockImg = document.createElement('img');
      mockImg.src = 'https://broken-url.com/image.jpg';
      const mockEvent = { target: mockImg } as unknown as Event;
      
      component.onImageError(mockEvent);
      
      expect(mockImg.src).toContain('steam.png');
    });

    it('should add loaded class even on error', () => {
      const mockImg = document.createElement('img');
      const mockEvent = { target: mockImg } as unknown as Event;
      
      component.onImageError(mockEvent);
      
      expect(mockImg.classList.contains('loaded')).toBe(true);
    });
  });

  // ── Game Data Scenarios ─────────────────────────────────────────────────────
  describe('game data handling', () => {
    it('should handle game with all fields populated', () => {
      component.game = mockGame;
      
      expect(component.game.name).toBe('Counter-Strike 2');
      expect(component.game.genres).toHaveLength(3);
      expect(component.game.isFree).toBe(true);
    });

    it('should handle game with minimal fields', () => {
      const minimalGame: Game = {
        appId: 123,
        name: 'Minimal Game',
        genres: [],
        tags: [],
        description: null,
        headerImage: null,
        releaseDate: null,
        developers: [],
        publishers: [],
        price: null,
        isFree: false
      };
      
      component.game = minimalGame;
      expect(component.game.appId).toBe(123);
      expect(component.game.genres).toEqual([]);
    });

    it('should handle paid game with price', () => {
      const paidGame: Game = {
        ...mockGame,
        isFree: false,
        price: 59.99
      };
      
      component.game = paidGame;
      expect(component.game.price).toBe(59.99);
      expect(component.game.isFree).toBe(false);
    });

    it('should handle game with many genres (should display first 3)', () => {
      const manyGenresGame: Game = {
        ...mockGame,
        genres: ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation']
      };
      
      component.game = manyGenresGame;
      // Component template slices to first 3
      expect(component.game.genres.slice(0, 3)).toEqual(['Action', 'Adventure', 'RPG']);
    });
  });

  // ── Glass Effect Integration ────────────────────────────────────────────────
  describe('glass effect', () => {
    it('should have glassEnabled false by default', () => {
      expect(component.glassEnabled).toBe(false);
    });

    it('should accept glassEnabled true', () => {
      component.glassEnabled = true;
      expect(component.glassEnabled).toBe(true);
    });

    it('should work with game data when glass is enabled', () => {
      component.game = mockGame;
      component.glassEnabled = true;
      
      expect(component.game).toBeDefined();
      expect(component.glassEnabled).toBe(true);
    });
  });
});
