import { ILocation } from '../core/api.types';
import { IVendor, IVenueArea } from './venue.interfaces';

export type DemoScanGroupId = 'rooms' | 'booths' | 'campfires';

export interface IDemoScanGroup {
  id: DemoScanGroupId;
  label: string;
  icon: string;
  locations: ILocation[];
}

const groupDisplay: { id: DemoScanGroupId; label: string; icon: string }[] = [
  { id: 'rooms', label: 'Rooms', icon: 'meeting_room' },
  { id: 'booths', label: 'Booths (outposts)', icon: 'storefront' },
  { id: 'campfires', label: 'Campfires', icon: 'local_fire_department' },
];

const minPrefixLength = 3;

export class DemoScanHelper {
  public static groupOf(location: ILocation): DemoScanGroupId {
    if (location.kind === 'outpost') {
      return 'booths';
    }

    return location.kind === 'campfire' ? 'campfires' : 'rooms';
  }

  public static groups(locations: ILocation[], query: string): IDemoScanGroup[] {
    const needle = DemoScanHelper.normalize(query);
    const matches = locations
      .filter((location) => needle === '' || DemoScanHelper.normalize(DemoScanHelper.searchText(location)).includes(needle))
      .sort((first, second) => first.name.localeCompare(second.name));

    return groupDisplay
      .map((group) => ({ ...group, locations: matches.filter((location) => DemoScanHelper.groupOf(location) === group.id) }))
      .filter((group) => group.locations.length > 0);
  }

  public static detail(location: ILocation): string {
    const booth = location.boothNumber ? `Booth ${location.boothNumber}` : '';

    return [location.building, location.level, booth || location.zone].filter(Boolean).join(' · ');
  }

  public static forArea(area: IVenueArea, locations: ILocation[]): ILocation[] {
    const areaNames = [area.name, area.shortLabel ?? '', ...(area.scheduleRooms ?? []).map((room) => room.split('|').pop() ?? '')]
      .map((name) => DemoScanHelper.normalize(name))
      .filter((name) => name !== '');

    return locations.filter((location) => {
      const locationNames = [location.room ?? '', location.name].map((name) => DemoScanHelper.normalize(name)).filter((name) => name !== '');

      return locationNames.some((locationName) =>
        areaNames.some(
          (areaName) => areaName === locationName || (locationName.length >= minPrefixLength && areaName.startsWith(locationName)),
        ),
      );
    });
  }

  public static forVendor(vendor: IVendor, locations: ILocation[]): ILocation[] {
    const vendorName = DemoScanHelper.normalize(vendor.name);

    return locations.filter(
      (location) =>
        location.kind === 'outpost' &&
        ((!!location.boothNumber && location.boothNumber === vendor.booth) || DemoScanHelper.normalize(location.name) === vendorName),
    );
  }

  private static searchText(location: ILocation): string {
    return [location.name, location.room, location.zone, location.boothNumber, location.level, location.building, location.id].join(' ');
  }

  private static normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]/g, '');
  }
}
