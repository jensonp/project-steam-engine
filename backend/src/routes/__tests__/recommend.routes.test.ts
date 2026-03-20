import { scoreFallbackCandidate } from '../recommend.routes';
import { UserProfile } from '../../types/steam.types';

function makeProfile(): UserProfile {
  return {
    steamId: '76561198393551255',
    personaName: 'test-user',
    avatar: null,
    librarySize: 0,
    recentGamesCount: 0,
    topGenres: [],
    friendsAnalyzed: 0,
    friendOverlapGames: 0,
    ownedAppIds: new Set<number>(),
    friendOverlapSet: new Set<number>(),
    genreVector: new Map<string, number>([
      ['zombie', 0.26],
      ['horror', 0.18],
      ['survival', 0.14],
      ['action', 0.06],
    ]),
    library: [],
  };
}

describe('scoreFallbackCandidate', () => {
  it('prioritizes zombie/horror matching candidates over generic popular games', () => {
    const profile = makeProfile();

    const zombieCandidate = {
      app_id: 1,
      game_name: 'Project Zomboid',
      genres: 'Indie,RPG,Simulation',
      tags: 'Zombies,Survival,Horror,Crafting',
      header_image: null,
      short_description: null,
      price: '19.99',
      positive_votes: 100000,
    };

    const genericPopularCandidate = {
      app_id: 2,
      game_name: 'Generic Popular Shooter',
      genres: 'Action',
      tags: 'FPS,Competitive,Multiplayer',
      header_image: null,
      short_description: null,
      price: '0',
      positive_votes: 5000000,
    };

    const zombieScore = scoreFallbackCandidate(zombieCandidate, profile, 5000000);
    const genericScore = scoreFallbackCandidate(genericPopularCandidate, profile, 5000000);

    expect(zombieScore.score).toBeGreaterThan(genericScore.score);
    expect(
      zombieScore.matchedSignals.some((signal) => signal.includes('zomb'))
    ).toBe(true);
  });
});
