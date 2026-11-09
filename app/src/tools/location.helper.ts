import type { ILocation } from '@kubequest/shared';

export class LocationHelper {
  public static withoutToken(location: ILocation): ILocation {
    const { token, ...publicLocation } = location;
    void token;

    return publicLocation;
  }
}
