import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { toDataURL } from 'qrcode';
import { Subscription, catchError, filter, firstValueFrom, of, switchMap, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { ToolsService } from '../core/services/tools.service';
import { BossBarComponent } from '../shared/components/boss-bar/boss-bar.component';
import { PixelFaceComponent } from '../shared/components/pixel-face/pixel-face.component';
import {
  screenBossPollMs,
  screenKeyErrorCode,
  screenLeaderboardLimit,
  screenLeaderboardPollMs,
  screenQrWidth,
  screenTokenRefreshMs,
  screenTokenRetryMs,
} from './screen.constants';
import { IClientConfig, ILeaderboard, ILeaderboardRow, IScreenToken, IWorld } from './screen.types';

@Component({
  selector: 'app-screen',
  imports: [MatIconModule, BossBarComponent, PixelFaceComponent],
  templateUrl: './screen.component.html',
  styleUrl: './screen.component.scss',
})
export class ScreenComponent implements OnInit, OnDestroy {
  private readonly _http = inject(HttpClient);
  private readonly _toolsService = inject(ToolsService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _subscriptions = new Subscription();
  private _tokenTimer: ReturnType<typeof setTimeout> | null = null;
  private _publicBaseUrl = '';
  private _key = '';

  public readonly bossPollMs = screenBossPollMs;
  public locationId = '';
  public roomName = '';
  public qrDataUrl = '';
  public scanUrl = '';
  public isKeyMissing = false;
  public qrError = '';
  public rows: ILeaderboardRow[] = [];
  public hasBoss = true;

  public async ngOnInit(): Promise<void> {
    this.locationId = this._route.snapshot.paramMap.get('locationId') ?? '';
    this._key = this._route.snapshot.queryParamMap.get('key') ?? '';
    this.roomName = this._humanize(this.locationId);

    this._loadRoomName();
    this._pollLeaderboard();

    if (!this._key) {
      this.isKeyMissing = true;
      return;
    }

    this._publicBaseUrl = await this._loadPublicBaseUrl();
    await this._refreshToken();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();

    if (this._tokenTimer) {
      clearTimeout(this._tokenTimer);
    }
  }

  public faceSeed(row: ILeaderboardRow): string {
    return row.player.faceSeed || row.player.handle;
  }

  public onBossUnavailable(): void {
    this.hasBoss = false;
  }

  private async _refreshToken(): Promise<void> {
    let nextRefreshMs = screenTokenRefreshMs;

    try {
      const token = await firstValueFrom(
        this._http.get<IScreenToken>(
          `${environment.apiBaseUrl}/screen-token/${encodeURIComponent(this.locationId)}`,
          { params: { key: this._key } },
        ),
      );
      const baseUrl = this._publicBaseUrl || window.location.origin;
      this.scanUrl = `${baseUrl.replace(/\/$/, '')}/r/${encodeURIComponent(this.locationId)}?t=${encodeURIComponent(token.token)}`;
      this.qrDataUrl = await toDataURL(this.scanUrl, {
        width: screenQrWidth,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      this.qrError = '';
      this.isKeyMissing = false;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && this._errorCode(error) === screenKeyErrorCode) {
        this.isKeyMissing = true;
        this.qrDataUrl = '';
        return;
      }

      this.qrError = ApiErrorHelper.message(error);
      nextRefreshMs = screenTokenRetryMs;
    }

    this._tokenTimer = setTimeout(() => void this._refreshToken(), nextRefreshMs);
  }

  private async _loadPublicBaseUrl(): Promise<string> {
    try {
      const config = await firstValueFrom(this._http.get<IClientConfig>(`${environment.apiBaseUrl}/config`));

      return config.publicBaseUrl ?? '';
    } catch {
      return '';
    }
  }

  private _pollLeaderboard(): void {
    this._subscriptions.add(
      timer(0, screenLeaderboardPollMs)
        .pipe(
          filter(() => document.visibilityState === 'visible'),
          switchMap(() =>
            this._toolsService
              .call<ILeaderboard>(
                'leaderboard',
                { board: 'overall', period: 'today', limit: screenLeaderboardLimit },
                { background: true },
              )
              .pipe(catchError(() => of(null))),
          ),
        )
        .subscribe((leaderboard) => {
          if (leaderboard) {
            this.rows = leaderboard.rows.slice(0, screenLeaderboardLimit);
          }
        }),
    );
  }

  private _loadRoomName(): void {
    this._subscriptions.add(
      this._toolsService
        .call<IWorld>('world', {}, { background: true })
        .pipe(catchError(() => of(null)))
        .subscribe((world) => {
          const rooms = world?.buildings.flatMap((building) => building.levels.flatMap((level) => level.rooms)) ?? [];
          const room = rooms.find((item) => item.location.id === this.locationId);

          if (room) {
            this.roomName = room.location.name;
          }
        }),
    );
  }

  private _errorCode(error: HttpErrorResponse): string {
    const body = error.error as { error?: { code?: string } } | null;

    return body?.error?.code ?? '';
  }

  private _humanize(locationId: string): string {
    return locationId
      .split('-')
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
