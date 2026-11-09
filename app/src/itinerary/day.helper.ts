import { appConfig } from '../config';
import { conferenceDays, defaultConferenceDay, itineraryRules } from './itinerary.constants';

const slotMs = itineraryRules.SLOT_MINUTES * 60000;

function zoneOffset(instantMs: number): string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: appConfig.conferenceTimeZone, timeZoneName: 'longOffset' });
  const zonePart = formatter.formatToParts(new Date(instantMs)).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = zonePart.replace('GMT', '');

  return offset === '' ? '+00:00' : offset;
}

export function conferenceDayOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appConfig.conferenceTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function defaultDayFor(now: Date): string {
  const today = conferenceDayOf(now);

  return (conferenceDays as readonly string[]).includes(today) ? today : defaultConferenceDay;
}

export function dayBounds(day: string): { start: string; end: string } {
  const noonMs = Date.parse(`${day}T12:00:00Z`);
  const startMs = Date.parse(`${day}T00:00:00${zoneOffset(noonMs)}`);
  const endMs = startMs + 24 * 3600000;

  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

export function slotStartOf(iso: string): string {
  const instantMs = Date.parse(iso);

  return new Date(Math.floor(instantMs / slotMs) * slotMs).toISOString();
}

export function slotEndOf(slotStart: string): string {
  return new Date(Date.parse(slotStart) + slotMs).toISOString();
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000);
}

export function overlaps(left: { start: string; end?: string }, right: { start: string; end?: string }): boolean {
  const leftStart = Date.parse(left.start);
  const rightStart = Date.parse(right.start);
  const leftEnd = left.end ? Date.parse(left.end) : leftStart;
  const rightEnd = right.end ? Date.parse(right.end) : rightStart;

  return leftStart < rightEnd && rightStart < leftEnd;
}
