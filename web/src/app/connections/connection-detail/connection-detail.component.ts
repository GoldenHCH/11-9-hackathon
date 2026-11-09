import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { IConnection } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { LinkChipsComponent } from '../../links/link-chips/link-chips.component';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';

const noteMaxChars = 2000;

@Component({
  selector: 'app-connection-detail',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    AlertBannerComponent,
    LinkChipsComponent,
    PixelFaceComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './connection-detail.component.html',
  styleUrl: './connection-detail.component.scss',
})
export class ConnectionDetailComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  public readonly noteMaxChars = noteMaxChars;
  public connection: IConnection | null = null;
  public talkedAbout = '';
  public nextSteps = '';
  public isLoading = true;
  public isSaving = false;
  public errorMessage = '';
  public saveError = '';
  public savedAt = '';

  public ngOnInit(): void {
    this.loadConnection();
  }

  public loadConnection(): void {
    const connectionId = this._route.snapshot.paramMap.get('connectionId');
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IConnection[]>('list_connections', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (connections) => {
          this.connection = connections.find((connection) => connection.id === connectionId) ?? null;
          this.errorMessage = this.connection ? '' : 'We couldn’t find that connection. It may have been removed.';
          this.talkedAbout = this.connection?.note?.talkedAbout ?? '';
          this.nextSteps = this.connection?.note?.nextSteps ?? '';
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load the connection', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onSave(): void {
    if (!this.connection || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this._toolsService
      .call<IConnection>('save_connection_note', {
        attendeeId: this._meService.attendeeId,
        connectionId: this.connection.id,
        talkedAbout: this.talkedAbout.trim(),
        nextSteps: this.nextSteps.trim(),
        ...(this.connection.note?.followUpBy ? { followUpBy: this.connection.note.followUpBy } : {}),
      })
      .pipe(
        finalize(() => (this.isSaving = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (connection) => {
          this.connection = connection;
          this.savedAt = connection.note?.updatedAt ?? new Date().toISOString();
        },
        error: (error: unknown) => {
          console.error('Could not save the connection note', error);
          this.saveError = ApiErrorHelper.message(error);
        },
      });
  }
}
