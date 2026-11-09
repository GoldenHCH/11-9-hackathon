import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, Input, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, catchError, filter, finalize, fromEvent, map, merge, of, switchMap, timer } from 'rxjs';
import { IConversation, IMessage } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { messageRules, messagesCopy, messagesNoticeStorageKey, messagesPolling } from '../messages.constants';
import { MessagesService } from '../services/messages.service';

@Component({
  selector: 'app-thread',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    AlertBannerComponent,
    PixelFaceComponent,
    StateWrapperComponent,
  ],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.scss',
})
export class ThreadComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _messagesService = inject(MessagesService);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);
  private _pollSubscription: Subscription | null = null;
  private _hasLoadedMessages = false;

  @ViewChild('messageList') private _messageList?: ElementRef<HTMLElement>;
  @ViewChild('composerInput') private _composerInput?: ElementRef<HTMLTextAreaElement>;

  @Input() public meetId = '';

  public readonly copy = messagesCopy;
  public readonly maxChars = messageRules.MAX_CHARS;
  public conversation: IConversation | null = null;
  public messages: IMessage[] = [];
  public isLoading = true;
  public errorMessage = '';
  public draft = '';
  public isSending = false;
  public sendError = '';
  public liveMessage = '';
  public showNotice = false;

  public ngOnInit(): void {
    this.showNotice = this._takeNotice();
    this.load();
  }

  public load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._messagesService
      .load()
      .pipe(
        map((inbox) => inbox.conversations.find((conversation) => conversation.meetId === this.meetId) ?? null),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (conversation) => {
          this.isLoading = false;

          if (!conversation) {
            this.errorMessage = messagesCopy.NOT_FOUND;

            return;
          }

          this.conversation = conversation;
          this._startPolling();
        },
        error: (error: unknown) => {
          console.error('Could not load the conversation', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return;
    }

    event.preventDefault();
    this.send();
  }

  public send(): void {
    const text = this.draft.trim();

    if (!text || !this.conversation || this.isSending) {
      return;
    }

    this.isSending = true;
    this.sendError = '';
    this._toolsService
      .call<IMessage>('send_message', { attendeeId: this._meService.attendeeId, meetId: this.meetId, text }, { background: true })
      .pipe(
        finalize(() => {
          this.isSending = false;
          setTimeout(() => this._composerInput?.nativeElement.focus());
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (message) => {
          this.draft = '';
          this._merge([message], true);
        },
        error: (error: unknown) => {
          console.error('Could not send the message', error);
          this.sendError = ApiErrorHelper.message(error);
        },
      });
  }

  public dismissNotice(): void {
    this.showNotice = false;
  }

  public isNewDay(index: number): boolean {
    if (index === 0) {
      return true;
    }

    return new Date(this.messages[index - 1].at).toDateString() !== new Date(this.messages[index].at).toDateString();
  }

  private _startPolling(): void {
    if (this._pollSubscription) {
      return;
    }

    const becameVisible = fromEvent(this._document, 'visibilitychange').pipe(filter(() => this._isVisible()));

    this._pollSubscription = merge(timer(0, messagesPolling.THREAD_MS), becameVisible)
      .pipe(
        filter(() => this._isVisible()),
        switchMap(() => {
          const since = this.messages.at(-1)?.at;

          return this._toolsService
            .call<IMessage[]>(
              'list_messages',
              { attendeeId: this._meService.attendeeId, meetId: this.meetId, ...(since ? { since } : {}) },
              { background: true },
            )
            .pipe(
              catchError((error: unknown) => {
                console.error('Could not refresh messages', error);

                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((messages) => {
        if (messages) {
          this._merge(messages, false);
        }
      });
  }

  private _merge(incoming: IMessage[], forceScroll: boolean): void {
    const known = new Set(this.messages.map((message) => message.id));
    const fresh = incoming.filter((message) => !known.has(message.id));
    const isFirstLoad = !this._hasLoadedMessages && !forceScroll;

    if (!forceScroll) {
      this._hasLoadedMessages = true;
    }

    if (fresh.length === 0) {
      if (isFirstLoad) {
        this._markRead();
      }

      return;
    }

    const shouldScroll = forceScroll || isFirstLoad || this._isNearBottom();
    this.messages = [...this.messages, ...fresh].sort((first, second) => Date.parse(first.at) - Date.parse(second.at));
    const fromPartner = fresh.filter((message) => !message.fromMe);

    if (!isFirstLoad && fromPartner.length > 0 && this.conversation) {
      const latest = fromPartner[fromPartner.length - 1];
      this.liveMessage = `New message from @${this.conversation.partner.handle}: ${latest.text}`;
    }

    if (isFirstLoad || fromPartner.length > 0) {
      this._markRead();
    }

    if (shouldScroll) {
      setTimeout(() => this._scrollToBottom());
    }
  }

  private _markRead(): void {
    this._messagesService.markRead(this.meetId).pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
  }

  private _isNearBottom(): boolean {
    const list = this._messageList?.nativeElement;

    if (!list) {
      return true;
    }

    return list.scrollHeight - list.scrollTop - list.clientHeight < messageRules.SCROLL_STICK_PX;
  }

  private _scrollToBottom(): void {
    const list = this._messageList?.nativeElement;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }

  private _isVisible(): boolean {
    return this._document.visibilityState !== 'hidden';
  }

  private _takeNotice(): boolean {
    try {
      if (localStorage.getItem(messagesNoticeStorageKey)) {
        return false;
      }

      localStorage.setItem(messagesNoticeStorageKey, new Date().toISOString());

      return true;
    } catch {
      return true;
    }
  }
}
