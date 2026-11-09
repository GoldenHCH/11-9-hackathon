import { appConfig } from '../config';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: appConfig.conferenceTimeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));

  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

export function startOfConferenceDay(now: Date): Date {
  const offset = zoneOffsetMs(now);
  const local = now.getTime() + offset;
  const localMidnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);

  return new Date(localMidnight - offset);
}

export function endOfConferenceDay(now: Date): Date {
  return new Date(startOfConferenceDay(now).getTime() + DAY_MS - 1000);
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * MINUTE_MS);
}

export function minutesUntil(now: Date, iso: string): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / MINUTE_MS);
}

export function isAfter(iso: string | undefined, other: Date): boolean {
  return iso !== undefined && new Date(iso).getTime() > other.getTime();
}
