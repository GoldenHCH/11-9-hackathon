import type { ILocation, ISession } from '../shared/src/index';
import type { IRoomSource } from './lib/data-scripts.interfaces';
import { offsetMeters } from './lib/geo.helper';
import { fixedLocations, saltPalaceCenter } from './lib/location-layout.constants';
import { placeRoom } from './lib/location-layout.helper';
import { readJsonFile, resourcePath, scriptDataPath, writeJsonFile } from './lib/resource-files.helper';

function main(): void {
  const sessions = readJsonFile<ISession[]>(resourcePath('sessions.json'));
  const roomSources = readJsonFile<IRoomSource[]>(scriptDataPath('rooms.source.json'));
  const usedLocationIds = new Set(sessions.map((session) => session.locationId));

  const roomLocations: ILocation[] = roomSources
    .filter((room) => usedLocationIds.has(room.locationId))
    .map((room) => ({
      id: room.locationId,
      name: room.name,
      kind: 'room',
      venue: room.venue,
      floor: room.floor,
      geo: placeRoom(room),
    }));

  const pointAndBoothLocations: ILocation[] = fixedLocations.map((fixed) => ({
    id: fixed.id,
    name: fixed.name,
    kind: fixed.kind,
    venue: fixed.venue,
    floor: fixed.floor,
    geo: offsetMeters(saltPalaceCenter, fixed.eastMeters, fixed.northMeters),
  }));

  const locations = [...roomLocations, ...pointAndBoothLocations];
  const knownIds = new Set(locations.map((location) => location.id));
  const missing = [...usedLocationIds].filter((locationId) => !knownIds.has(locationId));
  if (missing.length > 0) {
    throw new Error(`Sessions reference unknown locations: ${missing.join(', ')}`);
  }

  writeJsonFile(resourcePath('locations.json'), locations);
  console.log(
    `locations: ${locations.length} (${roomLocations.length} rooms, ${pointAndBoothLocations.length} meeting points and booths)`,
  );
}

main();
