import type { ISession } from '@kubequest/shared';

export class TimeHelper {
  public static minutesUntil(now: Date, isoTime: string): number {
    return Math.round((Date.parse(isoTime) - now.getTime()) / 60000);
  }

  public static isRunning(session: ISession, now: Date): boolean {
    const nowMillis = now.getTime();

    return Date.parse(session.start) <= nowMillis && nowMillis < Date.parse(session.end);
  }

  public static startsAtOrAfter(session: ISession, now: Date): boolean {
    return Date.parse(session.start) >= now.getTime();
  }

  public static dayOf(isoTime: string): string {
    return isoTime.slice(0, 10);
  }

  public static byStart(left: ISession, right: ISession): number {
    return Date.parse(left.start) - Date.parse(right.start);
  }
}
