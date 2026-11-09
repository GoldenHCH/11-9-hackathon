import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ICheckInResult, ISaveBoothNoteResult } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { BoothNoteFormComponent } from '../booth-note-form/booth-note-form.component';

@Component({
  selector: 'app-scan-landing',
  imports: [RouterLink, MatButtonModule, MatIconModule, BoothNoteFormComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './scan-landing.component.html',
  styleUrl: './scan-landing.component.scss',
})
export class ScanLandingComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  @Input() public locationId = '';
  @Input() public t = '';

  public result: ICheckInResult | null = null;
  public saveResult: ISaveBoothNoteResult | null = null;
  public isLoading = true;
  public errorMessage = '';

  public ngOnInit(): void {
    this.checkIn();
  }

  public get isBooth(): boolean {
    return !!this.result?.boothNote || !!this.result?.noteRequired;
  }

  public checkIn(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<ICheckInResult>('check_in', { attendeeId: this._meService.attendeeId, locationId: this.locationId, token: this.t })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Check-in failed', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onNoteSaved(saveResult: ISaveBoothNoteResult): void {
    this.saveResult = saveResult;

    if (this.result) {
      this.result = { ...this.result, boothNote: saveResult.note };
    }
  }
}
