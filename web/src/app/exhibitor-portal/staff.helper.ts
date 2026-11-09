import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Observable, defer, distinctUntilChanged, expand, fromEvent, map, startWith, switchMap, timer } from 'rxjs';
import { IToolErrorBody } from '../core/interfaces/exhibitor.interfaces';
import { badKeyErrorCode, maxPollBackoffMs, staffKeyQueryParam, staffTimeZone } from './staff.constants';
import { IStaffLink } from './staff.interfaces';

const hourFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: staffTimeZone });
const clockFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: staffTimeZone });

export class StaffHelper {
  public static visiblePoll(documentRef: Document, periodMs: number, fetchOnce: () => Observable<boolean>): Observable<boolean> {
    return fromEvent(documentRef, 'visibilitychange').pipe(
      startWith(null),
      map(() => documentRef.visibilityState === 'visible'),
      distinctUntilChanged(),
      switchMap((isVisible) => (isVisible ? StaffHelper._backoffLoop(periodMs, fetchOnce) : EMPTY)),
    );
  }

  public static isServerError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
  }

  public static badKeyMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
      return null;
    }

    const body: unknown = error.error;

    if (StaffHelper._isToolErrorBody(body) && body.error.code === badKeyErrorCode) {
      return body.error.message || 'This link is not valid anymore.';
    }

    return null;
  }

  public static errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && StaffHelper._isToolErrorBody(error.error)) {
      return error.error.error.message || fallback;
    }

    return fallback;
  }

  public static parseStaffLink(text: string, origin: string): IStaffLink | null {
    const trimmed = text.trim();

    if (!trimmed) {
      return null;
    }

    if (!/[/?=]/.test(trimmed)) {
      return { key: trimmed, outpostId: null };
    }

    let url: URL;

    try {
      url = new URL(trimmed, origin);
    } catch {
      return null;
    }

    const key = url.searchParams.get(staffKeyQueryParam);

    if (!key) {
      return null;
    }

    const match = /\/exhibitor\/([^/]+)/.exec(url.pathname);

    return { key, outpostId: match?.[1] ? decodeURIComponent(match[1]) : null };
  }

  public static appPath(url: string, origin: string): string | null {
    try {
      const parsed = new URL(url, origin);

      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return null;
    }
  }

  public static hourLabel(hour: string): string {
    if (/^\d{1,2}(:\d{2})?$/.test(hour)) {
      const hourOfDay = Number.parseInt(hour, 10) % 24;
      const displayHour = hourOfDay % 12 === 0 ? 12 : hourOfDay % 12;

      return `${displayHour} ${hourOfDay < 12 ? 'AM' : 'PM'}`;
    }

    const date = new Date(hour);

    return Number.isNaN(date.getTime()) ? hour : hourFormat.format(date);
  }

  public static clockTime(isoTime: string): string {
    const date = new Date(isoTime);

    return Number.isNaN(date.getTime()) ? '' : clockFormat.format(date);
  }

  public static timeAgo(isoTime: string, nowMs: number): string {
    const time = new Date(isoTime).getTime();

    if (Number.isNaN(time)) {
      return '';
    }

    const minutes = Math.floor((nowMs - time) / 60000);

    if (minutes < 1) {
      return 'just now';
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
  }

  private static _backoffLoop(periodMs: number, fetchOnce: () => Observable<boolean>): Observable<boolean> {
    return defer(() => {
      let delayMs = periodMs;

      return fetchOnce().pipe(
        expand((wasServerError) => {
          delayMs = wasServerError ? Math.min(delayMs * 2, Math.max(maxPollBackoffMs, periodMs)) : periodMs;

          return timer(delayMs).pipe(switchMap(() => fetchOnce()));
        }),
      );
    });
  }

  private static _isToolErrorBody(value: unknown): value is IToolErrorBody {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const inner: unknown = Reflect.get(value, 'error');

    return typeof inner === 'object' && inner !== null && typeof Reflect.get(inner, 'code') === 'string';
  }
}
