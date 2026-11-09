import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { IAttendee, ILocation, ITalk, IXpEvent } from '../types/kubequest.interfaces';

const SESSION_GRACE_MS = 10 * 60 * 1000;
const REPEAT_WINDOW = 'now-1h';

async function getById<T>(index: string, id: string): Promise<T | undefined> {
  const response = await getEsClient().get<T>({ index, id }, { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] });

  return response.found ? response._source : undefined;
}

export async function findLocation(locationId: string): Promise<ILocation | undefined> {
  return getById<ILocation>(indexNames.LOCATIONS, locationId);
}

export async function findAttendee(attendeeId: string): Promise<IAttendee | undefined> {
  return getById<IAttendee>(indexNames.ATTENDEES, attendeeId);
}

export async function findRunningSession(locationId: string, now: Date): Promise<ITalk | undefined> {
  const response = await getEsClient().search<ITalk>(
    {
      index: indexNames.TALKS,
      size: 1,
      query: {
        bool: {
          filter: [
            { term: { locationId } },
            { range: { start: { lte: new Date(now.getTime() + SESSION_GRACE_MS).toISOString() } } },
            { range: { end: { gte: new Date(now.getTime() - SESSION_GRACE_MS).toISOString() } } },
          ],
        },
      },
      sort: [{ start: { order: 'desc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits[0]?._source;
}

export async function findRecentCheckIn(attendeeId: string, locationId: string): Promise<IXpEvent | undefined> {
  const response = await getEsClient().search<IXpEvent>(
    {
      index: indexNames.XP_EVENTS,
      size: 1,
      query: {
        bool: {
          filter: [
            { term: { attendeeId } },
            { term: { locationId } },
            { terms: { type: ['check_in', 'outpost'] } },
            { range: { at: { gte: REPEAT_WINDOW } } },
          ],
        },
      },
      sort: [{ at: { order: 'desc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.hits?.hits[0]?._source;
}

export async function countOutpostsToday(attendeeId: string, timeZone: string): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.XP_EVENTS,
      query: {
        bool: {
          filter: [{ term: { attendeeId } }, { term: { type: 'outpost' } }, { range: { at: { gte: 'now/d', time_zone: timeZone } } }],
        },
      },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

export async function recordLastLocation(attendeeId: string, location: ILocation, now: Date): Promise<void> {
  await getEsClient().update(
    {
      index: indexNames.ATTENDEES,
      id: attendeeId,
      doc: { lastLocationId: location.id, lastLocation: location.geo, lastSeenAt: now.toISOString() },
    },
    esOptions(esTimeouts.WRITE_MS),
  );
}
