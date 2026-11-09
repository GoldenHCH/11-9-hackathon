import type {
  IAttendee,
  IPersonMatch,
  IRecommendPeopleInput,
  IRecommendTalksInput,
  ISession,
  ITalkMatch,
} from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { GeoHelper } from './geo.helper';
import { LookupService } from './lookup.service';
import { MatchingHelper } from './matching.helper';
import { TimeHelper } from './time.helper';
import { toolDefaults } from './tools.constants';

export class RecommendService {
  private readonly _store: ResourceStoreService;
  private readonly _lookup: LookupService;

  public constructor(store: ResourceStoreService, lookup: LookupService) {
    this._store = store;
    this._lookup = lookup;
  }

  public async recommendTalks(input: IRecommendTalksInput): Promise<ITalkMatch[]> {
    const attendee = this._lookup.attendee(input.attendeeId);
    const now = this._store.now();
    const limit = input.limit ?? toolDefaults.TALK_LIMIT;
    const matches = this._store
      .getSessions()
      .filter((session) => TimeHelper.startsAtOrAfter(session, now))
      .filter((session) => !input.day || TimeHelper.dayOf(session.start) === input.day)
      .map((session): ITalkMatch => {
        const scored = MatchingHelper.scoreTalk(attendee.profile, session);

        return {
          session,
          score: scored.score,
          reasons: scored.reasons.length > 0 ? scored.reasons : ['Coming up soon'],
          startsInMinutes: TimeHelper.minutesUntil(now, session.start),
          walkMinutes: this.walkMinutesTo(attendee, session),
        };
      });

    return matches.sort((left, right) => right.score - left.score || TimeHelper.byStart(left.session, right.session)).slice(0, limit);
  }

  public async recommendPeople(input: IRecommendPeopleInput): Promise<IPersonMatch[]> {
    const viewer = this._lookup.attendee(input.attendeeId);
    const limit = input.limit ?? toolDefaults.PEOPLE_LIMIT;
    const candidates = this._store.getAttendees().filter((candidate) => candidate.id !== viewer.id && candidate.visible);
    const pool = input.hereOnly
      ? candidates.filter((candidate) => viewer.lastLocationId !== undefined && candidate.lastLocationId === viewer.lastLocationId)
      : candidates;

    return this.rankPeople(viewer, pool, limit);
  }

  public rankPeople(viewer: IAttendee, candidates: IAttendee[], limit: number): IPersonMatch[] {
    return candidates
      .map((candidate) => this._toPersonMatch(viewer, candidate))
      .sort((left, right) => right.score - left.score || right.attendee.xp - left.attendee.xp || left.attendee.handle.localeCompare(right.attendee.handle))
      .slice(0, limit);
  }

  public walkMinutesTo(attendee: IAttendee, session: ISession): number | undefined {
    const destination = this._store.getLocation(session.locationId);

    if (!attendee.lastLocation || !destination) {
      return undefined;
    }

    const originVenue = attendee.lastLocationId ? this._store.getLocation(attendee.lastLocationId)?.venue : undefined;
    const venueDiffers = originVenue !== undefined && originVenue !== session.venue;

    return GeoHelper.walkMinutes(GeoHelper.haversineMeters(attendee.lastLocation, destination.geo), venueDiffers);
  }

  private _toPersonMatch(viewer: IAttendee, candidate: IAttendee): IPersonMatch {
    const sameLocation = viewer.lastLocationId !== undefined && viewer.lastLocationId === candidate.lastLocationId;
    const scored = MatchingHelper.scorePerson(viewer, candidate, sameLocation);
    const distanceMeters =
      viewer.lastLocation && candidate.lastLocation
        ? Math.round(GeoHelper.haversineMeters(viewer.lastLocation, candidate.lastLocation))
        : undefined;

    return {
      attendee: MatchingHelper.toPublicAttendee(candidate),
      score: scored.score,
      reasons: scored.reasons,
      sharedTopics: scored.sharedTopics,
      isHere: sameLocation,
      locationId: candidate.lastLocationId,
      distanceMeters,
    };
  }
}
