import type { IAttendee, ILocation, IXpEvent } from '../app/src/types/kubequest.interfaces';
import { buildBoothSeed, stripBoothSeed } from './lib/booth-visits.helper';
import { readJsonFile, resourcePath, writeJsonFile } from './lib/resource-files.helper';

function main(): void {
  const locations = readJsonFile<ILocation[]>(resourcePath('locations.json'));
  const base = stripBoothSeed(
    readJsonFile<IAttendee[]>(resourcePath('attendees.seed.json')),
    readJsonFile<IXpEvent[]>(resourcePath('xp.seed.json')),
  );
  const seed = buildBoothSeed(base.attendees, base.xpEvents, locations);

  writeJsonFile(resourcePath('attendees.seed.json'), seed.attendees);
  writeJsonFile(resourcePath('xp.seed.json'), seed.xpEvents);

  const visitedBooths = new Set(seed.xpEvents.filter((event) => event.type === 'outpost').map((event) => event.locationId));
  console.log(
    `booth visits: ${seed.visits} by ${seed.attendees.length} attendees (${seed.generatedAttendees} generated), ${visitedBooths.size} booths visited`,
  );
}

main();
