import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subscription, finalize, interval, switchMap, timer } from 'rxjs';
import { toDataURL } from 'qrcode';
import { IHandshakeCode, IHandshakeStateResult } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { HandshakeHelper } from '../handshake.helper';

const refreshLeadMs = 8000;
const pollIntervalMs = 2000;
const minimumRefreshGapMs = 5000;

@Component({
  selector: 'app-my-code',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    AlertBannerComponent,
    ScreenToolbarComponent,
  ],
  templateUrl: './my-code.component.html',
  styleUrl: './my-code.component.scss',
})
export class MyCodeComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private _refreshSubscription: Subscription | null = null;
  private _isRefreshing = false;
  private _lastRefreshAt = 0;

  public code: IHandshakeCode | null = null;
  public qrDataUrl = '';
  public secondsLeft = 0;
  public errorMessage = '';
  public pastedLink = '';
  public pasteError = '';

  public ngOnInit(): void {
    this.refreshCode();
    interval(1000)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._tick());
    timer(pollIntervalMs, pollIntervalMs)
      .pipe(
        switchMap(() =>
          this._toolsService.call<IHandshakeStateResult>(
            'handshake_state',
            { attendeeId: this._meService.attendeeId },
            { background: true },
          ),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => this._openIncoming(result),
        error: (error: unknown) => console.error('Handshake polling stopped', error),
      });
  }

  public refreshCode(): void {
    this._refreshSubscription?.unsubscribe();
    this._isRefreshing = true;
    this._lastRefreshAt = Date.now();
    this._refreshSubscription = this._toolsService
      .call<IHandshakeCode>('handshake_code', { attendeeId: this._meService.attendeeId }, { background: this.code !== null })
      .pipe(
        finalize(() => (this._isRefreshing = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (code) => this._showCode(code),
        error: (error: unknown) => {
          console.error('Could not get a handshake code', error);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }

  public openPastedLink(): void {
    const token = HandshakeHelper.tokenFromLink(this.pastedLink);

    if (!token) {
      this.pasteError = 'That doesn’t look like a KubeQuest code link.';

      return;
    }

    this.pasteError = '';
    void this._router.navigate(['/h', token]);
  }

  private async _showCode(code: IHandshakeCode): Promise<void> {
    this.errorMessage = '';
    this.code = code;
    this._tick();

    try {
      this.qrDataUrl = await toDataURL(code.scanUrl, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
    } catch (error) {
      console.error('Could not draw the QR code', error);
      this.errorMessage = 'Your code didn’t draw. Try refreshing it.';
    }
  }

  private _tick(): void {
    if (!this.code) {
      return;
    }

    const millisecondsLeft = Date.parse(this.code.expiresAt) - Date.now();
    this.secondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000));

    const canRefresh = !this._isRefreshing && Date.now() - this._lastRefreshAt >= minimumRefreshGapMs;

    if (millisecondsLeft <= refreshLeadMs && canRefresh) {
      this.refreshCode();
    }
  }

  private _openIncoming(result: IHandshakeStateResult): void {
    const handshake = result.handshake;

    if (handshake && handshake.status === 'waiting') {
      void this._router.navigate(['/handshake', handshake.id]);
    }
  }
}
