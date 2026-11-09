import { randomUUID } from 'node:crypto';
import type {
  ICheckInInput,
  ICheckInOutput,
  IWhatsAroundMeInput,
  IWhatsAroundMeOutput,
  IWhatsNextInput,
  IWhatsNextOutput,
  IXpEvent,
} from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { LocationHelper } from './location.helper';
import { LookupService } from './lookup.service';
import { RecommendService } from './recommend.service';
import { TimeHelper } from './time.helper';
import { toolDefaults, xpRewards } from './tools.constants';
import { XpLedgerService } from './xp-ledger.service';

export class PresenceService {
  private readonly _store: ResourceStoreService;
  private readonly _lookup: LookupService;
  private readonly _ledger: XpLedgerService;
  private readonly _recommend: RecommendService;

  public constructor(store: ResourceStoreService, lookup: LookupService, ledger: XpLedgerService, recommend: RecommendService) {
    this._store = store;
    this._lookup = lookup;
    this._ledger = ledger;
    this._recommend = recommend;
  }

  public async checkIn(input: ICheckInInput): Promise<ICheckInOutput> {
    const attendee = this._lookup.attendee(input.attendeeId);
    const location = this._lookup.location(input.locationId);
    const event: IXpEvent = {
      id: `xp-${randomUUID()}`,
      attendeeId: attendee.id,
      type: 'check_in',
      xp: xpRewards.CHECK_IN,
      locationId: location.id,
      at: this._store.now().toISOString(),
    };

    await this._ledger.record(event, location);

    return { location: LocationHelper.withoutToken(location), xp: event.xp, event };
  }

  public async whatsAroundMe(input: IWhatsAroundMeInput): Promise<IWhatsAroundMeOutput> {
    const attendee = this._lookup.attendee(input.attendeeId);
    const location = attendee.lastLocationId ? this._store.getLocation(attendee.lastLocationId) : undefined;

    if (!location) {
      return { location: null, sessionsNowHere: [], sessionsNextHere: [], peopleHere: [] };
    }

    const now = this._store.now();
    const sessionsHere = this._store.getSessions().filter((session) => session.locationId === location.id);
    const peopleHere = this._store
      .getAttendees()
      .filter((candidate) => candidate.id !== attendee.id && candidate.visible && candidate.lastLocationId === location.id);

    return {
      location: LocationHelper.withoutToken(location),
      sessionsNowHere: sessionsHere.filter((session) => TimeHelper.isRunning(session, now)),
      sessionsNextHere: sessionsHere
        .filter((session) => Date.parse(session.start) > now.getTime())
        .sort(TimeHelper.byStart)
        .slice(0, toolDefaults.SESSIONS_NEXT_HERE),
      peopleHere: this._recommend.rankPeople(attendee, peopleHere, toolDefaults.PEOPLE_HERE_LIMIT),
    };
  }

  public async whatsNext(input: IWhatsNextInput): Promise<IWhatsNextOutput> {
    const attendee = this._lookup.attendee(input.attendeeId);
    const matches = await this._recommend.recommendTalks({ attendeeId: attendee.id, limit: toolDefaults.TALK_LIMIT });
    const relevant = matches.filter((match) => match.score > 0);
    const pool = relevant.length > 0 ? relevant : matches;
    const next = [...pool].sort((left, right) => TimeHelper.byStart(left.session, right.session))[0];

    if (!next) {
      return { session: null, startsInMinutes: null, walkMinutes: null };
    }

    return { session: next.session, startsInMinutes: next.startsInMinutes, walkMinutes: next.walkMinutes ?? null };
  }
}
