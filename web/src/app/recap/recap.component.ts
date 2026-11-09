import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IRecap } from '../core/api.types';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { PixelFaceComponent } from '../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../shared/components/state-wrapper/state-wrapper.component';

@Component({
  selector: 'app-recap',
  imports: [DatePipe, MatButtonModule, MatIconModule, PixelFaceComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './recap.component.html',
  styleUrl: './recap.component.scss',
})
export class RecapComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _sanitizer = inject(DomSanitizer);
  private readonly _destroyRef = inject(DestroyRef);

  public recap: IRecap | null = null;
  public emailPreview: SafeHtml | null = null;
  public isLoading = true;
  public errorMessage = '';
  public showEmail = false;

  public ngOnInit(): void {
    this.loadRecap();
  }

  public get isEmpty(): boolean {
    return !!this.recap && !this.recap.people.length && !this.recap.booths.length && !this.recap.talks.length;
  }

  public loadRecap(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IRecap>('recap', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (recap) => {
          this.recap = recap;
          this.emailPreview = this._sanitizer.bypassSecurityTrustHtml(recap.emailHtml);
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not build the recap', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }
}
