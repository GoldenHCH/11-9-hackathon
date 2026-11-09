import { existsSync } from 'node:fs';
import {
  bannerIds,
  exhibitorTierOrder,
  exhibitorTypes,
  gameRules,
  locationKinds,
  materials,
  sessionTypes,
  tracks,
  xpEventTypes,
} from '../app/src/types/kubequest.constants';
import type { IAttendee, IGeoPoint, ILocation, ITalk, IXpEvent } from '../app/src/types/kubequest.interfaces';
import { buildingCenters, buildingNames } from '../app/src/world/locations';
import { boothVisitRules, handWrittenOutpostIds } from './lib/booth-visits.constants';
import { haversineMeters } from './lib/geo.helper';
import { readJsonFile, resourcePath } from './lib/resource-files.helper';

const minuteMs = 60 * 1000;
interface IVenueSponsorRow {
  booth: string | string[] | null;
}

const expectedSponsorBooths = readJsonFile<IVenueSponsorRow[]>(resourcePath('venue/sponsors.json')).filter(
  (row) => row.booth !== null && row.booth.length > 0,
).length;
const expectedProjectKiosks = new Set(
  readJsonFile<{ project: string }[]>(resourcePath('venue/project_pavilion_kiosks.json')).map((row) => row.project),
).size;
const maxBoothMetersFromCenter = 250;
const sessionLocationKinds = ['room', 'boss-room', 'theater'];

