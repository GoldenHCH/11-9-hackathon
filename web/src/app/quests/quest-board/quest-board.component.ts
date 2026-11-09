import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, fromEvent, interval, merge } from 'rxjs';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { BossCardComponent } from '../boss-card/boss-card.component';
import { IQuestResponseEvent, QuestCardComponent } from '../quest-card/quest-card.component';
import { questBoardPollMs } from '../quests.constants';
import { IBannerProgress, IProfile, IQuest, IQuestBoard, IRespondQuestResult } from '../quests.types';

interface IBossTarget {
  key: string;
  talkId: string;
  locationId: string;
}

const bossWindowMs = 15 * 60 * 1000;

const responseMessages: Record<string, string> = {
  accept: 'Quest accepted',
  not_now: 'Hidden for now. It may come back later.',
  not_for_me: 'Removed. We will offer you something else.',
  drop: 'Quest dropped. The slot is free.',
};

@Component({
  selector: 'app-quest-board',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AlertBannerComponent,
    PixelFaceComponent,
    BossCardComponent,
    QuestCardComponent,
  ],
  templateUrl: './quest-board.component.html',
  styleUrl: './quest-board.component.scss',
})
export class QuestBoardComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);
  private _hiddenBossKey = '';

  public readonly skeletonCards = [0, 1, 2];
  public attendeeId: string | null = null;
  public board: IQuestBoard | null = null;
  public profile: IProfile | null = null;
  public isLoading = true;
  public isRefreshing = false;
  public errorMessage = '';
  public actionError = '';
  public liveMessage = '';
  public busyQuestIds = new Set<string>();

  public get isSignedIn(): boolean {
    return !!this.attendeeId;
  }

  public get offers(): IQuest[] {
    return (this.board?.offers ?? []).slice(0, this.board?.maxOffers ?? 3);
  }

  public get active(): IQuest[] {
    return (this.board?.active ?? []).slice(0, this.board?.maxActive ?? 3);
  }

  public get doneToday(): IQuest[] {
    return this.board?.doneToday ?? [];
  }

  public get maxActive(): number {
    return this.board?.maxActive ?? 3;
  }

  public get canAcceptMore(): boolean {
    return this.active.length < this.maxActive;
  }

  public get isBoardEmpty(): boolean {
    return this.offers.length === 0 && this.active.length === 0 && this.doneToday.length === 0;
  }

  public get xpToday(): number {
    return this.doneToday.reduce((total, quest) => total + quest.reward.xp, 0);
  }

  public get levelPercent(): number {
    const level = this.profile?.level;

    if (!level) {
      return 0;
    }

    if (level.nextLevelXp === null) {
      return 100;
    }

    const span = level.nextLevelXp - level.levelMinXp;

    if (span <= 0) {
      return 100;
    }

    return Math.max(0, Math.min(100, Math.round(((level.xp - level.levelMinXp) / span) * 100)));
  }

  public get xpToNextLevel(): number | null {
    const level = this.profile?.level;

    if (!level || level.nextLevelXp === null) {
      return null;
    }

    return Math.max(0, level.nextLevelXp - level.xp);
  }

  public get nextBanners(): IBannerProgress[] {
    return (this.profile?.inventory.banners ?? [])
      .filter((banner) => !banner.earned)
      .sort((first, second) => this.bannerRatio(second) - this.bannerRatio(first))
      .slice(0, 4);
  }

  public get earnedBannerCount(): number {
    return (this.profile?.inventory.banners ?? []).filter((banner) => banner.earned).length;
  }

  public get bossTarget(): IBossTarget | null {
    const target = this.findBossTarget();

    if (!target || target.key === this._hiddenBossKey) {
      return null;
    }

    return target;
  }

  public ngOnInit(): void {
    this.attendeeId = this._meService.attendeeId;

    if (!this.attendeeId) {
      this.isLoading = false;
      return;
    }

    this.loadBoard();
    this.loadProfile();
    this.startPolling();
  }

  public loadBoard(isBackground = false): void {
    if (!this.attendeeId) {
      return;
    }

    if (isBackground) {
      this.isRefreshing = true;
    } else {
      this.isLoading = !this.board;
      this.errorMessage = '';
    }

    this._toolsService
      .call<IQuestBoard>('quest_board', { attendeeId: this.attendeeId }, { background: isBackground })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (board) => {
          if (this.busyQuestIds.size === 0) {
            this.board = board;
          }
          this.errorMessage = '';
          this.isLoading = false;
          this.isRefreshing = false;
        },
        error: (error: unknown) => {
          console.error('Could not load the quest board', error);
          this.isLoading = false;
          this.isRefreshing = false;

          if (this.handleUnknownAttendee(error)) {
            return;
          }

          if (!this.board) {
            this.errorMessage = ApiErrorHelper.message(error);
          }
        },
      });
  }

  public refresh(): void {
    this.liveMessage = 'Refreshing quests';
    this.loadBoard(true);
    this.loadProfile();
  }

  public onRespond(event: IQuestResponseEvent): void {
    if (!this.attendeeId || !this.board || this.busyQuestIds.has(event.quest.id)) {
      return;
    }

    const snapshot = this.board;
    this.actionError = '';
    this.board = this.applyOptimistic(snapshot, event);
    this.busyQuestIds.add(event.quest.id);
    this.liveMessage = `${responseMessages[event.response]}: ${event.quest.title}`;

    const input = {
      attendeeId: this.attendeeId,
      questId: event.quest.id,
      response: event.response,
      ...(event.reason ? { reason: event.reason } : {}),
    };

    this._toolsService
      .call<IRespondQuestResult>('respond_quest', input)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.busyQuestIds.delete(event.quest.id);
          this.board = result.board;

          if (event.response === 'drop' || event.response === 'accept') {
            this.loadProfile();
          }
        },
        error: (error: unknown) => {
          console.error('Could not update the quest', error);
          this.busyQuestIds.delete(event.quest.id);
          this.board = snapshot;
          this.actionError = ApiErrorHelper.message(error);
          this.liveMessage = `Could not update ${event.quest.title}. ${this.actionError}`;

          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.loadBoard(true);
          }
        },
      });
  }

  public onBossUnavailable(key: string): void {
    this._hiddenBossKey = key;
  }

  public bannerPercent(banner: IBannerProgress): number {
    return Math.round(this.bannerRatio(banner) * 100);
  }

  private loadProfile(): void {
    if (!this.attendeeId) {
      return;
    }

    this._toolsService
      .call<IProfile>('get_profile', { attendeeId: this.attendeeId }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile = profile;
        },
        error: (error: unknown) => {
          console.error('Could not load the profile', error);
          this.handleUnknownAttendee(error);
        },
      });
  }

  private startPolling(): void {
    const visible$ = fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible'));
    const tick$ = interval(questBoardPollMs).pipe(filter(() => document.visibilityState === 'visible'));

    merge(visible$, tick$)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (this.busyQuestIds.size === 0) {
          this.loadBoard(true);
        }
      });
  }

  private applyOptimistic(board: IQuestBoard, event: IQuestResponseEvent): IQuestBoard {
    const { quest, response } = event;

    if (response === 'accept') {
      return {
        ...board,
        offers: board.offers.filter((offer) => offer.id !== quest.id),
        active: [...board.active, { ...quest, status: 'accepted' }],
      };
    }

    if (response === 'drop') {
      return { ...board, active: board.active.filter((item) => item.id !== quest.id) };
    }

    return { ...board, offers: board.offers.filter((offer) => offer.id !== quest.id) };
  }

  private findBossTarget(): IBossTarget | null {
    const quests = [...(this.board?.active ?? []), ...(this.board?.offers ?? [])];
    const bossQuest = quests.find((quest) => quest.type === 'boss' && quest.talkId);

    if (bossQuest?.talkId) {
      return { key: `talk:${bossQuest.talkId}`, talkId: bossQuest.talkId, locationId: '' };
    }

    const now = Date.now();
    const roomQuest = quests.find((quest) => {
      if (quest.where?.kind !== 'boss-room' || !quest.talkId || !quest.when) {
        return false;
      }

      const start = new Date(quest.when.start).getTime() - bossWindowMs;
      const end = new Date(quest.when.end).getTime() + bossWindowMs;
      return now >= start && now <= end;
    });

    if (roomQuest?.talkId) {
      return { key: `talk:${roomQuest.talkId}`, talkId: roomQuest.talkId, locationId: '' };
    }

    const lastLocationId = this.profile?.attendee.lastLocationId;

    if (lastLocationId) {
      return { key: `location:${lastLocationId}`, talkId: '', locationId: lastLocationId };
    }

    return null;
  }

  private bannerRatio(banner: IBannerProgress): number {
    return banner.target > 0 ? Math.min(1, banner.progress / banner.target) : 0;
  }

  private handleUnknownAttendee(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
      return false;
    }

    const body: unknown = error.error;
    const code =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'code' in body.error
        ? body.error.code
        : '';

    if (code !== 'unknown_attendee' && code !== 'attendee_not_found') {
      return false;
    }

    this._meService.clear();
    this.attendeeId = null;
    this.board = null;
    this.profile = null;
    this.errorMessage = '';
    return true;
  }
}
