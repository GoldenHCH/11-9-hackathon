export const denverOffset = '-07:00';

export function withDenverOffset(localIso: string): string {
  return /([+-]\d{2}:\d{2}|Z)$/.test(localIso) ? localIso : `${localIso}${denverOffset}`;
}

export function toEpochMs(iso: string): number {
  return Date.parse(withDenverOffset(iso));
}

export function formatDenverIso(epochMs: number): string {
  const shifted = new Date(epochMs - 7 * 3600 * 1000).toISOString().slice(0, 19);

  return `${shifted}${denverOffset}`;
}

export function addMinutes(iso: string, minutes: number): string {
  return formatDenverIso(toEpochMs(iso) + minutes * 60 * 1000);
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return (toEpochMs(toIso) - toEpochMs(fromIso)) / 60000;
}
