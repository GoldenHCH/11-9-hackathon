import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, forkJoin, fromEvent, interval, merge, timer } from 'rxjs';
import { IGuideAnswer, IItineraryItem, IMeet, IPersonMatch, IRespondMeetResult, IWhatsAroundMe, IWhatsNext } from '../core/api.types';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { PeopleHelper } from '../people/people.helper';
import { PersonCardComponent } from '../people/person-card/person-card.component';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../shared/components/state-wrapper/state-wrapper.component';
import { guideMaxRetries, guideRetryMs, herePeopleLimit, herePollMs, minuteMs } from './here.constants';

@Component({
  selector: 'app-here',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    AlertBannerComponent,
    PersonCardComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './here.component.html',
  styleUrl: './here.component.scss',
})
export class HereComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  public around: IWhatsAroundMe | null = null;
  public nextTalk: IItineraryItem | null = null;
  public peopleHere: IPersonMatch[] = [];
  public meetsByPartner = new Map<string, IMeet>();
  public busyIds = new Set<string>();
  public isLoading = true;
  public errorMessage = '';
  public actionError = '';
  public guide: IGuideAnswer | null = null;
  public isAsking = false;
  public guideError = '';

  public get startsInMinutes(): number {
    return this.nextTalk ? Math.max(0, Math.round((new Date(this.nextTalk.start).getTime() - Date.now()) / minuteMs)) : 0;
  }

  public ngOnInit(): void {
    this.load();
    this.startPolling();
  }

  public load(background = false): void {
    const attendeeId = this._meService.attendeeId;
    const options = { background };

    if (!background) {
      this.isLoading = true;
      this.errorMessage = '';
    }

    forkJoin({
      around: this._toolsService.call<IWhatsAroundMe>('whats_around_me', { attendeeId }, options),
      next: this._toolsService.call<IWhatsNext>('whats_next', { attendeeId }, options),
      meets: this._toolsService.call<IMeet[]>('list_meets', { attendeeId }, options),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ around, next, meets }) => {
          this.around = around;
          this.peopleHere = (around.matchesHere ?? []).slice(0, herePeopleLimit);
          this.nextTalk = this.findNextTalk(next);
          this.meetsByPartner = PeopleHelper.meetsByPartner(meets);
          this.isLoading = false;
          this.errorMessage = '';
        },
        error: (error: unknown) => {
          console.error('Could not load what is here', error);
          if (!this.handleUnknownAttendee(error) && !background) {
            this.errorMessage = ApiErrorHelper.message(error);
          }
          this.isLoading = false;
        },
      });
  }

  public goToScan(): void {
    void this._router.navigate(['/scan']);
  }

  public propose(match: IPersonMatch): void {
    const partnerId = match.player.id;
    this.actionError = '';
    this.busyIds.add(partnerId);

    this._toolsService
      .call<IMeet>('propose_meet', { attendeeId: this._meService.attendeeId, partnerId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (meet) => {
          this.busyIds.delete(partnerId);
          this.meetsByPartner = new Map(this.meetsByPartner).set(partnerId, meet);
        },
        error: (error: unknown) => {
          console.error('Could not propose a meet', error);
          this.busyIds.delete(partnerId);
          this.actionError = ApiErrorHelper.message(error);
        },
      });
  }

  public accept(meet: IMeet): void {
    const partnerId = meet.partner.id;
    this.actionError = '';
    this.busyIds.add(partnerId);

    this._toolsService
      .call<IRespondMeetResult>('respond_meet', { attendeeId: this._meService.attendeeId, meetId: meet.id, response: 'accept' })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.busyIds.delete(partnerId);
          this.meetsByPartner = new Map(this.meetsByPartner).set(partnerId, result.meet);

          if (result.meet.status === 'accepted') {
            void this._router.navigate(['/intro', result.meet.id]);
          }
        },
        error: (error: unknown) => {
          console.error('Could not accept the meet', error);
          this.busyIds.delete(partnerId);
          this.actionError = ApiErrorHelper.message(error);
        },
      });
  }

  public askGuide(attempt = 0): void {
    this.isAsking = true;
    this.guideError = '';

    this._toolsService
      .call<IGuideAnswer>('ask_guide', { attendeeId: this._meService.attendeeId }, { background: attempt > 0 })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (answer) => {
          this.guide = answer;

          if (answer.pending && attempt < guideMaxRetries) {
            timer(guideRetryMs)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe(() => this.askGuide(attempt + 1));
            return;
          }

          this.isAsking = false;
        },
        error: (error: unknown) => {
          console.error('Could not ask the guide', error);
          this.guideError = ApiErrorHelper.message(error);
          this.isAsking = false;
        },
      });
  }

  private findNextTalk(next: IWhatsNext): IItineraryItem | null {
    const now = Date.now();

    return next.items.find((item) => item.kind === 'talk' && new Date(item.start).getTime() >= now) ?? null;
  }

  private startPolling(): void {
    const visible$ = fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible'));
    const tick$ = interval(herePollMs).pipe(filter(() => document.visibilityState === 'visible'));

    merge(visible$, tick$)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (!this.isLoading && this.busyIds.size === 0) {
          this.load(true);
        }
      });
  }

  private handleUnknownAttendee(error: unknown): boolean {
    const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
    const code =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'code' in body.error
        ? body.error.code
        : '';

    if (code !== 'unknown_attendee' && code !== 'attendee_not_found') {
      return false;
    }

    this._meService.clear();
    void this._router.navigate(['/onboarding']);
    return true;
  }
}
