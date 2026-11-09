import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IMeet } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { meetStatusLabels } from '../meet.constants';

@Component({
  selector: 'app-meets',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, PixelFaceComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './meets.component.html',
  styleUrl: './meets.component.scss',
})
export class MeetsComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  public readonly statusLabels = meetStatusLabels;
  public meets: IMeet[] = [];
  public isLoading = true;
  public errorMessage = '';

  public ngOnInit(): void {
    this.loadMeets();
  }

  public loadMeets(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IMeet[]>('list_meets', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (meets) => {
          this.meets = meets;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load meets', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public showCode(): void {
    void this._router.navigate(['/code']);
  }
}
