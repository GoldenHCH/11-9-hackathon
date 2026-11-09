import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Input, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { IExhibitorDetail, IExhibitorMe, IExhibitorPage } from '../../core/interfaces/exhibitor.interfaces';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { VenueService } from '../../map/services/venue.service';
import { StaffHelper } from '../../exhibitor-portal/staff.helper';
import { VenueHelper } from '../../map/venue.helper';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { BoothCardComponent } from '../booth-card/booth-card.component';
import { ExpoMiniMapComponent } from '../expo-mini-map/expo-mini-map.component';
import {
  exhibitorErrorCodes,
  exhibitorPageSettings,
  exhibitorTypeSingularLabels,
  questStatusLabels,
  staleAttendeeMessage,
} from '../exhibitors.constants';
import { ExhibitorsHelper } from '../exhibitors.helper';
import { IMadeQuest, IMakeOutpostQuestInput, IMiniMap } from '../exhibitors.interfaces';

@Component({
  selector: 'app-exhibitor-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    AlertBannerComponent,
    BoothCardComponent,
    ExpoMiniMapComponent,
    PixelFaceComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './exhibitor-page.component.html',
  styleUrl: './exhibitor-page.component.scss',
})
export class ExhibitorPageComponent {
  private readonly _toolsService = inject(ToolsService);
  private readonly _venueService = inject(VenueService);
  private readonly _meService = inject(MeService);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _loads = new Subject<string>();
  private _outpostId = '';

  public attendeeId = this._meService.attendeeId;
  public staleLinkMessage = '';
  public page: IExhibitorPage | null = null;
  public isLoading = true;
  public errorMessage = '';
  public notFound = false;
  public miniMap: IMiniMap | null = null;
  public isMakingQuest = false;
  public questError = '';
  public madeQuest: IMadeQuest | null = null;

  @Input() public set outpostId(value: string | undefined) {
    if (value && value !== this._outpostId) {
      this._outpostId = value;
      this._loads.next(value);
    }
  }

