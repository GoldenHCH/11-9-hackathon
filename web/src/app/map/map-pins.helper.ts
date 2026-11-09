import { ILocation } from '../core/api.types';
import { IQuest, IQuestPlace } from '../quests/quests.types';
import { DemoScanHelper } from './demo-scan.helper';
import { IMapPin, IMapPlace, IVenueArea, IVenuePoint, IVenueSchematic } from './venue.interfaces';

const outpostPrefix = 'outpost-';

export class MapPinsHelper {
  public static placeOf(schematic: IVenueSchematic, location: ILocation): IMapPlace | null {
    if (location.kind === 'outpost') {
      const vendor = schematic.vendors.find((candidate) => candidate.levelId && candidate.position && DemoScanHelper.forVendor(candidate, [location]).length > 0);

      if (vendor?.levelId && vendor.position) {
        const level = schematic.buildings.flatMap((building) => building.levels.map((entry) => ({ building, level: entry }))).find((entry) => entry.level.id === vendor.levelId);

        if (level) {
          return { buildingId: level.building.id, levelId: level.level.id, point: vendor.position, vendorId: vendor.id };
        }
      }
    }

    const candidates = schematic.buildings
      .filter((building) => MapPinsHelper.sameBuilding(building.name, location.building))
      .flatMap((building) =>
        building.levels
          .filter((level) => MapPinsHelper.levelNumber(level.label) === MapPinsHelper.levelNumber(location.level))
          .flatMap((level) => level.areas.filter((area) => DemoScanHelper.forArea(area, [location]).length > 0).map((area) => ({ building, level, area }))),
      );
    const match = candidates[0];

    if (!match) {
      return null;
    }

    return { buildingId: match.building.id, levelId: match.level.id, point: MapPinsHelper.areaCenter(match.area), areaId: match.area.id };
  }

  public static locationFor(locations: ILocation[], locationId: string, where?: IQuestPlace): ILocation | undefined {
    const known = locations.find((location) => location.id === locationId);

    if (known) {
      return known;
    }

    if (where) {
      return { id: locationId, name: where.name, kind: where.kind, building: where.building, level: where.level, room: where.name, geo: { lat: 0, lon: 0 } };
    }

    if (!locationId.startsWith(outpostPrefix)) {
      return undefined;
    }

    const slug = locationId.slice(outpostPrefix.length);

    return {
      id: locationId,
      name: slug.replace(/-/g, ' '),
      kind: 'outpost',
      building: 'Salt Palace',
      level: 'Level 1',
      geo: { lat: 0, lon: 0 },
    };
  }

  public static pins(schematic: IVenueSchematic, locations: ILocation[], hereId: string | null, quests: IQuest[]): IMapPin[] {
    const pins: IMapPin[] = [];
    const here = hereId ? MapPinsHelper.locationFor(locations, hereId) : undefined;
    const herePlace = here ? MapPinsHelper.placeOf(schematic, here) : null;

    if (here && herePlace) {
      const vendorName = herePlace.vendorId ? schematic.vendors.find((vendor) => vendor.id === herePlace.vendorId)?.name : undefined;
      pins.push({ ...herePlace, id: `you-${here.id}`, kind: 'you', label: 'You are here', locationId: here.id, title: vendorName ?? here.name });
    }

    quests.forEach((quest, index) => {
      const locationId = quest.where?.locationId ?? quest.locationId;
      const location = locationId ? MapPinsHelper.locationFor(locations, locationId, quest.where) : undefined;
      const place = location ? MapPinsHelper.placeOf(schematic, location) : null;

      if (location && place) {
        pins.push({ ...place, id: `quest-${quest.id}`, kind: 'quest', number: index + 1, label: `Quest ${index + 1}`, locationId: location.id, questId: quest.id, title: quest.title });
      }
    });

    return pins;
  }

  public static nearestQuest(pins: IMapPin[]): IMapPin | null {
    const you = pins.find((pin) => pin.kind === 'you');

    if (!you) {
      return null;
    }

    const sameLevel = pins.filter((pin) => pin.kind === 'quest' && pin.levelId === you.levelId);
    const distance = (pin: IMapPin): number => Math.hypot(pin.point.x - you.point.x, pin.point.y - you.point.y);

    return sameLevel.sort((first, second) => distance(first) - distance(second))[0] ?? null;
  }

  private static areaCenter(area: IVenueArea): IVenuePoint {
    return area.labelAt ?? { x: area.shape.x + area.shape.width / 2, y: area.shape.y + area.shape.height / 2 };
  }

  private static sameBuilding(schematicName: string, locationBuilding: string): boolean {
    return schematicName.toLowerCase().includes(locationBuilding.toLowerCase());
  }

  private static levelNumber(label: string): number {
    const match = /(\d+)/.exec(label);

    return match ? Number(match[1]) : -1;
  }
}
