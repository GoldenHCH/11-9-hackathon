import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, finalize, map, switchMap, timer } from 'rxjs';
import { IMeet, IMessage, IRespondMeetResult, MeetResponse } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { meetStatusLabels, messageMaxLength, messagePollIntervalMs } from '../meet.constants';

@Component({
  selector: 'app-meet-detail',
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
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './meet-detail.component.html',
  styleUrl: './meet-detail.component.scss',
})
export class MeetDetailComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);
  private _messageSubscription: Subscription | null = null;

  @Input() public introId = '';

  public readonly statusLabels = meetStatusLabels;
  public readonly messageMaxLength = messageMaxLength;
  public meet: IMeet | null = null;
  public messages: IMessage[] = [];
  public isLoading = true;
  public errorMessage = '';
  public draft = '';
  public isSending = false;
  public sendError = '';
  public isResponding = false;
  public respondError = '';

  public ngOnInit(): void {
    this.loadMeet();
  }

  public get canChat(): boolean {
    return this.meet?.status === 'accepted' || this.meet?.status === 'met';
  }

  public get needsMyAnswer(): boolean {
    return this.meet?.status === 'proposed' && !this.meet.iAccepted;
  }

  public loadMeet(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IMeet[]>('list_meets', { attendeeId: this._meService.attendeeId })
      .pipe(
        map((meets) => meets.find((meet) => meet.id === this.introId) ?? null),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (meet) => {
          this.isLoading = false;

          if (!meet) {
            this.errorMessage = 'We couldn’t find that meet. It may have expired.';

            return;
          }

          this._setMeet(meet);
        },
        error: (error: unknown) => {
          console.error('Could not load the meet', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public respond(response: MeetResponse): void {
    if (!this.meet || this.isResponding) {
      return;
    }

    this.isResponding = true;
    this.respondError = '';
    this._toolsService
      .call<IRespondMeetResult>('respond_meet', { attendeeId: this._meService.attendeeId, meetId: this.meet.id, response })
      .pipe(
        finalize(() => (this.isResponding = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => this._setMeet(result.meet),
        error: (error: unknown) => {
          console.error('Could not answer the meet', error);
          this.respondError = ApiErrorHelper.message(error);
        },
      });
  }

  public sendMessage(): void {
    const text = this.draft.trim();

    if (!text || !this.meet || this.isSending) {
      return;
    }

    this.isSending = true;
    this.sendError = '';
    this._toolsService
      .call<IMessage>('send_message', { attendeeId: this._meService.attendeeId, meetId: this.meet.id, text }, { background: true })
      .pipe(
        finalize(() => (this.isSending = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (message) => {
          this.draft = '';
          this.messages = [...this.messages.filter((existing) => existing.id !== message.id), message];
        },
        error: (error: unknown) => {
          console.error('Could not send the message', error);
          this.sendError = ApiErrorHelper.message(error);
        },
      });
  }

  private _setMeet(meet: IMeet): void {
    this.meet = meet;

    if (this.canChat && !this._messageSubscription) {
      this._pollMessages();
    }
  }

  private _pollMessages(): void {
    this._messageSubscription = timer(0, messagePollIntervalMs)
      .pipe(
        switchMap(() =>
          this._toolsService.call<IMessage[]>(
            'list_messages',
            { attendeeId: this._meService.attendeeId, meetId: this.introId },
            { background: true },
          ),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (messages) => (this.messages = messages),
        error: (error: unknown) => console.error('Message polling stopped', error),
      });
  }
}
