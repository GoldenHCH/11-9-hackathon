import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, catchError, filter, fromEvent, map, merge, of, switchMap, tap, timer } from 'rxjs';
import { IListConversationsResult, IMarkConversationReadResult } from '../../core/api.types';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { messagesPolling } from '../messages.constants';

const emptyInbox: IListConversationsResult = { conversations: [], unread: 0 };

@Injectable({ providedIn: 'root' })
export class MessagesService implements OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _document = inject(DOCUMENT);
  private readonly _inbox = new BehaviorSubject<IListConversationsResult>(emptyInbox);
  private readonly _refreshRequests = new Subject<void>();
  private _pollSubscription?: Subscription;

  public readonly inbox$: Observable<IListConversationsResult> = this._inbox.asObservable();
  public readonly unread$: Observable<number> = this._inbox.pipe(map((inbox) => inbox.unread));

  public start(): void {
    if (this._pollSubscription) {
      return;
    }

    const becameVisible = fromEvent(this._document, 'visibilitychange').pipe(filter(() => this.isVisible()));

    this._pollSubscription = merge(timer(0, messagesPolling.INBOX_MS), becameVisible, this._refreshRequests)
      .pipe(
        filter(() => this.isVisible() && this._meService.attendeeId !== null),
        switchMap(() =>
          this.fetch(true).pipe(
            catchError((error: unknown) => {
              console.error('Could not load conversations', error);

              return of(this._inbox.value);
            }),
          ),
        ),
      )
      .subscribe();
  }

  public refresh(): void {
    this._refreshRequests.next();
  }

  public load(): Observable<IListConversationsResult> {
    return this.fetch(false);
  }

  public markRead(meetId: string): Observable<IMarkConversationReadResult | null> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return of(null);
    }

    return this._toolsService.call<IMarkConversationReadResult>('mark_conversation_read', { attendeeId, meetId }, { background: true }).pipe(
      tap((result) => {
        const conversations = this._inbox.value.conversations.map((conversation) =>
          conversation.meetId === meetId ? { ...conversation, unread: 0 } : conversation,
        );
        this._inbox.next({ conversations, unread: result.unread });
      }),
      catchError((error: unknown) => {
        console.error('Could not mark the conversation read', error);

        return of(null);
      }),
    );
  }

  public ngOnDestroy(): void {
    this._pollSubscription?.unsubscribe();
  }

  private fetch(background: boolean): Observable<IListConversationsResult> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return of(emptyInbox);
    }

    return this._toolsService
      .call<IListConversationsResult>('list_conversations', { attendeeId }, { background })
      .pipe(tap((inbox) => this._inbox.next(inbox)));
  }

  private isVisible(): boolean {
    return this._document.visibilityState !== 'hidden';
  }
}
