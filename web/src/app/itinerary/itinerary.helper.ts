import { conferenceDayOptions, conferenceTimeZone, fallbackConferenceDay } from './itinerary.constants';

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: conferenceTimeZone });

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: conferenceTimeZone,
});

export class ItineraryHelper {
  public static time(iso: string | undefined): string {
    return iso ? timeFormatter.format(new Date(iso)) : '';
  }

  public static range(start: string, end: string | undefined): string {
    return end ? `${ItineraryHelper.time(start)} – ${ItineraryHelper.time(end)}` : ItineraryHelper.time(start);
  }

  public static dayOf(iso: string): string {
    return dayFormatter.format(new Date(iso));
  }

  public static defaultDay(nowIso: string): string {
    const today = ItineraryHelper.dayOf(nowIso);

    return conferenceDayOptions.some((option) => option.day === today) ? today : fallbackConferenceDay;
  }

  public static shortLevel(level: string): string {
    const match = /(\d+)/.exec(level);

    return match ? `L${match[1]}` : level;
  }

  public static firstAfter<T extends { start: string }>(items: T[], nowMs: number): number {
    const index = items.findIndex((item) => Date.parse(item.start) > nowMs);

    return index === -1 ? items.length : index;
  }
}
