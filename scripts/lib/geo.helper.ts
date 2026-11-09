import type { IGeoPoint } from '../../shared/src/index';

const earthRadiusMeters = 6371008.8;

export function offsetMeters(origin: IGeoPoint, eastMeters: number, northMeters: number): IGeoPoint {
  const latitudeDegrees = northMeters / 111320;
  const longitudeDegrees = eastMeters / (111320 * Math.cos((origin.lat * Math.PI) / 180));

  return {
    lat: Number((origin.lat + latitudeDegrees).toFixed(6)),
    lon: Number((origin.lon + longitudeDegrees).toFixed(6)),
  };
}

export function haversineMeters(from: IGeoPoint, to: IGeoPoint): number {
  const fromLatitude = (from.lat * Math.PI) / 180;
  const toLatitude = (to.lat * Math.PI) / 180;
  const deltaLatitude = toLatitude - fromLatitude;
  const deltaLongitude = ((to.lon - from.lon) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}