  constructor() {
    this._loads
      .pipe(
        tap(() => this._reset()),
        switchMap((outpostId) => this._watch(outpostId)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  public get exhibitor(): IExhibitorDetail | null {
    return this.page?.exhibitor ?? null;
  }

  public get me(): IExhibitorMe | undefined {
    return this.page?.me;
  }

  public get typeLabel(): string {
    return this.exhibitor ? (exhibitorTypeSingularLabels[this.exhibitor.exhibitorType] ?? '') : '';
  }

  public get boothLabel(): string {
    return this.exhibitor ? ExhibitorsHelper.boothLabel(this.exhibitor) : '';
  }

  public get whereLine(): string {
    return this.exhibitor ? ExhibitorsHelper.whereLine(this.exhibitor) : '';
  }

  public get locationLine(): string {
    if (!this.exhibitor) {
      return '';
    }

    return [this.whereLine, this.exhibitor.building, this.exhibitor.level].filter((part) => part).join(' · ');
  }

  public get questStatusText(): string {
    const status = this.me?.questStatus;

    return status ? (questStatusLabels[status] ?? status) : 'on your Quests tab';
  }

  public get mapAriaLabel(): string {
    return this.exhibitor ? ExhibitorsHelper.mapAriaLabel(this.exhibitor) : '';
  }

  public get canMakeQuest(): boolean {
    return Boolean(this.attendeeId && this.page && !this.me?.questId);
  }

  public get visitTime(): string {
    return ExhibitorsHelper.formatClock(this.me?.lastVisitAt);
  }

  public topicLabel(topic: string): string {
    return ExhibitorsHelper.topicLabel(topic);
  }

  public talkTime(isoDate: string): string {
    return ExhibitorsHelper.formatTalkTime(isoDate);
  }

  public reload(): void {
    if (this._outpostId) {
      this._loads.next(this._outpostId);
    }
  }

  public makeQuest(): void {
    const attendeeId = this.attendeeId;
    const exhibitor = this.exhibitor;

    if (!attendeeId || !exhibitor || this.isMakingQuest) {
      return;
    }

    const input: IMakeOutpostQuestInput = { attendeeId, targetKind: 'outpost', targetId: exhibitor.id };

    this.isMakingQuest = true;
    this.questError = '';
    this._toolsService
      .call<IMadeQuest>('make_quest', input)
      .pipe(
        finalize(() => (this.isMakingQuest = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (quest) => {
          this.madeQuest = quest;

          if (this.page) {
            this.page = {
              ...this.page,
              me: { visited: this.me?.visited ?? false, ...this.me, questId: quest.id, questStatus: quest.status },
            };
          }
        },
        error: (error: unknown) => {
          console.error('make_quest failed', error);
          this.questError = 'That quest didn’t save. Try again.';
        },
      });
  }

  private _reset(): void {
    this.page = null;
    this.isLoading = true;
    this.errorMessage = '';
    this.notFound = false;
    this.miniMap = null;
    this.madeQuest = null;
    this.questError = '';
  }

  private _watch(outpostId: string): Observable<boolean> {
    return StaffHelper.visiblePoll(this._document, exhibitorPageSettings.LIVE_REFRESH_MS, () => this._load(outpostId));
  }

  private _load(outpostId: string): Observable<boolean> {
    return this._fetch(outpostId).pipe(
      map((page) => {
        if (this.page) {
          this._applyLive(page);
        } else {
          this._applyPage(page);
        }

        return false;
      }),
      catchError((error: unknown) => {
        if (this.attendeeId && ExhibitorsHelper.errorCode(error) === exhibitorErrorCodes.UNKNOWN_ATTENDEE) {
          this._forgetAttendee();

          return this._load(outpostId);
        }

        if (this.page) {
          console.error('get_exhibitor refresh failed', error);

          return of(StaffHelper.isServerError(error));
        }

        this._applyError(error);

        return EMPTY;
      }),
    );
  }

  private _forgetAttendee(): void {
    this._meService.clear();
    this.attendeeId = null;
    this.staleLinkMessage = staleAttendeeMessage;
  }

  private _fetch(outpostId: string): Observable<IExhibitorPage> {
    return this._toolsService.call<IExhibitorPage>('get_exhibitor', {
      outpostId,
      attendeeId: this.attendeeId ?? undefined,
    });
  }

  private _applyPage(page: IExhibitorPage): void {
    this.page = page;
    this.isLoading = false;
    this.errorMessage = '';
    this.notFound = false;
    this._loadMiniMap(page.exhibitor);
  }

  private _applyLive(page: IExhibitorPage): void {
    if (!this.page || page.exhibitor.id !== this.page.exhibitor.id) {
      return;
    }

    const serverMe = page.me ?? this.me;
    const localQuest = this.madeQuest;

    this.page = {
      ...this.page,
      live: page.live,
      playersHere: page.playersHere,
      me:
        localQuest && serverMe && !serverMe.questId
          ? { ...serverMe, questId: localQuest.id, questStatus: localQuest.status }
          : serverMe,
    };
  }

  private _applyError(error: unknown): void {
    const isUnknown = ExhibitorsHelper.errorCode(error) === exhibitorErrorCodes.UNKNOWN_OUTPOST;

    if (!isUnknown) {
      console.error('get_exhibitor failed', error);
    }

    this.notFound = isUnknown;
    this.errorMessage = isUnknown ? '' : 'This booth didn’t load. Check your connection and try again.';
    this.isLoading = false;
  }

  private _loadMiniMap(exhibitor: IExhibitorDetail): void {
    const position = exhibitor.mapPosition;

    if (!position) {
      this.miniMap = null;

      return;
    }

    this._venueService
      .getSchematic()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (schematic) => {
          const placement = VenueHelper.findLevel(schematic, exhibitorPageSettings.EXPO_LEVEL_ID);

          if (placement && this.exhibitor?.id === exhibitor.id) {
            this.miniMap = ExhibitorsHelper.buildMiniMap(placement.level, position, exhibitor.zone);
          }
        },
        error: (error: unknown) => {
          console.error('Expo map failed to load', error);
          this.miniMap = null;
        },
      });
  }
}
