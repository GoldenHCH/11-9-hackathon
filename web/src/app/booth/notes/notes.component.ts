import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IBoothNote, ISaveBoothNoteResult } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { BoothNoteFormComponent } from '../booth-note-form/booth-note-form.component';

@Component({
  selector: 'app-notes',
  imports: [RouterLink, MatButtonModule, MatIconModule, BoothNoteFormComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
})
export class NotesComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  public notes: IBoothNote[] = [];
  public isLoading = true;
  public errorMessage = '';
  public editingNoteId: string | null = null;
  public savedMessage = '';

  public ngOnInit(): void {
    this.loadNotes();
  }

  public loadNotes(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IBoothNote[]>('list_booth_notes', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (notes) => {
          this.notes = notes;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load booth notes', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onNoteSaved(result: ISaveBoothNoteResult): void {
    this.notes = this.notes.map((note) => (note.id === result.note.id ? result.note : note));
    this.editingNoteId = null;
    this.savedMessage = result.message;
  }

  public openMap(): void {
    void this._router.navigate(['/map']);
  }
}
