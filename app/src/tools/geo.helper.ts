import type { IGeoPoint } from '@kubequest/shared';
import { walking } from './tools.constants';

export class GeoHelper {
  public static haversineMeters(from: IGeoPoint, to: IGeoPoint): number {
    const earthRadiusMeters = 6371000;
    const fromLatitude = GeoHelper._toRadians(from.lat);
    const toLatitude = GeoHelper._toRadians(to.lat);
    const latitudeDelta = GeoHelper._toRadians(to.lat - from.lat);
    const longitudeDelta = GeoHelper._toRadians(to.lon - from.lon);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

    return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  }

  public static walkMinutes(meters: number, venueDiffers: boolean): number {
    const walkingMinutes = Math.ceil(meters / walking.METERS_PER_MINUTE);

    return venueDiffers ? walkingMinutes + walking.VENUE_SWITCH_MINUTES : walkingMinutes;
  }

  private static _toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
