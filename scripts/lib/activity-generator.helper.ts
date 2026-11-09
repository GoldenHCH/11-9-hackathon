import type { IAttendee, IIntro, ILocation, ISession, IXpEvent, TalkTrack } from '../../shared/src/index';
import { badgeNames, badgeXp, computeBadges } from './badges.helper';
import type { ICheckInPick, IPlanOptions } from './data-scripts.interfaces';
import { lookupTopic } from './attendee-generator.helper';
import { haversineMeters } from './geo.helper';
import type { IPrng } from './prng.interfaces';
import { isAttendableSession } from './session-classification.helper';
import { slugify } from './slug.helper';
import { addMinutes, formatDenverIso, toEpochMs } from './time.helper';

const minuteMs = 60 * 1000;

export function pickSeedNow(sessions: ISession[]): string {
  const attendable = sessions.filter(isAttendableSession);
  const dayStart = toEpochMs('2026-11-10T12:00:00');
  const dayEnd = toEpochMs('2026-11-10T17:00:00');
  const counts: { ms: number; count: number }[] = [];
  for (let ms = dayStart; ms <= dayEnd; ms += 5 * minuteMs) {
    const count = attendable.filter((session) => toEpochMs(session.start) <= ms && ms < toEpochMs(session.end)).length;
    counts.push({ ms, count });
  }

  const maximum = Math.max(...counts.map((entry) => entry.count));
  const firstIndex = counts.findIndex((entry) => entry.count === maximum);
  let lastIndex = firstIndex;
  while (lastIndex + 1 < counts.length && counts[lastIndex + 1].count === maximum) {
    lastIndex++;
  }
  const middle = counts[Math.floor((firstIndex + lastIndex) / 2)];

  return formatDenverIso(middle.ms);
}

function attendeeTracks(attendee: IAttendee): Set<TalkTrack> {
  return new Set(attendee.profile.topics.map((keyword) => lookupTopic(keyword).track));
}

function sessionsRunningAt(sessions: ISession[], atMs: number): ISession[] {
  return sessions.filter(
    (session) => toEpochMs(session.start) + minuteMs <= atMs && atMs <= toEpochMs(session.end) - 2 * minuteMs,
  );
}

function pickSession(prng: IPrng, candidates: ISession[], tracks: Set<TalkTrack>, roomLoad: Map<string, number>): ISession {
  const weights = candidates.map((session) => {
    const affinity = tracks.has(session.track) ? 3.5 : 1;

    return affinity / (1 + (roomLoad.get(session.locationId) ?? 0) * 0.4);
  });

  return prng.weightedPick(candidates, weights);
}

function randomTimeInSession(prng: IPrng, session: ISession, lowerBoundMs: number, upperBoundMs: number): number {
  const earliest = Math.max(toEpochMs(session.start) + minuteMs, lowerBoundMs);
  const latest = Math.min(toEpochMs(session.end) - 2 * minuteMs, upperBoundMs);
  if (latest < earliest) {
    return earliest;
  }

  return earliest + prng.int(0, Math.floor((latest - earliest) / minuteMs)) * minuteMs;
}

export function planCheckIns(
  prng: IPrng,
  attendee: IAttendee,
  attendable: ISession[],
  nowMs: number,
  roomLoad: Map<string, number>,
  options: IPlanOptions,
): ICheckInPick[] {
  if (options.count === 0) {
    return [];
  }

  const tracks = attendeeTracks(attendee);
  const picks: { session: ISession; atMs: number }[] = [];
  const usedLocations = new Set<string>();
  const runningNow = sessionsRunningAt(attendable, nowMs - 2 * minuteMs);

  if (options.forcedLatest) {
    picks.push(options.forcedLatest);
  } else if (options.recent) {
    const candidates = runningNow.filter((session) => !usedLocations.has(session.locationId));
    const session = pickSession(prng, candidates, tracks, roomLoad);
    picks.push({ session, atMs: randomTimeInSession(prng, session, nowMs - 55 * minuteMs, nowMs - 2 * minuteMs) });
  } else {
    for (let attempt = 0; attempt < 20 && picks.length === 0; attempt++) {
      const candidateMs = nowMs - prng.int(65, 360) * minuteMs;
      const running = sessionsRunningAt(attendable, candidateMs);
      if (running.length > 0) {
        picks.push({ session: pickSession(prng, running, tracks, roomLoad), atMs: candidateMs });
      }
    }
  }

  if (picks.length === 0) {
    return [];
  }
  usedLocations.add(picks[0].session.locationId);

  while (picks.length < options.count) {
    const earliestSoFar = Math.min(...picks.map((pick) => pick.atMs));
    let added = false;
    for (let attempt = 0; attempt < 10 && !added; attempt++) {
      const candidateMs = earliestSoFar - prng.int(35, 110) * minuteMs;
      const running = sessionsRunningAt(attendable, candidateMs).filter(
        (session) => !usedLocations.has(session.locationId),
      );
      if (running.length > 0) {
        const session = pickSession(prng, running, tracks, roomLoad);
        picks.push({ session, atMs: candidateMs });
        usedLocations.add(session.locationId);
        added = true;
      }
    }
    if (!added) {
      break;
    }
  }

  if (picks[0]) {
    roomLoad.set(picks[0].session.locationId, (roomLoad.get(picks[0].session.locationId) ?? 0) + 1);
  }

  return picks
    .sort((first, second) => first.atMs - second.atMs)
    .map((pick) => ({ session: pick.session, at: formatDenverIso(pick.atMs) }));
}

