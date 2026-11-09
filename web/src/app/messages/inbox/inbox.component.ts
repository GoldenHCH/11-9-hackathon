import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { IConversation } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { RelativeTimeHelper } from '../../notifications/helpers/relative-time.helper';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { messageRules, messagesCopy } from '../messages.constants';
import { MessagesService } from '../services/messages.service';

@Component({
  selector: 'app-inbox',
  imports: [FormsModule, RouterLink, MatFormFieldModule, MatIconModule, MatInputModule, PixelFaceComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent implements OnInit {
  private readonly _messagesService = inject(MessagesService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  public readonly copy = messagesCopy;
  public conversations: IConversation[] = [];
  public query = '';
  public isLoading = true;
  public errorMessage = '';

  public get filtered(): IConversation[] {
    const needle = this.query.trim().toLowerCase().replace(/^@/, '');

    if (!needle) {
      return this.conversations;
    }

    return this.conversations.filter(
      (conversation) =>
        conversation.partner.handle.toLowerCase().includes(needle) || (conversation.lastMessage?.text.toLowerCase().includes(needle) ?? false),
    );
  }

  public ngOnInit(): void {
    this._messagesService.inbox$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((inbox) => {
      if (!this.isLoading) {
        this.conversations = inbox.conversations;
      }
    });
    this.load();
  }

  public load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._messagesService
      .load()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (inbox) => {
          this.conversations = inbox.conversations;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load conversations', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public findPeople(): void {
    void this._router.navigateByUrl('/people');
  }

  public relativeTime(iso: string): string {
    return RelativeTimeHelper.since(iso);
  }

  public badgeText(unread: number): string {
    return unread > messageRules.BADGE_MAX ? `${messageRules.BADGE_MAX}+` : String(unread);
  }

  public rowLabel(conversation: IConversation): string {
    const unread = conversation.unread > 0 ? `, ${conversation.unread} unread` : '';
    const last = conversation.lastMessage
      ? `. ${conversation.lastMessage.fromMe ? 'You' : 'They'} wrote: ${conversation.lastMessage.text}`
      : '. No messages yet';

    return `@${conversation.partner.handle}${unread}${last}. ${this.relativeTime(conversation.lastActivityAt)}`;
  }
}
