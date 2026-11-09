import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { IBoothNote, ISaveBoothNoteResult } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';

const minimumNoteLength = 20;
const maximumNoteLength = 1000;

@Component({
  selector: 'app-booth-note-form',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    AlertBannerComponent,
  ],
  templateUrl: './booth-note-form.component.html',
  styleUrl: './booth-note-form.component.scss',
})
export class BoothNoteFormComponent implements OnChanges {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  @Input({ required: true }) public note!: IBoothNote;
  @Input() public showCancel = false;
  @Output() public readonly saved = new EventEmitter<ISaveBoothNoteResult>();
  @Output() public readonly cancelled = new EventEmitter<void>();

  public readonly minimumNoteLength = minimumNoteLength;
  public readonly maximumNoteLength = maximumNoteLength;
  public liked = '';
  public thoughts = '';
  public followUp = false;
  public isSubmitting = false;
  public saveError = '';

  public ngOnChanges(): void {
    this.liked = this.note.liked ?? '';
    this.thoughts = this.note.thoughts ?? '';
    this.followUp = this.note.followUp;
  }

  public get noteLength(): number {
    return this.liked.trim().length + this.thoughts.trim().length;
  }

  public get earnsXp(): boolean {
    return this.note.xpAwarded === 0 && this.noteLength >= minimumNoteLength;
  }

  public onSubmit(): void {
    if (!this.liked.trim() || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.saveError = '';
    this._toolsService
      .call<ISaveBoothNoteResult>('save_booth_note', {
        attendeeId: this._meService.attendeeId,
        locationId: this.note.locationId,
        liked: this.liked.trim(),
        thoughts: this.thoughts.trim() || undefined,
        followUp: this.followUp,
      })
      .pipe(
        finalize(() => (this.isSubmitting = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => this.saved.emit(result),
        error: (error: unknown) => {
          console.error('Could not save the booth note', error);
          this.saveError = ApiErrorHelper.message(error);
        },
      });
  }
}
