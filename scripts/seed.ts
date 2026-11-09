import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { closeEsClient, esOptions, getEsClient } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { IndexName } from '../app/src/es/index-mappings';
import { levelDefinitionForXp } from '../app/src/xp/levels';

export type SeedDocument = Record<string, unknown> & { id: string };

export interface ISeedFile {
  file?: string;
  documents: SeedDocument[];
}

export interface IBulkResult {
  indexed: number;
  failed: number;
}

interface IGeo {
  lat: number;
  lon: number;
}

export const resourcesDir = path.resolve(__dirname, '..', 'resources');

const bulkChunkSize = 100;
const seedAnchorMs = Date.parse('2026-11-09T18:00:00.000Z');

export function isSeedDocument(value: unknown): value is SeedDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof Reflect.get(value, 'id') === 'string';
}

export function readSeedFile(names: string[]): ISeedFile {
  const file = names.map((name) => path.join(resourcesDir, name)).find((candidate) => existsSync(candidate));

  if (!file) {
    return { documents: [] };
  }

  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const rows: unknown[] = Array.isArray(parsed) ? parsed : [];

  return { file, documents: rows.filter(isSeedDocument) };
}

export async function bulkIndex(index: IndexName, documents: SeedDocument[]): Promise<IBulkResult> {
  let indexed = 0;
  let failed = 0;

  for (let start = 0; start < documents.length; start += bulkChunkSize) {
    const chunk = documents.slice(start, start + bulkChunkSize);
    const operations = chunk.flatMap((document) => [{ index: { _index: index, _id: document.id } }, document]);
    const response = await getEsClient().bulk({ operations, refresh: false }, esOptions(esTimeouts.INFERENCE_MS * 3));

    for (const item of response.items) {
      const result = item.index;

      if (result?.error) {
        failed += 1;
        console.error(`${index}/${result._id ?? '?'}: ${result.error.reason ?? result.error.type}`);
      } else {
        indexed += 1;
      }
    }
  }

  if (documents.length > 0) {
    await getEsClient().indices.refresh({ index }, esOptions(esTimeouts.ADMIN_MS));
  }

  return { indexed, failed };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isGeo(value: unknown): value is IGeo {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'lat') === 'number' && typeof Reflect.get(value, 'lon') === 'number';
}

function joinText(parts: string[]): string {
  return parts.map((part) => part.trim()).filter((part) => part !== '').join('\n');
}

export function prepareLocations(documents: SeedDocument[]): SeedDocument[] {
  return documents.map((location) => {
    if (stringValue(location.searchText) !== '') {
      return location;
    }

    const searchText = joinText([
      stringValue(location.name),
      stringValue(location.description),
      stringValue(location.askAbout),
      stringList(location.topics).join(', '),
    ]);

    return { ...location, searchText };
  });
}

function speakerNames(value: unknown): { names: string[]; details?: unknown[] } {
  if (!Array.isArray(value)) {
    return { names: [] };
  }

  const names = value
    .map((speaker: unknown) => (typeof speaker === 'string' ? speaker : stringValue(typeof speaker === 'object' && speaker !== null ? Reflect.get(speaker, 'name') : '')))
    .filter((name) => name !== '');
  const hasObjects = value.some((speaker: unknown) => typeof speaker === 'object' && speaker !== null);

  return hasObjects ? { names, details: value } : { names };
}

export function prepareTalks(documents: SeedDocument[], locations: SeedDocument[]): SeedDocument[] {
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  return documents.map((talk) => {
    const { names, details } = speakerNames(talk.speakers);
    const location = locationsById.get(stringValue(talk.locationId));
    const prepared: SeedDocument = { ...talk, speakers: names };

    if (details && talk.speakerDetails === undefined) {
      prepared.speakerDetails = details;
    }

    if (!isGeo(talk.geo) && location && isGeo(location.geo)) {
      prepared.geo = location.geo;
    }

    prepared.searchText = joinText([stringValue(talk.title), stringValue(talk.abstract), names.join(', ')]);

    return prepared;
  });
}

function seedShiftMs(): number {
  if (process.env.SEED_SHIFT === 'off') {
    return 0;
  }

  const pinned = process.env.SEED_NOW ? Date.parse(process.env.SEED_NOW) : Number.NaN;
  const target = Number.isNaN(pinned) ? Date.now() : pinned;

  return target - seedAnchorMs;
}

