import type { IAttendee, IIntro, ILocation, ISeedMeta, ISession, IXpEvent } from '../shared/src/index';
import {
  badgeNameFromEventId,
  buildBadgeEvents,
  buildXpEventId,
  pickDemoSession,
  pickSeedNow,
  planCheckIns,
  planObservabilityNerdCheckIns,
} from './lib/activity-generator.helper';
import { buildPersonaAttendee, generateAttendees } from './lib/attendee-generator.helper';
import type { ICheckInPick } from './lib/data-scripts.interfaces';
import { buildIntros } from './lib/intro-generator.helper';
import { topMatches } from './lib/matching.helper';
import { frontendPersonaId, personaSpecs, platformPersonaId } from './lib/personas.constants';
import { createPrng, hashString } from './lib/prng.helper';
import { readJsonFile, resourcePath, writeJsonFile } from './lib/resource-files.helper';
import { isAttendableSession } from './lib/session-classification.helper';
import { formatDenverIso, toEpochMs } from './lib/time.helper';

const seedKey = 'kubequest-seed-v1';
const generatedAttendeeCount = 148;
const minuteMs = 60 * 1000;

function resolveSeedNow(sessions: ISession[]): string {
  const override = process.env.SEED_NOW;
  if (override) {
    const parsed = toEpochMs(override);
    if (Number.isNaN(parsed)) {
      throw new Error(`SEED_NOW is not a valid timestamp: ${override}`);
    }

    return formatDenverIso(parsed);
  }

  return pickSeedNow(sessions);
}

function main(): void {
  const sessions = readJsonFile<ISession[]>(resourcePath('sessions.json'));
  const locations = readJsonFile<ILocation[]>(resourcePath('locations.json'));
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const meetingPoints = locations.filter((location) => location.kind === 'meeting-point');
  const attendable = sessions.filter(isAttendableSession);

  const seedNow = resolveSeedNow(sessions);
  const nowMs = toEpochMs(seedNow);
  const prng = createPrng(hashString(seedKey));

  const generated = generateAttendees(prng, generatedAttendeeCount, seedNow);
  const personas = personaSpecs.map(buildPersonaAttendee);
  const attendees: IAttendee[] = [...personas, ...generated];

  const demoSession = pickDemoSession(attendable, nowMs);
  if (!demoSession) {
    throw new Error(`No session is running at ${seedNow}; pick a SEED_NOW that falls inside the schedule`);
  }

  const observabilityCandidates = generated.filter((attendee) =>
    attendee.profile.topics.some((topic) => ['opentelemetry', 'ebpf', 'incident-response'].includes(topic)),
  );
  const nerdIds = new Set(prng.shuffle(observabilityCandidates).slice(0, 6).map((attendee) => attendee.id));

  const roomLoad = new Map<string, number>();
  const picksByAttendee = new Map<string, ICheckInPick[]>();
  const checkInCounts = [0, 1, 2, 3, 4, 5, 6];
  const checkInWeights = [7, 14, 19, 21, 17, 12, 10];

  for (const attendee of attendees) {
    let picks: ICheckInPick[];
    if (attendee.id === platformPersonaId || attendee.id === frontendPersonaId) {
      const isPlatform = attendee.id === platformPersonaId;
      const atMs = Math.max(
        toEpochMs(demoSession.start) + minuteMs,
        nowMs - (isPlatform ? 9 : 5) * minuteMs,
      );
      picks = planCheckIns(prng, attendee, attendable, nowMs, roomLoad, {
        count: isPlatform ? 3 : 2,
        recent: true,
        forcedLatest: { session: demoSession, atMs },
      });
    } else if (nerdIds.has(attendee.id)) {
      picks = planObservabilityNerdCheckIns(prng, attendable, nowMs, prng.int(3, 4));
    } else {
      const count = prng.weightedPick(checkInCounts, checkInWeights);
      const recent = count > 0 && prng.chance(0.65);
      picks = planCheckIns(prng, attendee, attendable, nowMs, roomLoad, { count, recent });
    }
    picksByAttendee.set(attendee.id, picks);
  }

  const counters = new Map<string, number>();
  const xpEvents: IXpEvent[] = [];
  for (const attendee of attendees) {
    const picks = picksByAttendee.get(attendee.id) ?? [];
    const isPersona = attendee.id === platformPersonaId || attendee.id === frontendPersonaId;
    picks.forEach((pick, index) => {
      xpEvents.push({
        id: buildXpEventId(attendee.id, 'check-in', counters),
        attendeeId: attendee.id,
        type: 'check_in',
        xp: 10,
        talkId: pick.session.id,
        locationId: pick.session.locationId,
        at: pick.at,
      });
      const isLatest = index === picks.length - 1;
      const quizWanted = isPersona ? !isLatest && attendee.id === platformPersonaId : prng.chance(0.4);
      if (quizWanted) {
        const quizAtMs = Math.min(toEpochMs(pick.at) + prng.int(10, 28) * minuteMs, nowMs - minuteMs);
        if (quizAtMs > toEpochMs(pick.at)) {
          const correct = prng.weightedPick([1, 2, 3], [30, 40, 30]);
          xpEvents.push({
            id: buildXpEventId(attendee.id, 'quiz', counters),
            attendeeId: attendee.id,
            type: 'quiz',
            xp: correct * 5,
            talkId: pick.session.id,
            locationId: pick.session.locationId,
            at: formatDenverIso(quizAtMs),
          });
        }
      }
    });
  }

  const { intros, handshakeEvents } = buildIntros(
    prng,
    generated,
    picksByAttendee,
    meetingPoints,
    locationsById,
    nowMs,
    counters,
  );
  xpEvents.push(...handshakeEvents);

  const badgeEvents = buildBadgeEvents(attendees, xpEvents, intros, sessionsById);
  xpEvents.push(...badgeEvents);

  xpEvents.sort(
    (first, second) =>
      toEpochMs(first.at) - toEpochMs(second.at) ||
      first.attendeeId.localeCompare(second.attendeeId) ||
      first.id.localeCompare(second.id),
  );

  for (const attendee of attendees) {
    const ownEvents = xpEvents.filter((event) => event.attendeeId === attendee.id);
    attendee.xp = ownEvents.reduce((sum, event) => sum + event.xp, 0);
    attendee.badges = badgeEvents
      .filter((event) => event.attendeeId === attendee.id)
      .map((event) => badgeNameFromEventId(event.id));
    const picks = picksByAttendee.get(attendee.id) ?? [];
    const latest = picks[picks.length - 1];
    if (latest) {
      const location = locationsById.get(latest.session.locationId) as ILocation;
      attendee.lastLocation = location.geo;
      attendee.lastLocationId = location.id;
      attendee.lastSeenAt = latest.at;
    }
  }

  const seedMeta: ISeedMeta = {
    seedNow,
    demoPersonas: { platformEngineerId: platformPersonaId, firstTimerId: frontendPersonaId },
  };

  writeJsonFile(resourcePath('attendees.seed.json'), attendees);
  writeJsonFile(resourcePath('xp-events.seed.json'), xpEvents);
  writeJsonFile(resourcePath('intros.seed.json'), intros);
  writeJsonFile(resourcePath('seed-meta.json'), seedMeta);

  printSummary(attendees, xpEvents, intros, seedNow, nowMs, demoSession, locationsById);
}

