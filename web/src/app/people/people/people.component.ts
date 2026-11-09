import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { filter, forkJoin, fromEvent, interval, merge } from 'rxjs';
import { IMeet, IPersonMatch, IProfile, IRespondMeetResult, MeetResponse } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { LiveMeetService } from '../../meet-live/services/live-meet.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { peopleLimit, peopleMeetPollMs } from '../people.constants';
import { PeopleHelper } from '../people.helper';
import { PersonCardComponent } from '../person-card/person-card.component';

@Component({
  selector: 'app-people',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    AlertBannerComponent,
    PersonCardComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _liveMeetService = inject(LiveMeetService);
  private readonly _destroyRef = inject(DestroyRef);

  public matches: IPersonMatch[] = [];
  public meets: IMeet[] = [];
  public meetsByPartner = new Map<string, IMeet>();
  public incoming: IMeet[] = [];
  public hereOnly = false;
  public meetingOn = true;
  public isLoading = true;
  public errorMessage = '';
  public actionError = '';
  public busyIds = new Set<string>();

  public get emptyMessage(): string {
    if (!this.meetingOn) {
      return 'Turn on meeting people in your profile to get matches.';
    }

    return this.hereOnly
      ? 'Nobody to match in this room right now. Turn off “Here now only” to see everyone.'
      : 'No matches yet. Check back after a few more players join.';
  }

  public ngOnInit(): void {
    this.load();
    this.startPolling();
  }

  public load(): void {
    const attendeeId = this._meService.attendeeId;
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      profile: this._toolsService.call<IProfile>('get_profile', { attendeeId }),
      matches: this._toolsService.call<IPersonMatch[]>('recommend_people', { attendeeId, limit: peopleLimit, hereOnly: this.hereOnly }),
      meets: this._toolsService.call<IMeet[]>('list_meets', { attendeeId }),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ profile, matches, meets }) => {
          this.meetingOn = profile.attendee.settings.meetingOn;
          this.matches = this.meetingOn ? matches : [];
          this.setMeets(meets);
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load people', error);
          if (!this.handleUnknownAttendee(error)) {
            this.errorMessage = ApiErrorHelper.message(error);
          }
          this.isLoading = false;
        },
      });
  }

  public onHereOnlyChange(change: MatSlideToggleChange): void {
    this.hereOnly = change.checked;
    this.load();
  }

  public goToProfile(): void {
    void this._router.navigate(['/profile']);
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
          this.setMeets([meet, ...this.meets.filter((existing) => existing.id !== meet.id)]);

          if (meet.status === 'accepted') {
            void this._router.navigate(['/intro', meet.id]);
          } else {
            this._liveMeetService.waitFor(meet);
          }
        },
        error: (error: unknown) => {
          console.error('Could not propose a meet', error);
          this.busyIds.delete(partnerId);
          this.actionError = ApiErrorHelper.message(error);
          this.refreshMeets();
        },
      });
  }

  public respond(meet: IMeet, response: MeetResponse): void {
    this.actionError = '';
    this.busyIds.add(meet.partner.id);

    this._toolsService
      .call<IRespondMeetResult>('respond_meet', { attendeeId: this._meService.attendeeId, meetId: meet.id, response })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.busyIds.delete(meet.partner.id);
          this.setMeets(this.meets.map((existing) => (existing.id === result.meet.id ? result.meet : existing)));

          if (response === 'accept' && result.meet.status === 'accepted') {
            void this._router.navigate(['/intro', result.meet.id]);
          }
        },
        error: (error: unknown) => {
          console.error('Could not answer the meet', error);
          this.busyIds.delete(meet.partner.id);
          this.actionError = ApiErrorHelper.message(error);
          this.refreshMeets();
        },
      });
  }

  private refreshMeets(): void {
    this._toolsService
      .call<IMeet[]>('list_meets', { attendeeId: this._meService.attendeeId }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (meets) => this.setMeets(meets),
        error: (error: unknown) => console.error('Could not refresh meets', error),
      });
  }

  private setMeets(meets: IMeet[]): void {
    this.meets = meets;
    this.meetsByPartner = PeopleHelper.meetsByPartner(meets);
    this.incoming = PeopleHelper.incomingOffers(meets, new Set(this.matches.map((match) => match.player.id)));
  }

  private startPolling(): void {
    const visible$ = fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible'));
    const tick$ = interval(peopleMeetPollMs).pipe(filter(() => document.visibilityState === 'visible'));

    merge(visible$, tick$)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (!this.isLoading && !this.errorMessage && this.busyIds.size === 0) {
          this.refreshMeets();
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
