import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IHandshake } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';

@Component({
  selector: 'app-handshake-start',
  imports: [RouterLink, MatButtonModule, MatIconModule, ScreenToolbarComponent, StateWrapperComponent],
  template: `
    <section class="app-page">
      <app-screen-toolbar title="Meeting someone"></app-screen-toolbar>
      <app-state-wrapper [isLoading]="isLoading" [errorMessage]="errorMessage" (retry)="start()">
        <p>Opening your question…</p>
      </app-state-wrapper>
      @if (errorMessage) {
        <p class="hint">Codes change every minute. Ask them to show a fresh one, then scan again.</p>
        <a mat-stroked-button routerLink="/code">
          <div class="btn-content">
            <mat-icon>qr_code_2</mat-icon>
            <span>Show my code instead</span>
          </div>
        </a>
      }
    </section>
  `,
  styles: [
    `
      .hint {
        color: var(--app-theme--ink-muted);
      }
    `,
  ],
})
export class HandshakeStartComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  @Input() public token = '';

  public isLoading = true;
  public errorMessage = '';

  public ngOnInit(): void {
    this.start();
  }

  public start(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IHandshake>('start_handshake', { attendeeId: this._meService.attendeeId, token: this.token })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (handshake) => void this._router.navigate(['/handshake', handshake.id], { replaceUrl: true }),
        error: (error: unknown) => {
          console.error('Could not start the handshake', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }
}
