import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, finalize, switchMap, takeWhile, timer } from 'rxjs';
import { IHandshake, IHandshakeStateResult } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';

const pollIntervalMs = 2000;
const maxAnswerLength = 60;

@Component({
  selector: 'app-handshake',
  imports: [
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
  templateUrl: './handshake.component.html',
  styleUrl: './handshake.component.scss',
})
export class HandshakeComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);
  private _pollSubscription: Subscription | null = null;

  @Input() public handshakeId = '';

  public readonly maxAnswerLength = maxAnswerLength;
  public handshake: IHandshake | null = null;
  public isLoading = true;
  public errorMessage = '';
  public answer = '';
  public isSubmitting = false;
  public submitError = '';

  public ngOnInit(): void {
    this.load();
  }

  public get isAsker(): boolean {
    return this.handshake?.role === 'asker';
  }

  public get canAnswer(): boolean {
    if (!this.handshake || this.handshake.status !== 'waiting') {
      return false;
    }

    return this.isAsker ? this.handshake.attemptsLeft > 0 && !this._askerWaitingOnPartner : !this.handshake.iAnswered;
  }

  public get partnerHandle(): string {
    return this.handshake ? `@${this.handshake.partner.handle}` : '';
  }

  public load(): void {
    this.isLoading = this.handshake === null;
    this.errorMessage = '';
    this._pollSubscription?.unsubscribe();
    this._pollSubscription = timer(0, pollIntervalMs)
      .pipe(
        switchMap(() =>
          this._toolsService.call<IHandshakeStateResult>(
            'handshake_state',
            { attendeeId: this._meService.attendeeId, handshakeId: this.handshakeId },
            { background: this.handshake !== null },
          ),
        ),
        takeWhile((result) => result.handshake?.status === 'waiting', true),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.isLoading = false;

          if (!result.handshake) {
            this.errorMessage = 'We couldn’t find that meeting. Ask them to show a fresh code.';

            return;
          }

          this.handshake = result.handshake;
        },
        error: (error: unknown) => {
          console.error('Handshake polling failed', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public submitAnswer(): void {
    const answer = this.answer.trim();

    if (!answer || this.isSubmitting || !this.handshake) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this._toolsService
      .call<IHandshake>('answer_handshake', {
        attendeeId: this._meService.attendeeId,
        handshakeId: this.handshake.id,
        answer,
      })
      .pipe(
        finalize(() => (this.isSubmitting = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (handshake) => {
          this.handshake = handshake;
          this.answer = '';

          if (handshake.status === 'waiting') {
            this.load();
          }
        },
        error: (error: unknown) => {
          console.error('Could not send the answer', error);
          this.submitError = ApiErrorHelper.message(error);
        },
      });
  }

  private get _askerWaitingOnPartner(): boolean {
    return this.isAsker && !!this.handshake?.iAnswered && !this.handshake.partnerAnswered;
  }
}
