import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EMPTY, Subscription, catchError, filter, switchMap, takeWhile, timer } from 'rxjs';
import { IBossState } from '../../../quests/quests.types';
import { ToolsService } from '../../../core/services/tools.service';

const liveStatuses = ['waiting', 'fighting'];
const defaultPollMs = 5000;

@Component({
  selector: 'app-boss-bar',
  imports: [DatePipe, MatIconModule],
  templateUrl: './boss-bar.component.html',
  styleUrl: './boss-bar.component.scss',
})
export class BossBarComponent implements OnChanges, OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private _pollSubscription?: Subscription;

  @Input() public talkId = '';
  @Input() public locationId = '';
  @Input() public initialState: IBossState | null = null;
  @Input() public pollMs = defaultPollMs;
  @Input() public keepPolling = false;
  @Input() public isLarge = false;
  @Output() public readonly unavailable = new EventEmitter<void>();

  public boss: IBossState | null = null;

  public get healthPercent(): number {
    if (!this.boss || this.boss.maxHealth <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((this.boss.health / this.boss.maxHealth) * 100)));
  }

  public get isLive(): boolean {
    return !!this.boss && liveStatuses.includes(this.boss.status);
  }

  public get isDefeated(): boolean {
    return this.boss?.status === 'defeated';
  }

  public get statusLabel(): string {
    switch (this.boss?.status) {
      case 'fighting':
        return 'Fight on';
      case 'defeated':
        return 'Defeated';
      case 'escaped':
        return 'Escaped';
      default:
        return 'Waiting';
    }
  }

  public ngOnChanges(): void {
    if (this.initialState) {
      this.boss = this.initialState;
    }

    this._startPolling();
  }

  public ngOnDestroy(): void {
    this._pollSubscription?.unsubscribe();
  }

  private _startPolling(): void {
    this._pollSubscription?.unsubscribe();

    if (!this.talkId && !this.locationId) {
      return;
    }

    const input = this.talkId ? { talkId: this.talkId } : { locationId: this.locationId };

    this._pollSubscription = timer(0, this.pollMs)
      .pipe(
        filter(() => typeof document === 'undefined' || document.visibilityState === 'visible'),
        switchMap(() =>
          this._toolsService.call<IBossState>('boss_state', input, { background: true }).pipe(
            catchError((error: unknown) => {
              if (!this.boss) {
                this.unavailable.emit();
              }

              if (error instanceof HttpErrorResponse && error.status === 404) {
                this._pollSubscription?.unsubscribe();
              }

              return EMPTY;
            }),
          ),
        ),
        takeWhile((boss) => this.keepPolling || liveStatuses.includes(boss.status), true),
      )
      .subscribe((boss) => {
        this.boss = boss;
      });
  }
}
