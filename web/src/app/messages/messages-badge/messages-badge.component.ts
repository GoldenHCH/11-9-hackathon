import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { messageRules } from '../messages.constants';
import { MessagesService } from '../services/messages.service';

@Component({
  selector: 'app-messages-badge',
  imports: [AsyncPipe],
  templateUrl: './messages-badge.component.html',
  styleUrl: './messages-badge.component.scss',
})
export class MessagesBadgeComponent implements OnInit {
  private readonly _messagesService = inject(MessagesService);

  public readonly unread$ = this._messagesService.unread$;

  public ngOnInit(): void {
    this._messagesService.start();
  }

  public badgeText(unread: number): string {
    return unread > messageRules.BADGE_MAX ? `${messageRules.BADGE_MAX}+` : String(unread);
  }
}
