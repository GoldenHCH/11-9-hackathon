import { expandSearchAlias, vendorTierOrder } from './venue.constants';
import { IVendor, IVenueAreaPlacement, IVenueLevelPlacement, IVenueSchematic } from './venue.interfaces';

export class VenueHelper {
  public static findArea(schematic: IVenueSchematic, areaId: string): IVenueAreaPlacement | null {
    for (const building of schematic.buildings) {
      for (const level of building.levels) {
        const area = level.areas.find((candidate) => candidate.id === areaId);

        if (area) {
          return { building, level, area };
        }
      }
    }

    return null;
  }

  public static findLevel(schematic: IVenueSchematic, levelId: string): IVenueLevelPlacement | null {
    for (const building of schematic.buildings) {
      const level = building.levels.find((candidate) => candidate.id === levelId);

      if (level) {
        return { building, level };
      }
    }

    return null;
  }

  public static searchVendors(vendors: IVendor[], query: string): IVendor[] {
    const queries = expandSearchAlias(query);
    const matches = queries[0]
      ? vendors.filter((vendor) =>
          queries.some(
            (normalizedQuery) =>
              vendor.name.toLowerCase().includes(normalizedQuery) ||
              vendor.booth.toLowerCase().startsWith(normalizedQuery) ||
              (vendor.zone ?? '').toLowerCase().includes(normalizedQuery) ||
              (vendor.categories ?? []).some((category) => category.toLowerCase().includes(normalizedQuery)),
          ),
        )
      : vendors;

    return [...matches].sort(VenueHelper.compareVendors);
  }

  public static vendorsInArea(vendors: IVendor[], areaId: string): IVendor[] {
    return vendors.filter((vendor) => vendor.areaId === areaId).sort(VenueHelper.compareVendors);
  }

  public static vendorsOnLevel(vendors: IVendor[], levelId: string): IVendor[] {
    return vendors.filter((vendor) => vendor.levelId === levelId && vendor.position);
  }

  private static compareVendors(first: IVendor, second: IVendor): number {
    const tierDifference = vendorTierOrder[first.tier] - vendorTierOrder[second.tier];

    if (tierDifference !== 0) {
      return tierDifference;
    }

    return first.name.localeCompare(second.name);
  }
}
