import { ILocation } from '../core/api.types';
import { IScheduleSession, ISchedule } from '../itinerary/itinerary.types';
import { DemoScanHelper } from './demo-scan.helper';
import { IVenueArea, IVenueSchematic } from './venue.interfaces';

export interface IRoomSessions {
  now: IScheduleSession | null;
  next: IScheduleSession | null;
}

export interface IRoomFocus {
  buildingId: string;
  levelId: string;
  areaId: string;
}

const maxTagLength = 22;

export class RoomSessionsHelper {
  public static byArea(schematic: IVenueSchematic, schedule: ISchedule): Map<string, IRoomSessions> {
    const nowMs = Date.parse(schedule.now);
    const sessions = schedule.slots.flatMap((slot) => slot.sessions);
    const result = new Map<string, IRoomSessions>();

    for (const building of schematic.buildings) {
      const buildingSessions = sessions.filter((session) => RoomSessionsHelper.sameBuilding(building.name, session.building));

      for (const level of building.levels) {
        for (const area of level.areas) {
          const matches = buildingSessions.filter((session) => RoomSessionsHelper.matchesArea(area, session));
          const entry = RoomSessionsHelper.pick(matches, nowMs);

          if (entry.now || entry.next) {
            result.set(area.id, entry);
          }
        }
      }
    }

    return result;
  }

  public static tag(entry: IRoomSessions): string {
    const session = entry.now ?? entry.next;

    if (!session) {
      return '';
    }

    const prefix = entry.now ? 'NOW' : RoomSessionsHelper.clock(session.start);
    const title = session.title.length > maxTagLength ? `${session.title.slice(0, maxTagLength - 1).trimEnd()}…` : session.title;

    return `${prefix} · ${title}`;
  }

  public static findFocus(schematic: IVenueSchematic, location: ILocation): IRoomFocus | null {
    for (const building of schematic.buildings) {
      if (location.building && !RoomSessionsHelper.sameBuilding(building.name, location.building)) {
        continue;
      }

      for (const level of building.levels) {
        const area = level.areas.find((candidate) => DemoScanHelper.forArea(candidate, [location]).length > 0);

        if (area) {
          return { buildingId: building.id, levelId: level.id, areaId: area.id };
        }
      }
    }

    for (const building of schematic.buildings) {
      if (!location.building || !RoomSessionsHelper.sameBuilding(building.name, location.building)) {
        continue;
      }

      const level = building.levels.find((candidate) => !!location.level && candidate.title.endsWith(`· ${location.level}`));

      if (level) {
        return { buildingId: building.id, levelId: level.id, areaId: '' };
      }
    }

    return null;
  }

  public static liveSessions(schedule: ISchedule): IScheduleSession[] {
    const nowMs = Date.parse(schedule.now);

    return schedule.slots
      .flatMap((slot) => slot.sessions)
      .filter((session) => Date.parse(session.start) <= nowMs && nowMs < Date.parse(session.end));
  }

  public static locationFromSession(session: IScheduleSession): ILocation {
    return {
      id: session.locationId,
      name: session.room,
      kind: 'room',
      building: session.building,
      level: session.level,
      room: session.room,
      geo: { lat: 0, lon: 0 },
    };
  }

  public static clock(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver' });
  }

  private static matchesArea(area: IVenueArea, session: IScheduleSession): boolean {
    return DemoScanHelper.forArea(area, [RoomSessionsHelper.locationFromSession(session)]).length > 0;
  }

  private static pick(sessions: IScheduleSession[], nowMs: number): IRoomSessions {
    const sorted = [...sessions].sort((first, second) => Date.parse(first.start) - Date.parse(second.start));
    const now = sorted.find((session) => Date.parse(session.start) <= nowMs && nowMs < Date.parse(session.end)) ?? null;
    const next = sorted.find((session) => Date.parse(session.start) > nowMs) ?? null;

    return { now, next };
  }

  private static sameBuilding(buildingName: string, sessionBuilding: string): boolean {
    const first = buildingName.toLowerCase();
    const second = sessionBuilding.toLowerCase();

    return second !== '' && (first.includes(second) || second.includes(first));
  }
}
