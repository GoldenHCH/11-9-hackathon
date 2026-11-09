import { Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../shared/components/state-wrapper/state-wrapper.component';
import { conferenceDayOptions, fallbackConferenceDay, itineraryTimings, trackOptions } from './itinerary.constants';
import { ItineraryHelper } from './itinerary.helper';
import {
  IItinerary,
  IItineraryChangeResult,
  IPlanItem,
  IQuest,
  ISchedule,
  IScheduleSession,
  IScheduleSlot,
  ItineraryPane,
  Track,
} from './itinerary.types';
import { SessionCardComponent } from './session-card/session-card.component';

@Component({
  selector: 'app-itinerary',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    AlertBannerComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
    SessionCardComponent,
  ],
  templateUrl: './itinerary.component.html',
  styleUrl: './itinerary.component.scss',
})
export class ItineraryComponent implements OnInit, OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _route = inject(ActivatedRoute);
  private readonly _query$ = new Subject<string>();
  private readonly _subscriptions = new Subscription();

  private _scheduleRequest: Subscription | null = null;
  private _planRequest: Subscription | null = null;
  private _clockTimer: ReturnType<typeof setInterval> | null = null;
  private _clockOffsetMs = 0;
  private _shouldScrollToNow = true;

  public readonly days = conferenceDayOptions;
  public readonly tracks = trackOptions;
  public selectedDay: string = fallbackConferenceDay;
  public pane: ItineraryPane = 'schedule';
  public nowOnly = false;
  public track: Track | '' = '';
  public building = '';
  public query = '';

  public schedule: ISchedule | null = null;
  public isScheduleLoading = true;
  public scheduleError = '';
  public itinerary: IItinerary | null = null;
  public isPlanLoading = true;
  public planError = '';
  public actionError = '';
  public liveMessage = '';
  public nowMs = Date.now();
  public today = '';

  public plannedIds = new Set<string>();
  public busyIds = new Set<string>();
  public questBusyIds = new Set<string>();
  public questMadeIds = new Set<string>();

  public get attendeeId(): string {
    return this._meService.attendeeId ?? '';
  }

  public get slots(): IScheduleSlot[] {
    return this.schedule?.slots ?? [];
  }

  public get buildings(): string[] {
    return this.schedule?.buildings ?? ['Hyatt Regency', 'Salt Palace'];
  }

  public get isToday(): boolean {
    return this.selectedDay === this.today;
  }

  public get scheduleNowIndex(): number {
    return this.isToday ? ItineraryHelper.firstAfter(this.slots, this.nowMs) : -1;
  }

  public get planItems(): IPlanItem[] {
    return (this.itinerary?.items ?? []).filter((item) => item.kind !== 'talk' || !item.talkId || this.plannedIds.has(item.talkId));
  }

  public get planNowIndex(): number {
    return this.isToday ? ItineraryHelper.firstAfter(this.planItems, this.nowMs) : -1;
  }

  public get plannedCount(): number {
    return this.planItems.filter((item) => item.kind !== 'gap').length;
  }

  public get hasFilters(): boolean {
    return this.nowOnly || this.track !== '' || this.building !== '' || this.query.trim() !== '';
  }

  public get conflictCount(): number {
    return this.planItems.filter((item) => item.conflictsWith.length > 0).length;
  }

  public get nowLabel(): string {
    return ItineraryHelper.time(new Date(this.nowMs).toISOString());
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this._query$.pipe(debounceTime(itineraryTimings.SEARCH_DEBOUNCE_MS), distinctUntilChanged()).subscribe(() => this.loadSchedule()),
    );
    this._clockTimer = setInterval(() => this._tick(), itineraryTimings.CLOCK_TICK_MS);

    const requestedDay = this._route.snapshot.queryParamMap.get('day');

    if (requestedDay && this.days.some((option) => option.day === requestedDay)) {
      this.selectedDay = requestedDay;
      this.loadSchedule();
      this.loadPlan();

      return;
    }

    this.loadSchedule(true);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._scheduleRequest?.unsubscribe();
    this._planRequest?.unsubscribe();

    if (this._clockTimer) {
      clearInterval(this._clockTimer);
    }
  }

  public loadSchedule(pickDefaultDay = false): void {
    this._scheduleRequest?.unsubscribe();
    this.isScheduleLoading = true;
    this.scheduleError = '';
    this._scheduleRequest = this._toolsService.call<ISchedule>('list_schedule', this._scheduleInput(pickDefaultDay)).subscribe({
      next: (schedule) => {
        this._syncClock(schedule.now);

        if (pickDefaultDay) {
          this.selectedDay = schedule.day;
        }

        this.schedule = schedule;
        this.isScheduleLoading = false;
        this._mergePlanned(schedule);

        if (pickDefaultDay) {
          this.loadPlan();
        }

        this._scrollToNowSoon();
      },
      error: (error: unknown) => {
        console.error('list_schedule failed', error);
        this.isScheduleLoading = false;
        this.scheduleError = ApiErrorHelper.message(error);
      },
    });
  }

  public loadPlan(background = false): void {
    this._planRequest?.unsubscribe();

    if (!background) {
      this.isPlanLoading = true;
    }

    this.planError = '';
    this._planRequest = this._toolsService
      .call<IItinerary>('get_itinerary', { attendeeId: this.attendeeId, day: this.selectedDay }, { background })
      .subscribe({
        next: (itinerary) => {
          this._syncClock(itinerary.now);
          this.itinerary = itinerary;
          this.isPlanLoading = false;

          for (const item of itinerary.items) {
            if (item.kind === 'talk' && item.talkId && !this.busyIds.has(item.talkId)) {
              this.plannedIds.add(item.talkId);
            }

            if (item.questId && item.talkId) {
              this.questMadeIds.add(item.talkId);
            }
          }

          this._scrollToNowSoon();
        },
        error: (error: unknown) => {
          console.error('get_itinerary failed', error);
          this.isPlanLoading = false;
          this.planError = ApiErrorHelper.message(error);
        },
      });
  }

  public selectDay(day: string): void {
    if (day === this.selectedDay) {
      return;
    }

    this.selectedDay = day;
    this.nowOnly = false;
    this._shouldScrollToNow = true;
    this.loadSchedule();
    this.loadPlan();
  }

  public toggleNow(): void {
    this.nowOnly = !this.nowOnly;
    this.loadSchedule();
  }

  public onFilterChange(): void {
    this.loadSchedule();
  }

  public onQueryChange(value: string): void {
    this.query = value;
    this._query$.next(value.trim());
  }

  public clearFilters(): void {
    this.nowOnly = false;
    this.track = '';
    this.building = '';
    this.query = '';
    this._query$.next('');
    this.loadSchedule();
  }

  public showPane(pane: ItineraryPane): void {
    this.pane = pane;
    this._shouldScrollToNow = true;
    this._scrollToNowSoon();
  }

  public isPlanned(talkId: string): boolean {
    return this.plannedIds.has(talkId);
  }

  public isLive(session: IScheduleSession): boolean {
    return Date.parse(session.start) <= this.nowMs && this.nowMs < Date.parse(session.end);
  }

  public togglePlan(session: IScheduleSession): void {
    if (this.busyIds.has(session.id)) {
      return;
    }

    const wasPlanned = this.plannedIds.has(session.id);
    const toolName = wasPlanned ? 'remove_from_itinerary' : 'add_to_itinerary';
    this.busyIds.add(session.id);
    this.actionError = '';
    this._setPlanned(session.id, !wasPlanned);

    if (!wasPlanned) {
      this._insertProvisional(session);
    }

    this._toolsService
      .call<IItineraryChangeResult>(toolName, { attendeeId: this.attendeeId, talkId: session.id }, { background: true })
      .subscribe({
        next: (result) => {
          this.busyIds.delete(session.id);
          this._setPlanned(session.id, result.inItinerary);
          this.liveMessage = result.inItinerary ? `Added ${session.title} to your plan.` : `Removed ${session.title} from your plan.`;
          this.loadPlan(true);
        },
        error: (error: unknown) => {
          console.error(`${toolName} failed`, error);
          this.busyIds.delete(session.id);
          this._setPlanned(session.id, wasPlanned);
          this.actionError = ApiErrorHelper.message(error);
        },
      });
  }

  public removeItem(item: IPlanItem): void {
    if (item.session) {
      this.togglePlan(item.session);
    }
  }

  public makeQuest(session: IScheduleSession): void {
    if (this.questBusyIds.has(session.id)) {
      return;
    }

    this.questBusyIds.add(session.id);
    this.actionError = '';
    this._toolsService
      .call<IQuest>('make_quest', { attendeeId: this.attendeeId, targetKind: 'session', targetId: session.id }, { background: true })
      .subscribe({
        next: (quest) => {
          this.questBusyIds.delete(session.id);
          this.questMadeIds.add(session.id);
          this.liveMessage = `Quest made: ${quest.title}.`;
          this.loadPlan(true);
        },
        error: (error: unknown) => {
          console.error('make_quest failed', error);
          this.questBusyIds.delete(session.id);
          this.actionError = ApiErrorHelper.message(error);
        },
      });
  }

  public time(iso: string | undefined): string {
    return ItineraryHelper.time(iso);
  }

  public range(start: string, end: string | undefined): string {
    return ItineraryHelper.range(start, end);
  }

  public walkLabel(item: IPlanItem): string {
    const place = item.place;
    const where = place ? `${place.building} ${ItineraryHelper.shortLevel(place.level)}` : 'the next stop';

    return item.walkMinutes === 0 ? `Stay in ${place?.name ?? 'the room'}` : `${item.walkMinutes} min walk to ${where}`;
  }

  public placeLabel(item: IPlanItem): string {
    const place = item.place;

    return place ? `${place.name} · ${place.building} ${ItineraryHelper.shortLevel(place.level)}` : '';
  }

  public conflictLabel(item: IPlanItem): string {
    const titles = item.conflictsWith
      .map((conflictId) => this.planItems.find((other) => other.id === conflictId)?.title)
      .filter((title): title is string => title !== undefined);

    return titles.length > 0 ? `Overlaps with ${titles.join(', ')}` : '';
  }

  public kindIcon(item: IPlanItem): string {
    if (item.kind === 'meet') {
      return 'handshake';
    }

    return item.kind === 'quest' ? 'flag' : 'event';
  }

  private _scheduleInput(pickDefaultDay: boolean): Record<string, string> {
    const input: Record<string, string> = { attendeeId: this.attendeeId };

    if (!pickDefaultDay) {
      input['day'] = this.selectedDay;
    }

    if (this.nowOnly) {
      input['from'] = new Date(this.nowMs).toISOString();
      input['to'] = new Date(this.nowMs + itineraryTimings.NOW_WINDOW_MINUTES * 60000).toISOString();
    }

    if (this.track) {
      input['track'] = this.track;
    }

    if (this.building) {
      input['building'] = this.building;
    }

    if (this.query.trim() !== '') {
      input['query'] = this.query.trim();
    }

    return input;
  }

  private _mergePlanned(schedule: ISchedule): void {
    for (const slot of schedule.slots) {
      for (const session of slot.sessions) {
        if (this.busyIds.has(session.id)) {
          continue;
        }

        if (session.inItinerary) {
          this.plannedIds.add(session.id);
        } else {
          this.plannedIds.delete(session.id);
        }
      }
    }
  }

  private _insertProvisional(session: IScheduleSession): void {
    if (!this.itinerary || ItineraryHelper.dayOf(session.start) !== this.selectedDay) {
      return;
    }

    const id = `talk:${session.id}`;

    if (this.itinerary.items.some((item) => item.id === id)) {
      return;
    }

    const provisional: IPlanItem = {
      id,
      kind: 'talk',
      title: session.title,
      start: session.start,
      end: session.end,
      place: { locationId: session.locationId, name: session.room, kind: 'room', building: session.building, level: session.level },
      conflictsWith: [],
      talkId: session.id,
      session: { ...session, inItinerary: true },
    };
    const items = [...this.itinerary.items, provisional].sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
    this.itinerary = { ...this.itinerary, items };
  }

  private _setPlanned(talkId: string, planned: boolean): void {
    const next = new Set(this.plannedIds);

    if (planned) {
      next.add(talkId);
    } else {
      next.delete(talkId);
    }

    this.plannedIds = next;
  }

  private _syncClock(serverNowIso: string): void {
    this._clockOffsetMs = Date.parse(serverNowIso) - Date.now();
    this.nowMs = Date.now() + this._clockOffsetMs;
    this.today = ItineraryHelper.dayOf(serverNowIso);
  }

  private _tick(): void {
    this.nowMs = Date.now() + this._clockOffsetMs;
  }

  private _scrollToNowSoon(): void {
    if (!this._shouldScrollToNow) {
      return;
    }

    setTimeout(() => {
      const panes = this._host.nativeElement.querySelectorAll<HTMLElement>('.pane-scroll');
      let scrolled = false;

      for (const pane of Array.from(panes)) {
        const line = pane.querySelector<HTMLElement>('.now-line');

        if (!line || pane.offsetParent === null) {
          continue;
        }

        if (pane.scrollHeight > pane.clientHeight + 1) {
          pane.scrollTo({ top: Math.max(0, line.offsetTop - pane.clientHeight / 3), behavior: 'smooth' });
        } else if (!scrolled) {
          line.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }

        scrolled = true;
      }

      if (scrolled || !this.isToday) {
        this._shouldScrollToNow = false;
      }
    });
  }
}
