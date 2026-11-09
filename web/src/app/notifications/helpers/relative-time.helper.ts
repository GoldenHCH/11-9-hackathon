const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export class RelativeTimeHelper {
  public static since(iso: string, now: number = Date.now()): string {
    const elapsed = Math.max(0, now - Date.parse(iso));

    if (!Number.isFinite(elapsed) || elapsed < minuteMs) {
      return 'just now';
    }

    if (elapsed < hourMs) {
      return `${Math.floor(elapsed / minuteMs)} min ago`;
    }

    if (elapsed < dayMs) {
      return `${Math.floor(elapsed / hourMs)} h ago`;
    }

    return `${Math.floor(elapsed / dayMs)} d ago`;
  }
}
