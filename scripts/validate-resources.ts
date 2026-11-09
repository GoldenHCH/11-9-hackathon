import { existsSync, readdirSync } from 'node:fs';
import type {
  IAttendee,
  IIntro,
  ILocation,
  ISeedMeta,
  ISession,
  IXpEvent,
} from '../shared/src/index';
import { computeBadges } from './lib/badges.helper';
import { haversineMeters } from './lib/geo.helper';
import { isLogisticsTitle } from './lib/session-classification.helper';
import { topMatches } from './lib/matching.helper';
import { readJsonFile, resourcePath } from './lib/resource-files.helper';
import { toEpochMs } from './lib/time.helper';

const trackValues = ['ai', 'security', 'networking', 'observability', 'platform', 'storage', 'other'];
const locationKinds = ['room', 'meeting-point', 'booth'];
const seniorityValues = ['student', 'junior', 'mid', 'senior', 'staff', 'principal'];
const xpEventTypes = ['check_in', 'quiz', 'handshake', 'welcome', 'badge'];
const introStatuses = ['proposed', 'accepted', 'declined', 'met'];
const badgeLabels = ['Observability Nerd', 'Connector', 'Welcomer'];
const kickoffIds = ['cnh-kickoff-dash0', 'cnh-kickoff-sonar', 'cnh-kickoff-elastic', 'cnh-kickoff-radar'];
const minuteMs = 60 * 1000;

