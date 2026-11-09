import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { ITalkNote } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';

const noteMaxChars = 2000;
const takeawayMaxChars = 280;
const maxTakeaways = 10;

@Component({
  selector: 'app-talk-notes-panel',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, AlertBannerComponent],
  templateUrl: './talk-notes-panel.component.html',
  styleUrl: './talk-notes-panel.component.scss',
})
export class TalkNotesPanelComponent implements OnChanges {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  @Input({ required: true }) public talkId = '';
  @Input() public note: ITalkNote | null = null;
  @Output() public readonly saved = new EventEmitter<ITalkNote>();

  public readonly noteMaxChars = noteMaxChars;
  public readonly takeawayMaxChars = takeawayMaxChars;
  public readonly maxTakeaways = maxTakeaways;
  public text = '';
  public takeaways: string[] = [''];
  public isLoading = false;
  public isSaving = false;
  public errorMessage = '';
  public savedAt = '';

  public ngOnChanges(): void {
    if (this.note) {
      this._apply(this.note);

      return;
    }

    this._load();
  }

  public addTakeaway(): void {
    if (this.takeaways.length < maxTakeaways) {
      this.takeaways = [...this.takeaways, ''];
    }
  }

  public removeTakeaway(index: number): void {
    this.takeaways = this.takeaways.filter((_, position) => position !== index);

    if (this.takeaways.length === 0) {
      this.takeaways = [''];
    }
  }

  public onSave(): void {
    if (this.isSaving || !this.talkId) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this._toolsService
      .call<ITalkNote>('save_talk_note', {
        attendeeId: this._meService.attendeeId,
        talkId: this.talkId,
        note: this.text.trim(),
        takeaways: this.takeaways.map((takeaway) => takeaway.trim()).filter((takeaway) => takeaway !== ''),
      })
      .pipe(
        finalize(() => (this.isSaving = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (note) => {
          this._apply(note);
          this.savedAt = note.updatedAt;
          this.saved.emit(note);
        },
        error: (error: unknown) => {
          console.error('Could not save the talk note', error);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }

  private _load(): void {
    if (!this.talkId) {
      return;
    }

    this.isLoading = true;
    this._toolsService
      .call<ITalkNote[]>('list_talk_notes', { attendeeId: this._meService.attendeeId, talkId: this.talkId }, { background: true })
      .pipe(
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (notes) => {
          const [existing] = notes;

          if (existing) {
            this._apply(existing);
          }
        },
        error: (error: unknown) => {
          console.error('Could not load the talk note', error);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }

  private _apply(note: ITalkNote): void {
    this.text = note.note;
    this.takeaways = note.takeaways.length ? [...note.takeaways] : [''];
  }
}