function shiftDate(value: unknown, shiftMs: number): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? value : new Date(parsed + shiftMs).toISOString();
}

function locationRemapper(seedIds: string[], locations: SeedDocument[]): (id: unknown) => SeedDocument | undefined {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const rooms = locations.filter((location) => location.kind === 'room' || location.kind === 'theater');
  const pool = rooms.length > 0 ? rooms : locations;
  const unknownIds = [...new Set(seedIds.filter((id) => !byId.has(id)))];

  if (unknownIds.length > 0 && locations.length > 0) {
    console.warn(`seed: unknown location ids remapped to rooms: ${unknownIds.join(', ')}`);
  }

  return (id: unknown) => {
    const key = stringValue(id);

    if (key === '') {
      return undefined;
    }

    const direct = byId.get(key);

    if (direct || pool.length === 0) {
      return direct;
    }

    return pool[unknownIds.indexOf(key) % pool.length];
  };
}

export function preparePlayers(
  attendees: SeedDocument[],
  xpEvents: SeedDocument[],
  locations: SeedDocument[],
): { attendees: SeedDocument[]; xpEvents: SeedDocument[] } {
  const shiftMs = seedShiftMs();
  const seedLocationIds = [...attendees, ...xpEvents].map((document) => stringValue(document.lastLocationId ?? document.locationId)).filter((id) => id !== '');
  const remap = locationRemapper(seedLocationIds, locations);
  const attendeeIds = new Set(attendees.map((attendee) => attendee.id));
  const xpByAttendee = new Map<string, number>();

  const preparedEvents = xpEvents
    .filter((event) => attendeeIds.has(stringValue(event.attendeeId)))
    .map((event) => {
      const prepared: SeedDocument = { ...event, at: shiftDate(event.at, shiftMs) };
      const location = remap(event.locationId);

      if (event.locationId !== undefined) {
        if (location) {
          prepared.locationId = location.id;
        } else if (locations.length > 0) {
          delete prepared.locationId;
        }
      }

      const attendeeId = stringValue(event.attendeeId);
      const xp = typeof event.xp === 'number' ? event.xp : 0;
      xpByAttendee.set(attendeeId, (xpByAttendee.get(attendeeId) ?? 0) + xp);

      return prepared;
    });

  const preparedAttendees = attendees.map((attendee) => {
    const xp = xpByAttendee.get(attendee.id) ?? (typeof attendee.xp === 'number' ? attendee.xp : 0);
    const prepared: SeedDocument = {
      ...attendee,
      xp,
      level: levelDefinitionForXp(xp).level,
      lastSeenAt: shiftDate(attendee.lastSeenAt, shiftMs),
      createdAt: shiftDate(attendee.createdAt, shiftMs),
    };
    const location = remap(attendee.lastLocationId);

    if (location) {
      prepared.lastLocationId = location.id;

      if (isGeo(location.geo)) {
        prepared.lastLocation = location.geo;
      }
    } else if (locations.length > 0) {
      delete prepared.lastLocationId;
    }

    return prepared;
  });

  return { attendees: preparedAttendees, xpEvents: preparedEvents };
}

export function loadLocations(): ISeedFile {
  const loaded = readSeedFile(['locations.json']);

  return { ...loaded, documents: prepareLocations(loaded.documents) };
}

export async function seedPlayers(locations: SeedDocument[]): Promise<{ attendees: IBulkResult; xpEvents: IBulkResult }> {
  const attendeeFile = readSeedFile(['attendees.seed.json', 'attendees.json']);
  const xpFile = readSeedFile(['xp.seed.json']);
  const prepared = preparePlayers(attendeeFile.documents, xpFile.documents, locations);

  const attendees = await bulkIndex(indexNames.ATTENDEES, prepared.attendees);
  console.log(`${indexNames.ATTENDEES}: indexed ${attendees.indexed}, failed ${attendees.failed} from ${path.basename(attendeeFile.file ?? 'none')}`);

  const xpEvents = await bulkIndex(indexNames.XP_EVENTS, prepared.xpEvents);
  console.log(`${indexNames.XP_EVENTS}: indexed ${xpEvents.indexed}, failed ${xpEvents.failed} from ${path.basename(xpFile.file ?? 'none')}`);

  return { attendees, xpEvents };
}

async function main(): Promise<void> {
  const { documents } = loadLocations();
  const result = await seedPlayers(documents);
  await closeEsClient();

  if (result.attendees.failed + result.xpEvents.failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
