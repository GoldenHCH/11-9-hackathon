import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, catchError, filter, fromEvent, map, merge, of, switchMap, timer } from 'rxjs';
import { IListNotificationsResult, IMarkNotificationsReadResult, INotification } from '../../core/api.types';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { notificationPolling } from '../notifications.constants';
import { INotificationSnapshot } from '../notifications.interfaces';

const emptyState: IListNotificationsResult = { items: [], unread: 0 };

@Injectable({ providedIn: 'root' })
export class NotificationsService implements OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _document = inject(DOCUMENT);
  private readonly _state = new BehaviorSubject<IListNotificationsResult>(emptyState);
  private readonly _arrivals = new Subject<INotification>();
  private readonly _refreshRequests = new Subject<void>();
  private readonly _seenIds = new Set<string>();
  private _baselineFor: string | null = null;
  private _pollSubscription?: Subscription;

  public readonly state$: Observable<IListNotificationsResult> = this._state.asObservable();
  public readonly arrivals$: Observable<INotification> = this._arrivals.asObservable();

  public start(): void {
    if (this._pollSubscription) {
      return;
    }

    const becameVisible = fromEvent(this._document, 'visibilitychange').pipe(filter(() => this.isVisible()));
    const ticks = merge(timer(0, notificationPolling.INTERVAL_MS), becameVisible, this._refreshRequests);

    this._pollSubscription = ticks
      .pipe(
        filter(() => this.isVisible()),
        switchMap(() => this.fetch()),
      )
      .subscribe((result) => this.apply(result));
  }

  public refresh(): void {
    this._refreshRequests.next();
  }

  public markRead(ids: string[]): Observable<IMarkNotificationsReadResult | null> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || ids.length === 0) {
      return of(null);
    }

    this.applyLocalRead((item) => ids.includes(item.id));

    return this.sendMarkRead({ attendeeId, ids });
  }

  public markAllRead(): Observable<IMarkNotificationsReadResult | null> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return of(null);
    }

    this.applyLocalRead(() => true);

    return this.sendMarkRead({ attendeeId, all: true });
  }

  public ngOnDestroy(): void {
    this._pollSubscription?.unsubscribe();
  }

  private sendMarkRead(input: object): Observable<IMarkNotificationsReadResult | null> {
    return this._toolsService.call<IMarkNotificationsReadResult>('mark_notifications_read', input, { background: true }).pipe(
      map((result) => {
        this._state.next({ ...this._state.value, unread: result.unread });

        return result;
      }),
      catchError((error: unknown) => {
        console.error('Could not mark notifications read', error);
        this.refresh();

        return of(null);
      }),
    );
  }

  private applyLocalRead(matches: (item: INotification) => boolean): void {
    const readAt = new Date().toISOString();
    const items = this._state.value.items.map((item) => (item.readAt === null && matches(item) ? { ...item, readAt } : item));

    this._state.next({ items, unread: items.filter((item) => item.readAt === null).length });
  }

  private fetch(): Observable<INotificationSnapshot> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return of({ attendeeId, result: emptyState });
    }

    return this._toolsService
      .call<IListNotificationsResult>('list_notifications', { attendeeId, limit: notificationPolling.LIST_LIMIT }, { background: true })
      .pipe(
        map((result) => ({ attendeeId, result })),
        catchError((error: unknown) => {
          console.error('Could not load notifications', error);

          return of({ attendeeId, result: this._state.value });
        }),
      );
  }

  private apply({ attendeeId, result }: INotificationSnapshot): void {
    if (attendeeId !== this._baselineFor) {
      this._seenIds.clear();
      result.items.forEach((item) => this._seenIds.add(item.id));
      this._baselineFor = attendeeId;
      this._state.next(result);

      return;
    }

    const fresh = result.items.filter((item) => !this._seenIds.has(item.id) && item.readAt === null);
    result.items.forEach((item) => this._seenIds.add(item.id));
    this._state.next(result);

    if (fresh.length > 0) {
      this._arrivals.next(fresh[0]);
    }
  }

  private isVisible(): boolean {
    return this._document.visibilityState !== 'hidden';
  }
}