const errors: string[] = [];
const warnings: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) {
    errors.push(message);
  }
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function isGeoPoint(value: unknown): value is IGeoPoint {
  const point = value as { lat?: unknown; lon?: unknown } | undefined;

  return typeof point?.lat === 'number' && typeof point?.lon === 'number' && Math.abs(point.lat) < 90 && Math.abs(point.lon) < 180;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function includes(values: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && values.includes(value);
}

function validateOutpost(location: ILocation, label: string): void {
  check(includes(exhibitorTypes, location.exhibitorType), `${label}: exhibitorType must be one of ${exhibitorTypes.join(', ')}`);
  check(includes(exhibitorTierOrder, location.sponsorTier), `${label}: sponsorTier ${location.sponsorTier} is not in exhibitorTierOrder`);
  check(isText(location.boothNumber), `${label}: boothNumber missing`);
  check(isText(location.zone) && isText(location.hall), `${label}: zone/hall missing`);
  check(isText(location.askAbout) && isText(location.description), `${label}: askAbout/description missing`);
  check(
    isStringArray(location.topics) && location.topics.length > 0 && location.topics.every((topic) => includes(tracks, topic)),
    `${label}: topics must be track values`,
  );
  check(location.categories === undefined || isStringArray(location.categories), `${label}: categories must be a string array`);
  check(
    location.mapPosition === undefined || (typeof location.mapPosition.x === 'number' && typeof location.mapPosition.y === 'number'),
    `${label}: mapPosition must have numeric x and y`,
  );
  check(location.exhibitorType !== 'project' || isText(location.schedule), `${label}: project kiosks need a schedule`);
  check(location.exhibitorType !== 'sponsor' || location.mapPosition !== undefined, `${label}: sponsor booths need a mapPosition`);

  const center = buildingCenters[buildingNames.SALT_PALACE];
  const distance = haversineMeters(center, location.geo);
  check(distance <= maxBoothMetersFromCenter, `${label}: geo is ${Math.round(distance)} m from the Salt Palace center`);
}

function validateLocations(locations: ILocation[]): void {
  const ids = new Set<string>();

  for (const location of locations) {
    const label = `location ${location.id}`;
    check(isText(location.id) && !ids.has(location.id), `${label}: id missing or duplicated`);
    ids.add(location.id);
    check(isText(location.name) && isText(location.building) && isText(location.level), `${label}: name/building/level missing`);
    check(includes(locationKinds, location.kind), `${label}: invalid kind ${location.kind}`);
    check(isGeoPoint(location.geo), `${label}: invalid geo`);
    check(!('token' in location), `${label}: token must not be committed`);

    if (location.kind === 'outpost') {
      validateOutpost(location, label);
    }
  }

  const outposts = locations.filter((location) => location.kind === 'outpost');
  const sponsors = outposts.filter((location) => location.exhibitorType === 'sponsor').length;
  const projects = outposts.filter((location) => location.exhibitorType === 'project').length;
  check(sponsors === expectedSponsorBooths, `locations: expected ${expectedSponsorBooths} sponsor booths, found ${sponsors}`);
  check(projects === expectedProjectKiosks, `locations: expected ${expectedProjectKiosks} project kiosks, found ${projects}`);
  check(locations.filter((location) => location.kind === 'campfire').length >= 4, 'locations: need at least 4 campfires');
  check(locations.some((location) => location.kind === 'boss-room'), 'locations: need a boss room');

  for (const outpostId of handWrittenOutpostIds) {
    check(ids.has(outpostId), `locations: missing hand-written outpost ${outpostId}`);
  }

  console.log(`  outposts ${outposts.length} (${sponsors} sponsors, ${projects} projects)`);
}

function validateSessions(sessions: ITalk[], locationsById: Map<string, ILocation>): void {
  const ids = new Set<string>();

  for (const session of sessions) {
    const label = `session ${session.id}`;
    check(isText(session.id) && !ids.has(session.id), `${label}: id missing or duplicated`);
    ids.add(session.id);
    check(isText(session.title), `${label}: title missing`);
    check(isTimestamp(session.start) && isTimestamp(session.end) && Date.parse(session.start) < Date.parse(session.end), `${label}: start/end invalid`);
    check(includes(tracks, session.track), `${label}: invalid track ${session.track}`);
    check(includes(materials, session.material), `${label}: invalid material ${session.material}`);
    check(includes(sessionTypes, session.sessionType), `${label}: invalid sessionType ${session.sessionType}`);
    check(isStringArray(session.speakers), `${label}: speakers must be a string array`);
    check(includes(sessionLocationKinds, locationsById.get(session.locationId)?.kind), `${label}: locationId ${session.locationId} is not a room`);
  }
}

function validateAttendees(attendees: IAttendee[], locationsById: Map<string, ILocation>, anchorMs: number): void {
  const ids = new Set<string>();
  const handles = new Set<string>();

  for (const attendee of attendees) {
    const label = `attendee ${attendee.id}`;
    check(isText(attendee.id) && !ids.has(attendee.id), `${label}: id missing or duplicated`);
    ids.add(attendee.id);
    check(isText(attendee.handle) && !handles.has(attendee.handle), `${label}: handle missing or duplicated`);
    handles.add(attendee.handle);
    check(isText(attendee.faceSeed) && isText(attendee.workingOn) && isText(attendee.profileText), `${label}: faceSeed/workingOn/profileText missing`);
    check(!/lorem|ipsum|test test/i.test(attendee.profileText), `${label}: placeholder text`);
    check(isStringArray(attendee.profile?.topics) && attendee.profile.topics.length > 0, `${label}: profile.topics missing`);
    check(typeof attendee.profile?.firstTimer === 'boolean' && typeof attendee.profile?.welcomer === 'boolean', `${label}: firstTimer/welcomer must be boolean`);
    check(typeof attendee.settings?.meetingOn === 'boolean' && typeof attendee.settings?.locationOn === 'boolean', `${label}: settings incomplete`);
    check(typeof attendee.visible === 'boolean', `${label}: visible must be boolean`);
    check(isStringArray(attendee.banners) && attendee.banners.every((banner) => includes(bannerIds, banner)), `${label}: invalid banners`);
    check(isTimestamp(attendee.createdAt) && Date.parse(attendee.createdAt) < anchorMs, `${label}: createdAt must be before the seed anchor`);

    if (attendee.lastLocationId) {
      check(locationsById.has(attendee.lastLocationId), `${label}: lastLocationId ${attendee.lastLocationId} unknown`);
      check(isTimestamp(attendee.lastSeenAt) && Date.parse(attendee.lastSeenAt) <= anchorMs, `${label}: lastSeenAt invalid`);
    }
  }
}

function validateXpEvents(xpEvents: IXpEvent[], attendees: IAttendee[], locationsById: Map<string, ILocation>, anchorMs: number): void {
  const attendeeIds = new Set(attendees.map((attendee) => attendee.id));
  const ids = new Set<string>();
  const outpostVisits = new Map<string, number[]>();
  const outpostsPerAttendee = new Map<string, number>();

  for (const event of xpEvents) {
    const label = `xp event ${event.id}`;
    check(isText(event.id) && !ids.has(event.id), `${label}: id missing or duplicated`);
    ids.add(event.id);
    check(attendeeIds.has(event.attendeeId), `${label}: unknown attendee ${event.attendeeId}`);
    check(includes(xpEventTypes, event.type), `${label}: invalid type ${event.type}`);
    check(Number.isInteger(event.xp) && event.xp >= 0, `${label}: xp must be a non-negative integer`);
    check(isTimestamp(event.at) && Date.parse(event.at) <= anchorMs, `${label}: at invalid or after the seed anchor`);

    if (event.locationId) {
      check(locationsById.has(event.locationId), `${label}: unknown locationId ${event.locationId}`);
    }

    if (event.type !== 'outpost') {
      continue;
    }

    const location = locationsById.get(event.locationId ?? '');

    if (event.id.startsWith(boothVisitRules.EVENT_ID_PREFIX)) {
      check(location?.kind === 'outpost' && event.xp === boothVisitRules.OUTPOST_XP, `${label}: booth visits need an outpost location and ${boothVisitRules.OUTPOST_XP} xp`);
    } else if (location?.kind !== 'outpost') {
      warnings.push(`${label}: outpost event points at ${location?.kind ?? 'unknown'} ${event.locationId}`);
    }

    outpostsPerAttendee.set(event.attendeeId, (outpostsPerAttendee.get(event.attendeeId) ?? 0) + 1);
    const key = `${event.attendeeId}|${event.locationId}`;
    const previous = outpostVisits.get(key) ?? [];
    const atMs = Date.parse(event.at);
    check(previous.every((previousMs) => Math.abs(previousMs - atMs) >= gameRules.CHECK_IN_COOLDOWN_MINUTES * minuteMs), `${label}: second visit to the same booth within an hour`);
    outpostVisits.set(key, [...previous, atMs]);
  }

  for (const [attendeeId, count] of outpostsPerAttendee) {
    check(count <= gameRules.OUTPOSTS_PER_DAY, `attendee ${attendeeId}: ${count} outpost visits, the daily cap is ${gameRules.OUTPOSTS_PER_DAY}`);
  }

  for (const attendee of attendees) {
    const scoutEarned = (outpostsPerAttendee.get(attendee.id) ?? 0) >= gameRules.OUTPOSTS_PER_DAY;
    const hasScout = attendee.banners.includes(boothVisitRules.SCOUT_BANNER);
    check(!hasScout || scoutEarned, `attendee ${attendee.id}: scout banner without ${gameRules.OUTPOSTS_PER_DAY} booth visits`);
  }

  const boothVisits = xpEvents.filter((event) => event.id.startsWith(boothVisitRules.EVENT_ID_PREFIX) && event.type === 'outpost');
  const recentVisits = boothVisits.filter((event) => anchorMs - Date.parse(event.at) <= gameRules.BUSYNESS_WINDOW_MINUTES * minuteMs);
  check(boothVisits.length >= 200, `xp events: expected a few hundred seeded booth visits, found ${boothVisits.length}`);
  check(recentVisits.length >= 5, `xp events: expected a handful of booth visits in the last ${gameRules.BUSYNESS_WINDOW_MINUTES} minutes, found ${recentVisits.length}`);
  console.log(`  booth visits ${boothVisits.length}, in the last ${gameRules.BUSYNESS_WINDOW_MINUTES} minutes ${recentVisits.length}`);
}

function main(): void {
  const anchorMs = Date.parse(boothVisitRules.SEED_ANCHOR);
  const locations = readJsonFile<ILocation[]>(resourcePath('locations.json'));
  const sessions = readJsonFile<ITalk[]>(resourcePath('sessions.json'));
  const attendees = readJsonFile<IAttendee[]>(resourcePath('attendees.seed.json'));
  const xpEvents = readJsonFile<IXpEvent[]>(resourcePath('xp.seed.json'));
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  console.log('checks:');
  validateLocations(locations);
  validateSessions(sessions, locationsById);
  validateAttendees(attendees, locationsById, anchorMs);
  validateXpEvents(xpEvents, attendees, locationsById, anchorMs);
  check(existsSync(resourcePath('transcripts', 'README.md')), 'resources/transcripts/README.md is missing');

  console.log('counts:');
  console.log(`  sessions ${sessions.length}, locations ${locations.length}, attendees ${attendees.length}, xp events ${xpEvents.length}`);

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);

    for (const message of warnings.slice(0, 10)) {
      console.warn(`  - ${message}`);
    }
  }

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