const errors: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) {
    errors.push(message);
  }
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isGeoPoint(value: unknown): boolean {
  const point = value as { lat?: unknown; lon?: unknown } | undefined;

  return (
    typeof point?.lat === 'number' &&
    typeof point?.lon === 'number' &&
    point.lat > -90 &&
    point.lat < 90 &&
    point.lon > -180 &&
    point.lon < 180
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateSessions(sessions: ISession[], locationsById: Map<string, ILocation>): void {
  check(sessions.length >= 280, `sessions: expected at least 280, found ${sessions.length}`);
  const ids = new Set<string>();
  let previousStart = 0;
  for (const session of sessions) {
    const label = `session ${session.id}`;
    check(isText(session.id) && !ids.has(session.id), `${label}: id missing or duplicated`);
    ids.add(session.id);
    check(isText(session.title), `${label}: title missing`);
    check(!isLogisticsTitle(session.title), `${label}: logistics entry "${session.title}" must not be in sessions`);
    check(typeof session.abstract === 'string', `${label}: abstract must be a string`);
    check(isStringArray(session.speakers), `${label}: speakers must be a string array`);
    check(isIsoTimestamp(session.start) && isIsoTimestamp(session.end), `${label}: start/end must be ISO with offset`);
    check(toEpochMs(session.start) < toEpochMs(session.end), `${label}: end must be after start`);
    check(toEpochMs(session.start) >= previousStart, `${label}: sessions must be sorted by start`);
    previousStart = toEpochMs(session.start);
    check(isText(session.venue), `${label}: venue missing`);
    check([1, 2, 3].includes(session.level), `${label}: level must be 1, 2 or 3`);
    check(trackValues.includes(session.track), `${label}: invalid track ${session.track}`);
    check(locationsById.get(session.locationId)?.kind === 'room', `${label}: locationId ${session.locationId} is not a room location`);
    check(isText(session.url), `${label}: url missing`);
    check(typeof session.hasTranscript === 'boolean', `${label}: hasTranscript must be boolean`);
  }
  for (const kickoffId of kickoffIds) {
    check(ids.has(kickoffId), `sessions: missing ${kickoffId}`);
  }
}

function validateLocations(locations: ILocation[]): void {
  const ids = new Set<string>();
  for (const location of locations) {
    const label = `location ${location.id}`;
    check(isText(location.id) && !ids.has(location.id), `${label}: id missing or duplicated`);
    ids.add(location.id);
    check(isText(location.name) && isText(location.venue) && isText(location.floor), `${label}: name/venue/floor missing`);
    check(locationKinds.includes(location.kind), `${label}: invalid kind`);
    check(isGeoPoint(location.geo), `${label}: invalid geo`);
    check(!('token' in location), `${label}: token must not be committed`);
  }
  check(locations.filter((location) => location.kind === 'meeting-point').length >= 4, 'locations: need at least 4 meeting points');
  check(locations.filter((location) => location.kind === 'booth').length >= 2, 'locations: need at least 2 booths');
  for (const requiredId of ['mp-salt-palace-coffee', 'mp-hyatt-l4-foyer', 'mp-hackathon-venue']) {
    check(ids.has(requiredId), `locations: missing ${requiredId}`);
  }

  const rooms = locations.filter((location) => location.kind === 'room');
  const saltPalaceRooms = rooms.filter((room) => room.venue === 'Salt Palace');
  const hyattRooms = rooms.filter((room) => room.venue === 'Hyatt Regency');
  let minimum = Infinity;
  let maximum = 0;
  for (const hyatt of hyattRooms) {
    for (const palace of saltPalaceRooms) {
      const distance = haversineMeters(hyatt.geo, palace.geo);
      minimum = Math.min(minimum, distance);
      maximum = Math.max(maximum, distance);
    }
  }
  check(minimum >= 600 && maximum <= 900, `locations: Hyatt to Salt Palace distance should be 600-900 m, got ${Math.round(minimum)}-${Math.round(maximum)} m`);
  const shop = locations.find((location) => location.id === 'mp-hackathon-venue');
  const coffee = locations.find((location) => location.id === 'mp-salt-palace-coffee');
  if (shop && coffee) {
    const shopDistance = haversineMeters(shop.geo, coffee.geo);
    check(shopDistance >= 1000 && shopDistance <= 2500, `locations: hackathon venue should be 1-2.5 km away, got ${Math.round(shopDistance)} m`);
  }
  console.log(`  Hyatt to Salt Palace room distance: ${Math.round(minimum)}-${Math.round(maximum)} m`);
}

function validateAttendees(attendees: IAttendee[], seedMeta: ISeedMeta, locationsById: Map<string, ILocation>): void {
  const ids = new Set<string>();
  const handles = new Set<string>();
  const names = new Set<string>();
  const seedNowMs = toEpochMs(seedMeta.seedNow);
  for (const attendee of attendees) {
    const label = `attendee ${attendee.id}`;
    check(isText(attendee.id) && !ids.has(attendee.id), `${label}: id missing or duplicated`);
    ids.add(attendee.id);
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(attendee.handle) && !handles.has(attendee.handle), `${label}: handle invalid or duplicated`);
    handles.add(attendee.handle);
    check(isText(attendee.name) && !names.has(attendee.name), `${label}: name missing or duplicated`);
    names.add(attendee.name);
    check(!('githubLogin' in attendee) && !('avatarUrl' in attendee), `${label}: seed attendees must not carry githubLogin/avatarUrl`);
    check(isText(attendee.headline), `${label}: headline missing`);
    check(isText(attendee.profileText) && attendee.profileText.length >= 120, `${label}: profileText too short`);
    check(!/lorem|ipsum|test test/i.test(attendee.profileText), `${label}: placeholder text`);
    const profile = attendee.profile;
    check(isStringArray(profile.topics) && profile.topics.length >= 2 && profile.topics.length <= 5, `${label}: topics must be 2-5 keywords`);
    check(seniorityValues.includes(profile.seniority), `${label}: invalid seniority`);
    check(isStringArray(profile.goals) && isStringArray(profile.offers) && isStringArray(profile.asks), `${label}: goals/offers/asks must be string arrays`);
    check(isStringArray(profile.languages) && profile.languages.includes('English'), `${label}: languages must include English`);
    check(typeof profile.firstTimer === 'boolean' && typeof profile.welcomer === 'boolean', `${label}: firstTimer/welcomer must be boolean`);
    check(!(profile.firstTimer && profile.welcomer), `${label}: cannot be both first-timer and welcomer`);
    check(typeof attendee.visible === 'boolean', `${label}: visible must be boolean`);
    check(isIsoTimestamp(attendee.createdAt) && toEpochMs(attendee.createdAt) < seedNowMs, `${label}: createdAt must be before seedNow`);
    check(Number.isInteger(attendee.xp) && attendee.xp >= 0, `${label}: xp must be a non-negative integer`);
    check(isStringArray(attendee.badges) && attendee.badges.every((badge) => badgeLabels.includes(badge)), `${label}: invalid badges`);
    if (attendee.lastLocationId) {
      const location = locationsById.get(attendee.lastLocationId);
      check(location !== undefined, `${label}: lastLocationId ${attendee.lastLocationId} unknown`);
      check(
        location !== undefined && attendee.lastLocation?.lat === location.geo.lat && attendee.lastLocation?.lon === location.geo.lon,
        `${label}: lastLocation must equal the location geo`,
      );
      check(isIsoTimestamp(attendee.lastSeenAt) && toEpochMs(attendee.lastSeenAt as string) <= seedNowMs, `${label}: lastSeenAt invalid`);
    } else {
      check(!attendee.lastLocation && !attendee.lastSeenAt, `${label}: lastLocation/lastSeenAt without lastLocationId`);
    }
  }
}

function validateXpEvents(
  xpEvents: IXpEvent[],
  attendees: IAttendee[],
  sessions: ISession[],
  locationsById: Map<string, ILocation>,
  intros: IIntro[],
  seedMeta: ISeedMeta,
): void {
  const attendeesById = new Map(attendees.map((attendee) => [attendee.id, attendee]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const introsById = new Map(intros.map((intro) => [intro.id, intro]));
  const seedNowMs = toEpochMs(seedMeta.seedNow);
  const ids = new Set<string>();
  const totals = new Map<string, number>();
  const checkInKeys = new Set<string>();

  for (const event of xpEvents) {
    const label = `xp event ${event.id}`;
    check(isText(event.id) && !ids.has(event.id), `${label}: id missing or duplicated`);
    ids.add(event.id);
    check(attendeesById.has(event.attendeeId), `${label}: unknown attendee ${event.attendeeId}`);
    check(xpEventTypes.includes(event.type), `${label}: invalid type`);
    check(Number.isInteger(event.xp) && event.xp > 0, `${label}: xp must be a positive integer`);
    check(isIsoTimestamp(event.at) && toEpochMs(event.at) <= seedNowMs, `${label}: at invalid or after seedNow`);
    if (event.locationId) {
      check(locationsById.has(event.locationId), `${label}: unknown locationId ${event.locationId}`);
    }
    if (event.talkId) {
      check(sessionsById.has(event.talkId), `${label}: unknown talkId ${event.talkId}`);
    }
    if (event.introId) {
      check(introsById.has(event.introId), `${label}: unknown introId ${event.introId}`);
    }
    totals.set(event.attendeeId, (totals.get(event.attendeeId) ?? 0) + event.xp);

    if (event.type === 'check_in') {
      const session = sessionsById.get(event.talkId ?? '');
      check(event.xp === 10 && session !== undefined && session.locationId === event.locationId, `${label}: check_in needs 10 xp and a talk at that location`);
      if (session) {
        const atMs = toEpochMs(event.at);
        check(atMs >= toEpochMs(session.start) && atMs <= toEpochMs(session.end), `${label}: check_in outside the session window`);
      }
      const key = `${event.attendeeId}:${event.locationId}`;
      check(!checkInKeys.has(key), `${label}: duplicate check-in at the same location`);
      checkInKeys.add(key);
    } else if (event.type === 'quiz') {
      check([5, 10, 15].includes(event.xp) && isText(event.talkId), `${label}: quiz needs 5/10/15 xp and a talkId`);
    } else if (event.type === 'handshake') {
      const intro = introsById.get(event.introId ?? '');
      check(event.xp === 50 && intro?.status === 'met', `${label}: handshake needs 50 xp and a met intro`);
    } else if (event.type === 'welcome') {
      const intro = introsById.get(event.introId ?? '');
      check(event.xp === 25 && intro?.status === 'met', `${label}: welcome needs 25 xp and a met intro`);
    } else if (event.type === 'badge') {
      check(event.xp === 20, `${label}: badge needs 20 xp`);
    }
  }

  for (const attendee of attendees) {
    const expected = totals.get(attendee.id) ?? 0;
    check(attendee.xp === expected, `attendee ${attendee.id}: xp ${attendee.xp} does not equal the event sum ${expected}`);

    const ownEvents = xpEvents.filter((event) => event.attendeeId === attendee.id);
    const checkIns = ownEvents
      .filter((event) => event.type === 'check_in')
      .map((event) => ({ track: sessionsById.get(event.talkId as string)?.track ?? 'other', at: event.at }));
    const handshakes = ownEvents
      .filter((event) => event.type === 'handshake')
      .map((event) => {
        const intro = introsById.get(event.introId as string) as IIntro;
        const counterpartId = intro.fromId === attendee.id ? intro.toId : intro.fromId;

        return { at: event.at, counterpartFirstTimer: attendeesById.get(counterpartId)?.profile.firstTimer ?? false };
      });
    const expectedBadges = computeBadges({ attendeeId: attendee.id, firstTimer: attendee.profile.firstTimer, checkIns, handshakes })
      .map((badge) => badge.name)
      .sort();
    check(
      JSON.stringify([...attendee.badges].sort()) === JSON.stringify(expectedBadges),
      `attendee ${attendee.id}: badges ${JSON.stringify(attendee.badges)} do not match the rules ${JSON.stringify(expectedBadges)}`,
    );
    const badgeEventCount = ownEvents.filter((event) => event.type === 'badge').length;
    check(badgeEventCount === attendee.badges.length, `attendee ${attendee.id}: one badge xp event per badge expected`);

    const latestCheckIn = checkIns.length > 0 ? ownEvents.filter((event) => event.type === 'check_in').slice(-1)[0] : undefined;
    if (latestCheckIn) {
      check(attendee.lastLocationId === latestCheckIn.locationId && attendee.lastSeenAt === latestCheckIn.at, `attendee ${attendee.id}: last location must match the latest check-in`);
    } else {
      check(attendee.lastLocationId === undefined, `attendee ${attendee.id}: lastLocationId without any check-in`);
    }
  }
}

function validateIntros(intros: IIntro[], attendees: IAttendee[], locationsById: Map<string, ILocation>, seedMeta: ISeedMeta): void {
  const attendeeIds = new Set(attendees.map((attendee) => attendee.id));
  const ids = new Set<string>();
  const personaIds = [seedMeta.demoPersonas.platformEngineerId, seedMeta.demoPersonas.firstTimerId];
  for (const intro of intros) {
    const label = `intro ${intro.id}`;
    check(isText(intro.id) && !ids.has(intro.id), `${label}: id missing or duplicated`);
    ids.add(intro.id);
    check(attendeeIds.has(intro.fromId) && attendeeIds.has(intro.toId) && intro.fromId !== intro.toId, `${label}: invalid participants`);
    check(introStatuses.includes(intro.status), `${label}: invalid status`);
    check(isIsoTimestamp(intro.proposedAt), `${label}: proposedAt invalid`);
    check(!(personaIds.includes(intro.fromId) && personaIds.includes(intro.toId)), `${label}: must not connect the two demo personas`);
    check(Array.isArray(intro.arrivals), `${label}: arrivals must be an array`);
    if (intro.status === 'accepted' || intro.status === 'met') {
      check(intro.slot !== undefined && isIsoTimestamp(intro.slot.start) && isIsoTimestamp(intro.slot.end), `${label}: slot required`);
      check(locationsById.get(intro.meetingPointId ?? '')?.kind === 'meeting-point', `${label}: meetingPointId must be a meeting point`);
      check(isText(intro.icebreaker), `${label}: icebreaker required`);
    }
    if (intro.status === 'met') {
      const arrivalTimes = intro.arrivals.map((arrival) => toEpochMs(arrival.at));
      const arrivalIds = intro.arrivals.map((arrival) => arrival.attendeeId).sort();
      check(JSON.stringify(arrivalIds) === JSON.stringify([intro.fromId, intro.toId].sort()), `${label}: met intro needs both arrivals`);
      check(arrivalTimes.length === 2 && Math.abs(arrivalTimes[0] - arrivalTimes[1]) <= 30 * minuteMs, `${label}: arrivals must be within 30 minutes`);
    } else {
      check(intro.arrivals.length === 0, `${label}: only met intros carry arrivals`);
    }
  }
  for (const status of introStatuses) {
    check(intros.some((intro) => intro.status === status), `intros: no intro with status ${status}`);
  }
}

function validatePersonas(attendees: IAttendee[], seedMeta: ISeedMeta): void {
  const platform = attendees.find((attendee) => attendee.id === seedMeta.demoPersonas.platformEngineerId);
  const frontend = attendees.find((attendee) => attendee.id === seedMeta.demoPersonas.firstTimerId);
  check(platform !== undefined && frontend !== undefined, 'seed-meta: persona ids do not exist in attendees');
  if (!platform || !frontend) {
    return;
  }
  check(platform.profile.welcomer && !platform.profile.firstTimer, 'persona platform engineer must be a welcomer');
  check(frontend.profile.firstTimer && !frontend.profile.welcomer, 'persona frontend developer must be a first-timer');
  check(platform.lastLocationId !== undefined && platform.lastLocationId === frontend.lastLocationId, 'personas must be checked in at the same room');
  check(toEpochMs(seedMeta.seedNow) - toEpochMs(platform.lastSeenAt as string) <= 60 * minuteMs, 'platform persona must be checked in within the last hour');
  for (const [source, expectedTopId] of [
    [platform, frontend.id],
    [frontend, platform.id],
  ] as [IAttendee, string][]) {
    const [first, second] = topMatches(source, attendees, 2);
    check(first.attendeeId === expectedTopId && first.score > second.score, `persona ${source.id}: top match must be ${expectedTopId} with a clear margin`);
    const top3 = topMatches(source, attendees, 3).map((match) => `${match.attendeeId} (score ${match.score}, shared: ${match.sharedTopics.join('+') || 'none'})`);
    console.log(`  top-3 for ${source.id}: ${top3.join('; ')}`);
  }
}

function validateDistribution(attendees: IAttendee[], seedMeta: ISeedMeta): void {
  const total = attendees.length;
  const firstTimerShare = attendees.filter((attendee) => attendee.profile.firstTimer).length / total;
  const welcomerShare = attendees.filter((attendee) => attendee.profile.welcomer).length / total;
  const visibleShare = attendees.filter((attendee) => attendee.visible).length / total;
  const recentShare =
    attendees.filter((attendee) => attendee.lastSeenAt && toEpochMs(seedMeta.seedNow) - toEpochMs(attendee.lastSeenAt) <= 60 * minuteMs).length / total;
  check(total >= 140 && total <= 160, `attendees: expected about 150, found ${total}`);
  check(firstTimerShare >= 0.15 && firstTimerShare <= 0.27, `first-timer share ${firstTimerShare.toFixed(2)} outside 0.15-0.27`);
  check(welcomerShare >= 0.1 && welcomerShare <= 0.2, `welcomer share ${welcomerShare.toFixed(2)} outside 0.10-0.20`);
  check(visibleShare >= 0.85 && visibleShare <= 0.95, `visible share ${visibleShare.toFixed(2)} outside 0.85-0.95`);
  check(recentShare >= 0.5 && recentShare <= 0.7, `recent check-in share ${recentShare.toFixed(2)} outside 0.50-0.70`);
  console.log(
    `  shares: first-timer ${(firstTimerShare * 100).toFixed(0)}%, welcomer ${(welcomerShare * 100).toFixed(0)}%, visible ${(visibleShare * 100).toFixed(0)}%, checked in last hour ${(recentShare * 100).toFixed(0)}%`,
  );
}

function validateTranscriptsFolder(): void {
  const folder = resourcePath('transcripts');
  check(existsSync(resourcePath('transcripts', 'README.md')), 'resources/transcripts/README.md is missing');
  const unexpected = existsSync(folder) ? readdirSync(folder).filter((name) => name !== 'README.md') : [];
  check(unexpected.length === 0, `resources/transcripts must hold no transcripts yet, found ${unexpected.join(', ')}`);
}

function main(): void {
  const sessions = readJsonFile<ISession[]>(resourcePath('sessions.json'));
  const locations = readJsonFile<ILocation[]>(resourcePath('locations.json'));
  const attendees = readJsonFile<IAttendee[]>(resourcePath('attendees.seed.json'));
  const xpEvents = readJsonFile<IXpEvent[]>(resourcePath('xp-events.seed.json'));
  const intros = readJsonFile<IIntro[]>(resourcePath('intros.seed.json'));
  const seedMeta = readJsonFile<ISeedMeta>(resourcePath('seed-meta.json'));
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  check(isIsoTimestamp(seedMeta.seedNow), 'seed-meta: seedNow must be ISO with offset');
  validateSessions(sessions, locationsById);
  validateLocations(locations);
  validateAttendees(attendees, seedMeta, locationsById);
  validateIntros(intros, attendees, locationsById, seedMeta);
  validateXpEvents(xpEvents, attendees, sessions, locationsById, intros, seedMeta);
  validatePersonas(attendees, seedMeta);
  validateDistribution(attendees, seedMeta);
  validateTranscriptsFolder();

  console.log('counts:');
  console.log(`  sessions ${sessions.length}, locations ${locations.length}, attendees ${attendees.length}, xp events ${xpEvents.length}, intros ${intros.length}`);
  console.log(`  seedNow ${seedMeta.seedNow}`);

  if (errors.length > 0) {
    console.error(`\nvalidation failed with ${errors.length} problem(s):`);
    for (const message of errors.slice(0, 60)) {
      console.error(`  - ${message}`);
    }
    process.exit(1);
  }
  console.log('validation passed');
}

main();
