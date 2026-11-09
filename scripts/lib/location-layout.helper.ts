import type { IGeoPoint } from '../../shared/src/index';
import type { IRoomSource } from './data-scripts.interfaces';
import { floorOffsets, saltPalaceCenter, venueLayouts } from './location-layout.constants';
import { offsetMeters } from './geo.helper';
import { createPrng, hashString } from './prng.helper';

export function placeRoom(room: IRoomSource): IGeoPoint {
  const venueLayout = venueLayouts[room.venue] ?? venueLayouts['Off-Site'];
  const floorOffset = floorOffsets[room.floor] ?? floorOffsets['Level 1'];
  const prng = createPrng(hashString(room.locationId));
  const radius = venueLayout.spreadMeters * Math.sqrt(prng.next());
  const angle = 2 * Math.PI * prng.next();
  const eastMeters = venueLayout.eastMeters + floorOffset.eastMeters + radius * Math.cos(angle);
  const northMeters = venueLayout.northMeters + floorOffset.northMeters + radius * Math.sin(angle);

  return offsetMeters(saltPalaceCenter, eastMeters, northMeters);
}