function printSummary(
  attendees: IAttendee[],
  xpEvents: IXpEvent[],
  intros: IIntro[],
  seedNow: string,
  nowMs: number,
  demoSession: ISession,
  locationsById: Map<string, ILocation>,
): void {
  const recentCount = attendees.filter(
    (attendee) => attendee.lastSeenAt && nowMs - toEpochMs(attendee.lastSeenAt) <= 60 * minuteMs,
  ).length;
  const roomsNow = new Set(
    attendees
      .filter((attendee) => attendee.lastSeenAt && nowMs - toEpochMs(attendee.lastSeenAt) <= 60 * minuteMs)
      .map((attendee) => attendee.lastLocationId),
  );
  const statusCounts: Record<string, number> = {};
  for (const intro of intros) {
    statusCounts[intro.status] = (statusCounts[intro.status] ?? 0) + 1;
  }
  const badgeCounts: Record<string, number> = {};
  for (const attendee of attendees) {
    for (const badge of attendee.badges) {
      badgeCounts[badge] = (badgeCounts[badge] ?? 0) + 1;
    }
  }

  console.log(`seedNow: ${seedNow}`);
  console.log(`demo room: ${locationsById.get(demoSession.locationId)?.name} (${demoSession.locationId}) for "${demoSession.title}"`);
  console.log(`attendees: ${attendees.length}, xp events: ${xpEvents.length}, intros: ${intros.length}`);
  console.log(`checked in within the last hour: ${recentCount} (${Math.round((recentCount / attendees.length) * 100)}%) across ${roomsNow.size} rooms`);
  console.log(`intro statuses: ${JSON.stringify(statusCounts)}`);
  console.log(`badges: ${JSON.stringify(badgeCounts)}`);
  for (const personaId of [platformPersonaId, frontendPersonaId]) {
    const persona = attendees.find((attendee) => attendee.id === personaId) as IAttendee;
    const top = topMatches(persona, attendees, 3).map((match) => `${match.attendeeId}=${match.score}`);
    console.log(`top matches for ${personaId}: ${top.join(', ')}`);
  }
}

main();
