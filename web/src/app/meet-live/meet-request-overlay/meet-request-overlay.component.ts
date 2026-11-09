import { A11yModule } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, Subscription, catchError, filter, finalize, interval, switchMap, timer } from 'rxjs';
import { IMeet, IRespondMeetResult, MeetResponse } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import {
  meetLiveChime,
  meetLiveCopy,
  meetLiveHiddenRoutePrefixes,
  meetLiveNoticeMs,
  meetLivePollMs,
  meetLiveRingRadius,
  meetLiveTickMs,
  meetLiveVibrationPattern,
  meetLiveWindowSeconds,
} from '../meet-live.constants';
import { IMeetRequest, IPendingMeetRequests } from '../meet-live.types';
import { LiveMeetService } from '../services/live-meet.service';

@Component({
  selector: 'app-meet-request-overlay',
  imports: [A11yModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, AlertBannerComponent, PixelFaceComponent],
  templateUrl: './meet-request-overlay.component.html',
  styleUrl: './meet-request-overlay.component.scss',
})
export class MeetRequestOverlayComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _liveMeetService = inject(LiveMeetService);
  private readonly _router = inject(Router);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _handledIds = new Set<string>();
  private _requestDeadline = 0;
  private _waitingDeadline = 0;
  private _hasInteracted = false;
  private _noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private _waitingSubscription: Subscription | null = null;

  public readonly ringRadius = meetLiveRingRadius;
  public readonly ringLength = 2 * Math.PI * meetLiveRingRadius;
  public request: IMeetRequest | null = null;
  public requestSeconds = 0;
  public isResponding = false;
  public respondError = '';
  public waiting: IMeet | null = null;
  public waitingSeconds = 0;
  public waitingLapsed = false;
  public notice = '';

  public get requestOffset(): number {
    return this._ringOffset(this.requestSeconds);
  }

  public get waitingOffset(): number {
    return this._ringOffset(this.waitingSeconds);
  }

  public ngOnInit(): void {
    this._pollRequests();
    this._watchWaiting();
    this._tick();
  }

  @HostListener('document:pointerdown')
  @HostListener('document:keydown')
  public onInteraction(): void {
    this._hasInteracted = true;
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (this.request && !this.isResponding) {
      this.respond('later');
    }
  }

  public respond(response: MeetResponse): void {
    const request = this.request;

    if (!request || this.isResponding) {
      return;
    }

    this.isResponding = true;
    this.respondError = '';
    this._toolsService
      .call<IRespondMeetResult>('respond_meet', { attendeeId: this._meService.attendeeId, meetId: request.meetId, response }, { background: true })
      .pipe(
        finalize(() => (this.isResponding = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => {
          this._handledIds.add(request.meetId);
          this.request = null;

          if (response === 'accept') {
            void this._router.navigate(['/intro', result.meet.id]);
          }
        },
        error: (error: unknown) => {
          console.error('Could not answer the meet request', error);

          if (response === 'accept') {
            this.respondError = ApiErrorHelper.message(error);

            return;
          }

          this._handledIds.add(request.meetId);
          this.request = null;
        },
      });
  }

  public closeWaiting(): void {
    this._liveMeetService.clear();
  }

  private _pollRequests(): void {
    timer(0, meetLivePollMs)
      .pipe(
        filter(() => this._shouldPoll()),
        switchMap(() =>
          this._toolsService
            .call<IPendingMeetRequests>('pending_meet_requests', { attendeeId: this._meService.attendeeId }, { background: true })
            .pipe(
              catchError((error: unknown) => {
                console.error('Meet request polling failed', error);

                return EMPTY;
              }),
            ),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((pending) => this._showNext(pending.requests));
  }

  private _shouldPoll(): boolean {
    const url = this._router.url;

    return (
      this._document.visibilityState === 'visible' &&
      !!this._meService.attendeeId &&
      !this.request &&
      !meetLiveHiddenRoutePrefixes.some((prefix) => url.startsWith(prefix))
    );
  }

  private _showNext(requests: IMeetRequest[]): void {
    if (this.request) {
      return;
    }

    const next = requests.find((candidate) => !this._handledIds.has(candidate.meetId) && candidate.secondsLeft > 0);

    if (!next) {
      return;
    }

    this.respondError = '';
    this.request = next;
    this._requestDeadline = Date.now() + next.secondsLeft * 1000;
    this.requestSeconds = next.secondsLeft;
    this._cue();
  }

  private _watchWaiting(): void {
    this._liveMeetService.waiting$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((meet) => {
      this._waitingSubscription?.unsubscribe();
      this._waitingSubscription = null;
      this.waiting = meet;
      this.waitingLapsed = false;

      if (!meet) {
        return;
      }

      this._waitingDeadline = Date.now() + (meet.secondsLeft ?? meetLiveWindowSeconds) * 1000;
      this.waitingSeconds = meet.secondsLeft ?? meetLiveWindowSeconds;
      this._waitingSubscription = timer(meetLivePollMs, meetLivePollMs)
        .pipe(
          filter(() => this._document.visibilityState === 'visible'),
          switchMap(() =>
            this._toolsService.call<IMeet[]>('list_meets', { attendeeId: this._meService.attendeeId }, { background: true }).pipe(
              catchError((error: unknown) => {
                console.error('Waiting for the meet failed', error);

                return EMPTY;
              }),
            ),
          ),
          takeUntilDestroyed(this._destroyRef),
        )
        .subscribe((meets) => this._updateWaiting(meets.find((candidate) => candidate.id === meet.id)));
    });
  }

  private _updateWaiting(meet: IMeet | undefined): void {
    if (!meet || !this.waiting) {
      return;
    }

    if (meet.status === 'accepted') {
      this._liveMeetService.clear();
      void this._router.navigate(['/intro', meet.id]);

      return;
    }

    if (meet.live && meet.secondsLeft !== undefined) {
      this._waitingDeadline = Date.now() + meet.secondsLeft * 1000;

      return;
    }

    this._lapseWaiting();
  }

  private _lapseWaiting(): void {
    this.waitingSeconds = 0;

    if (!this.waitingLapsed) {
      this.waitingLapsed = true;
      this._waitingSubscription?.unsubscribe();
      this._waitingSubscription = null;
    }
  }

  private _tick(): void {
    interval(meetLiveTickMs)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        const now = Date.now();

        if (this.request && !this.isResponding) {
          this.requestSeconds = Math.max(0, Math.ceil((this._requestDeadline - now) / 1000));

          if (this.requestSeconds === 0) {
            this._handledIds.add(this.request.meetId);
            this.request = null;
            this._showNotice(meetLiveCopy.SAVED);
          }
        }

        if (this.waiting && !this.waitingLapsed) {
          this.waitingSeconds = Math.max(0, Math.ceil((this._waitingDeadline - now) / 1000));

          if (this.waitingSeconds === 0) {
            this._lapseWaiting();
          }
        }
      });
  }

  private _showNotice(message: string): void {
    this.notice = message;

    if (this._noticeTimer) {
      clearTimeout(this._noticeTimer);
    }

    this._noticeTimer = setTimeout(() => (this.notice = ''), meetLiveNoticeMs);
  }

  private _ringOffset(seconds: number): number {
    return this.ringLength * (1 - Math.min(seconds, meetLiveWindowSeconds) / meetLiveWindowSeconds);
  }

  private _cue(): void {
    const view = this._document.defaultView;
    const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

    if (!this._hasInteracted || reducedMotion || !view) {
      return;
    }

    try {
      view.navigator.vibrate?.(meetLiveVibrationPattern);
      this._chime(view);
    } catch (error) {
      console.error('Could not play the meet request cue', error);
    }
  }

  private _chime(view: Window): void {
    if (typeof AudioContext === 'undefined' || !('AudioContext' in view)) {
      return;
    }

    const context = new AudioContext();
    const start = context.currentTime;

    [meetLiveChime.FIRST_HZ, meetLiveChime.SECOND_HZ].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * meetLiveChime.NOTE_SECONDS;
      const noteEnd = noteStart + meetLiveChime.NOTE_SECONDS;

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(meetLiveChime.PEAK_GAIN, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    });

    setTimeout(() => void context.close(), meetLiveChime.NOTE_SECONDS * 2 * 1000 + 200);
  }
}