export function planObservabilityNerdCheckIns(
  prng: IPrng,
  attendable: ISession[],
  nowMs: number,
  targetCount: number,
): ICheckInPick[] {
  const observabilitySessions = attendable.filter(
    (session) => session.track === 'observability' && toEpochMs(session.start) <= nowMs - 10 * minuteMs,
  );

  for (let attempt = 0; attempt < 30; attempt++) {
    const picks: { session: ISession; atMs: number }[] = [];
    for (const session of prng.shuffle(observabilitySessions)) {
      if (picks.length >= targetCount) {
        break;
      }
      const atMs = randomTimeInSession(prng, session, 0, nowMs - 2 * minuteMs);
      const clashes = picks.some(
        (pick) => pick.session.locationId === session.locationId || Math.abs(pick.atMs - atMs) < 25 * minuteMs,
      );
      if (!clashes) {
        picks.push({ session, atMs });
      }
    }
    if (picks.length >= 3) {
      return picks
        .sort((first, second) => first.atMs - second.atMs)
        .map((pick) => ({ session: pick.session, at: formatDenverIso(pick.atMs) }));
    }
  }

  return [];
}

export function pickDemoSession(attendable: ISession[], nowMs: number): ISession {
  const runningNow = sessionsRunningAt(attendable, nowMs - 2 * minuteMs);
  const platformSessions = runningNow.filter((session) => session.track === 'platform');
  const preferred = platformSessions.filter(
    (session) => session.venue === 'Salt Palace' && /upgrade|platform|helm|cluster|gitops|operator|quota/i.test(session.title),
  );

  return preferred[0] ?? platformSessions[0] ?? runningNow[0];
}

export function overlapCount(first: IAttendee, second: IAttendee): number {
  const secondTopics = new Set(second.profile.topics);

  return first.profile.topics.filter((topic) => secondTopics.has(topic)).length;
}

export function bestOverlap(source: IAttendee, pool: IAttendee[], excludedIds: Set<string>): IAttendee {
  const candidates = pool.filter((candidate) => candidate.id !== source.id && !excludedIds.has(candidate.id));
  const ranked = [...candidates].sort(
    (first, second) => overlapCount(source, second) - overlapCount(source, first) || first.id.localeCompare(second.id),
  );

  return ranked[0];
}

export function nearestMeetingPoint(
  meetingPoints: ILocation[],
  firstGeo: ILocation['geo'] | undefined,
  secondGeo: ILocation['geo'] | undefined,
): ILocation {
  const anchors = [firstGeo, secondGeo].filter((geo): geo is ILocation['geo'] => geo !== undefined);
  const fallback = meetingPoints.find((point) => point.id === 'mp-salt-palace-coffee') ?? meetingPoints[0];
  if (anchors.length === 0) {
    return fallback;
  }
  const midpoint = {
    lat: anchors.reduce((sum, geo) => sum + geo.lat, 0) / anchors.length,
    lon: anchors.reduce((sum, geo) => sum + geo.lon, 0) / anchors.length,
  };

  return [...meetingPoints].sort(
    (first, second) => haversineMeters(midpoint, first.geo) - haversineMeters(midpoint, second.geo),
  )[0];
}

export function roundUpToQuarterHour(epochMs: number): number {
  const quarterMs = 15 * minuteMs;

  return Math.ceil(epochMs / quarterMs) * quarterMs;
}

export function buildXpEventId(attendeeId: string, suffix: string, counters: Map<string, number>): string {
  const key = `${attendeeId}:${suffix}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);

  return `xp-${suffix}-${attendeeId.replace('att-', '')}-${next}`;
}

export function buildBadgeEvents(
  attendees: IAttendee[],
  xpEvents: IXpEvent[],
  intros: IIntro[],
  sessionsById: Map<string, ISession>,
): IXpEvent[] {
  const attendeesById = new Map(attendees.map((attendee) => [attendee.id, attendee]));
  const badgeEvents: IXpEvent[] = [];

  for (const attendee of attendees) {
    const ownEvents = xpEvents.filter((event) => event.attendeeId === attendee.id);
    const checkIns = ownEvents
      .filter((event) => event.type === 'check_in' && event.talkId)
      .map((event) => ({ track: sessionsById.get(event.talkId as string)?.track ?? 'other', at: event.at }));
    const handshakes = ownEvents
      .filter((event) => event.type === 'handshake' && event.introId)
      .map((event) => {
        const intro = intros.find((candidate) => candidate.id === event.introId) as IIntro;
        const counterpartId = intro.fromId === attendee.id ? intro.toId : intro.fromId;

        return {
          at: event.at,
          counterpartFirstTimer: attendeesById.get(counterpartId)?.profile.firstTimer ?? false,
        };
      });

    const earned = computeBadges({
      attendeeId: attendee.id,
      firstTimer: attendee.profile.firstTimer,
      checkIns,
      handshakes,
    });
    for (const badge of earned) {
      badgeEvents.push({
        id: `xp-badge-${attendee.id.replace('att-', '')}-${slugify(badge.name)}`,
        attendeeId: attendee.id,
        type: 'badge',
        xp: badgeXp,
        at: addMinutes(badge.earnedAt, 1),
      });
    }
  }

  return badgeEvents;
}

export function badgeNameFromEventId(eventId: string): string {
  return Object.values(badgeNames).find((name) => eventId.endsWith(`-${slugify(name)}`)) ?? 'Unknown';
}
