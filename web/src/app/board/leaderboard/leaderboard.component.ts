import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import {
  bannerIcons,
  defaultTraceUrlTemplate,
  leaderboardBoards,
  leaderboardLimit,
  leaderboardMaxBackoffMs,
  leaderboardPeriods,
  leaderboardRefreshMs,
  rankChangeHighlightMs,
} from './leaderboard.constants';
import {
  IClientConfig,
  ILeaderboard,
  ILeaderboardRow,
  LeaderboardBoard,
  LeaderboardPeriod,
  RankChange,
} from './leaderboard.types';

interface IErrorEnvelope {
  error?: { code?: string; message?: string };
}

@Component({
  selector: 'app-leaderboard',
  imports: [
    MatIconModule,
    NgTemplateOutlet,
    PixelFaceComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _http = inject(HttpClient);

  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private _request: Subscription | null = null;
  private _intervalMs = leaderboardRefreshMs;
  private _previousRanks = new Map<string, number>();
  private _traceUrlTemplate = defaultTraceUrlTemplate;

  public readonly boards = leaderboardBoards;
  public readonly periods = leaderboardPeriods;
  public board: LeaderboardBoard = 'overall';
  public period: LeaderboardPeriod = 'today';
  public leaderboard: ILeaderboard | null = null;
  public isLoading = true;
  public errorMessage = '';
  public rankChanges = new Map<string, RankChange>();

  public get boardIndex(): number {
    return this.boards.findIndex((board) => board.id === this.board);
  }

  public get scoreUnit(): string {
    return this.boards[this.boardIndex]?.scoreUnit ?? 'XP';
  }

  public get rows(): ILeaderboardRow[] {
    return this.leaderboard?.rows ?? [];
  }

  public get podium(): ILeaderboardRow[] {
    const [first, second, third] = this.rows;
    return [second, first, third].filter((row): row is ILeaderboardRow => !!row);
  }

  public podiumPlace(row: ILeaderboardRow): number {
    return this.rows.indexOf(row) + 1;
  }

  public get listRows(): ILeaderboardRow[] {
    return this.rows.slice(3, leaderboardLimit);
  }

  public get pinnedMe(): ILeaderboardRow | null {
    const me = this.leaderboard?.me;

    if (!me || this.rows.some((row) => row.isMe)) {
      return null;
    }

    return me;
  }

  public ngOnInit(): void {
    this._loadTraceTemplate();
    this._fetch(true);
  }

  public ngOnDestroy(): void {
    this._stopTimer();
    this._request?.unsubscribe();

    if (this._highlightTimer) {
      clearTimeout(this._highlightTimer);
    }
  }

  @HostListener('document:visibilitychange')
  public onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this._fetch(false);
    } else {
      this._stopTimer();
    }
  }

  public selectBoard(board: LeaderboardBoard): void {
    if (board !== this.board) {
      this.board = board;
      this._reset();
    }
  }

  public selectPeriod(period: LeaderboardPeriod): void {
    if (period !== this.period) {
      this.period = period;
      this._reset();
    }
  }

  public retry(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._fetch(true);
  }

  public traceUrl(row: ILeaderboardRow): string {
    return this._traceUrlTemplate.replace('{traceId}', encodeURIComponent(row.latestTraceId ?? ''));
  }

  public bannerIcon(bannerId: string): { icon: string; label: string } {
    return bannerIcons[bannerId] ?? { icon: 'flag', label: `${bannerId} banner` };
  }

  public faceSeed(row: ILeaderboardRow): string {
    return row.player.faceSeed || row.player.handle;
  }

  public rankChange(row: ILeaderboardRow): RankChange | null {
    return this.rankChanges.get(row.player.id) ?? null;
  }

  private _reset(): void {
    this._previousRanks.clear();
    this.rankChanges = new Map();
    this.leaderboard = null;
    this.isLoading = true;
    this.errorMessage = '';
    this._fetch(true);
  }

  private _fetch(isForeground: boolean): void {
    this._stopTimer();
    this._request?.unsubscribe();

    const attendeeId = this._meService.attendeeId;
    const input = {
      board: this.board,
      period: this.period,
      limit: leaderboardLimit,
      ...(attendeeId ? { attendeeId } : {}),
    };

    this._request = this._toolsService
      .call<ILeaderboard>('leaderboard', input, { background: !isForeground })
      .subscribe({
        next: (leaderboard) => {
          this._applyRankChanges(leaderboard);
          this.leaderboard = leaderboard;
          this.isLoading = false;
          this.errorMessage = '';
          this._intervalMs = leaderboardRefreshMs;
          this._schedule();
        },
        error: (error: HttpErrorResponse) => {
          this.isLoading = false;

          if (error.status >= 500 || error.status === 0) {
            this._intervalMs = Math.min(this._intervalMs * 2, leaderboardMaxBackoffMs);
          }

          if (!this.leaderboard) {
            this.errorMessage =
              (error.error as IErrorEnvelope | null)?.error?.message ?? 'The board did not load. Try again in a moment.';
          }

          this._schedule();
        },
      });
  }

  private _applyRankChanges(leaderboard: ILeaderboard): void {
    const changes = new Map<string, RankChange>();
    const hadPrevious = this._previousRanks.size > 0;
    const rows = leaderboard.me ? [...leaderboard.rows, leaderboard.me] : leaderboard.rows;

    for (const row of rows) {
      const previous = this._previousRanks.get(row.player.id);

      if (previous === undefined) {
        if (hadPrevious) {
          changes.set(row.player.id, 'new');
        }
      } else if (row.rank < previous) {
        changes.set(row.player.id, 'up');
      } else if (row.rank > previous) {
        changes.set(row.player.id, 'down');
      }
    }

    this._previousRanks = new Map(rows.map((row) => [row.player.id, row.rank]));
    this.rankChanges = changes;

    if (this._highlightTimer) {
      clearTimeout(this._highlightTimer);
    }

    if (changes.size > 0) {
      this._highlightTimer = setTimeout(() => {
        this.rankChanges = new Map();
      }, rankChangeHighlightMs);
    }
  }

  private _schedule(): void {
    this._stopTimer();

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    this._timer = setTimeout(() => this._fetch(false), this._intervalMs);
  }

  private _stopTimer(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  private _loadTraceTemplate(): void {
    if (environment.useFixtures) {
      return;
    }

    this._http
      .get<IClientConfig>(`${environment.apiBaseUrl}/config`)
      .pipe(catchError(() => of(null)))
      .subscribe((config) => {
        if (config?.traceUrlTemplate?.includes('{traceId}')) {
          this._traceUrlTemplate = config.traceUrlTemplate;
        }
      });
  }
}
