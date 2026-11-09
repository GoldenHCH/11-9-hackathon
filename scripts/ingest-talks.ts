import type { ISession } from '../shared/src/index';
import type { IRoomSource, IScheduleEvent } from './lib/data-scripts.interfaces';
import {
  kickoffFloor,
  kickoffRoom,
  kickoffTalks,
  kickoffUrl,
  kickoffVenue,
} from './lib/kickoff-talks.constants';
import { parseLocationName } from './lib/location-parse.helper';
import { resourcePath, scriptDataPath, writeJsonFile } from './lib/resource-files.helper';
import { classifyLevel, classifyTrack } from './lib/session-classification.helper';
import { slugify } from './lib/slug.helper';
import { htmlToPlainText } from './lib/text.helper';
import { toEpochMs, withDenverOffset } from './lib/time.helper';

const scheduleUrl =
  process.env.SCHEDULE_URL ??
  'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/';
const browserUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchScheduleHtml(): Promise<string> {
  const response = await fetch(scheduleUrl, {
    headers: { 'User-Agent': browserUserAgent, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Schedule page returned ${response.status} for ${scheduleUrl}`);
  }

  return response.text();
}

function extractSubEvents(html: string): IScheduleEvent[] {
  const blockPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const subEvents: IScheduleEvent[] = [];
  for (const match of html.matchAll(blockPattern)) {
    const parsed: unknown = JSON.parse(match[1]);
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes as IScheduleEvent[]) {
      if (Array.isArray(node.subEvent)) {
        subEvents.push(...node.subEvent);
      }
    }
  }

  return subEvents;
}

function sessionIdFromUrl(url: string): string {
  const scheduleId = new URL(url).searchParams.get('id');

  return scheduleId ? `talk-${scheduleId}` : `talk-${slugify(url)}`;
}

function speakerNames(event: IScheduleEvent): string[] {
  const performers = Array.isArray(event.performer) ? event.performer : event.performer ? [event.performer] : [];
  const names = performers
    .map((performer) => htmlToPlainText(performer.name))
    .filter((name) => name.length > 0);

  return [...new Set(names)];
}

function displayRoomName(room: string): string {
  return /^\d/.test(room) ? `Room ${room}` : room;
}

function mapEventToSession(event: IScheduleEvent, roomSources: Map<string, IRoomSource>): ISession {
  const title = htmlToPlainText(event.name);
  const abstract = htmlToPlainText(event.description);
  const parsedLocation = parseLocationName(event.location?.name ?? 'Off-Site Location');
  const locationId = slugify(`${parsedLocation.venue}-${parsedLocation.room}`);
  roomSources.set(locationId, {
    locationId,
    name: displayRoomName(parsedLocation.room),
    venue: parsedLocation.venue,
    floor: parsedLocation.floor,
  });

  return {
    id: sessionIdFromUrl(event.url ?? ''),
    title,
    abstract,
    speakers: speakerNames(event),
    start: withDenverOffset(event.startDate ?? ''),
    end: withDenverOffset(event.endDate ?? ''),
    venue: parsedLocation.venue,
    level: classifyLevel(title, abstract),
    track: classifyTrack(title),
    locationId,
    url: event.url ?? '',
    hasTranscript: false,
  };
}

function buildKickoffSessions(roomSources: Map<string, IRoomSource>): ISession[] {
  const locationId = slugify(`${kickoffVenue}-${kickoffRoom}`);
  roomSources.set(locationId, {
    locationId,
    name: kickoffRoom,
    venue: kickoffVenue,
    floor: kickoffFloor,
  });

  return kickoffTalks.map((talk) => ({
    id: talk.id,
    title: talk.title,
    abstract: talk.abstract,
    speakers: talk.speakers,
    start: withDenverOffset(talk.startLocal),
    end: withDenverOffset(talk.endLocal),
    venue: kickoffVenue,
    level: 1,
    track: talk.track,
    locationId,
    url: kickoffUrl,
    hasTranscript: false,
  }));
}

async function main(): Promise<void> {
  const html = await fetchScheduleHtml();
  const subEvents = extractSubEvents(html);
  if (subEvents.length === 0) {
    throw new Error('No subEvent entries found in the ld+json blocks; refusing to write an empty schedule');
  }

  const roomSources = new Map<string, IRoomSource>();
  const scheduleSessions = subEvents
    .filter((event) => event.name && event.startDate && event.endDate && event.url)
    .map((event) => mapEventToSession(event, roomSources));
  const allSessions = [...scheduleSessions, ...buildKickoffSessions(roomSources)].sort((first, second) => {
    const byStart = toEpochMs(first.start) - toEpochMs(second.start);

    return byStart !== 0 ? byStart : first.id.localeCompare(second.id);
  });

  const uniqueIds = new Set(allSessions.map((session) => session.id));
  if (uniqueIds.size !== allSessions.length) {
    throw new Error('Duplicate session ids after mapping');
  }

  const sortedRooms = [...roomSources.values()].sort((first, second) =>
    first.locationId.localeCompare(second.locationId),
  );
  writeJsonFile(resourcePath('sessions.json'), allSessions);
  writeJsonFile(scriptDataPath('rooms.source.json'), sortedRooms);

  const trackCounts: Record<string, number> = {};
  for (const session of allSessions) {
    trackCounts[session.track] = (trackCounts[session.track] ?? 0) + 1;
  }
  console.log(`sessions: ${allSessions.length} (${scheduleSessions.length} from the schedule, ${kickoffTalks.length} kickoff)`);
  console.log(`rooms: ${sortedRooms.length}`);
  console.log(`tracks: ${JSON.stringify(trackCounts)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
