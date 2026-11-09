import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ITalkNote } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { TalkNotesPanelComponent } from '../talk-notes-panel/talk-notes-panel.component';

@Component({
  selector: 'app-talk-notes-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, ScreenToolbarComponent, StateWrapperComponent, TalkNotesPanelComponent],
  templateUrl: './talk-notes-list.component.html',
  styleUrl: './talk-notes-list.component.scss',
})
export class TalkNotesListComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  public notes: ITalkNote[] = [];
  public editingTalkId: string | null = null;
  public isLoading = true;
  public errorMessage = '';

  public ngOnInit(): void {
    this.loadNotes();
  }

  public loadNotes(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<ITalkNote[]>('list_talk_notes', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (notes) => {
          this.notes = notes;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load talk notes', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onSaved(saved: ITalkNote): void {
    this.notes = this.notes.map((note) => (note.id === saved.id ? saved : note));
    this.editingTalkId = null;
  }
}
