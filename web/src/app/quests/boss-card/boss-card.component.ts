import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EMPTY, Subscription, catchError, filter, switchMap, takeWhile, timer } from 'rxjs';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { bossPollMs } from '../quests.constants';
import { IBossState } from '../quests.types';

const liveStatuses = ['waiting', 'fighting'];

@Component({
  selector: 'app-boss-card',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './boss-card.component.html',
  styleUrl: './boss-card.component.scss',
})
export class BossCardComponent implements OnChanges, OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private _pollSubscription?: Subscription;

  @Input() public talkId = '';
  @Input() public locationId = '';
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

  public get statusIcon(): string {
    switch (this.boss?.status) {
      case 'fighting':
        return 'bolt';
      case 'defeated':
        return 'emoji_events';
      case 'escaped':
        return 'directions_run';
      default:
        return 'hourglass_top';
    }
  }

  public ngOnChanges(): void {
    this.startPolling();
  }

  public ngOnDestroy(): void {
    this._pollSubscription?.unsubscribe();
  }

  private startPolling(): void {
    this._pollSubscription?.unsubscribe();

    if (!this.talkId && !this.locationId) {
      return;
    }

    const input = this.talkId
      ? { talkId: this.talkId, attendeeId: this._meService.attendeeId ?? undefined }
      : { locationId: this.locationId };

    this._pollSubscription = timer(0, bossPollMs)
      .pipe(
        filter(() => typeof document === 'undefined' || document.visibilityState === 'visible'),
        switchMap(() =>
          this._toolsService.call<IBossState>('boss_state', input, { background: true }).pipe(
            catchError((error: unknown) => {
              console.error('Could not load the boss', error);
              if (!this.boss) {
                this.unavailable.emit();
              }
              return EMPTY;
            }),
          ),
        ),
        takeWhile((boss) => liveStatuses.includes(boss.status), true),
      )
      .subscribe((boss) => {
        this.boss = boss;
      });
  }
}
