import { OwnedGame } from '../../types/steam.types';

export class FriendOverlapStrategy {
  buildOverlapSet(
    friendLibraries: Map<string, OwnedGame[]>,
    minOverlap: number = 2
  ): Set<number> {
    const ownershipCount = new Map<number, number>();

    for (const games of friendLibraries.values()) {
      for (const game of games) {
        ownershipCount.set(game.appId, (ownershipCount.get(game.appId) ?? 0) + 1);
      }
    }

    const overlapSet = new Set<number>();
    for (const [appId, count] of ownershipCount) {
      if (count >= minOverlap) overlapSet.add(appId);
    }
    return overlapSet;
  }
}
