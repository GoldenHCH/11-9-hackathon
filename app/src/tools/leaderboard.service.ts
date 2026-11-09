import type { ILeaderboardEntry, ILeaderboardInput } from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { toolDefaults } from './tools.constants';

export class LeaderboardService {
  private readonly _store: ResourceStoreService;

  public constructor(store: ResourceStoreService) {
    this._store = store;
  }

  public async leaderboard(input: ILeaderboardInput): Promise<ILeaderboardEntry[]> {
    const limit = input.limit ?? toolDefaults.LEADERBOARD_LIMIT;
    const totals = new Map<string, number>();

    for (const event of this._store.getXpEvents()) {
      totals.set(event.attendeeId, (totals.get(event.attendeeId) ?? 0) + event.xp);
    }

    return this._store
      .getAttendees()
      .filter((attendee) => attendee.visible)
      .map((attendee): ILeaderboardEntry => ({
        handle: attendee.handle,
        xp: totals.get(attendee.id) ?? attendee.xp,
        badges: attendee.badges,
      }))
      .sort((left, right) => right.xp - left.xp || left.handle.localeCompare(right.handle))
      .slice(0, limit);
  }
}
