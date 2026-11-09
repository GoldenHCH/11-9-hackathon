import { Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { IItineraryChangeResult, IScheduleSession } from '../../itinerary/itinerary.types';
import { IRoomSessions, RoomSessionsHelper } from '../room-sessions.helper';

interface IRoomSessionRow {
  label: string;
  session: IScheduleSession;
}

@Component({
  selector: 'app-room-session-card',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  templateUrl: './room-session-card.component.html',
  styleUrl: './room-session-card.component.scss',
})
export class RoomSessionCardComponent {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);

  @Input({ required: true }) public sessions!: IRoomSessions;
  @Input() public day = '';

  public busyIds = new Set<string>();
  public addedIds = new Set<string>();
  public errorMessage = '';

  public get rows(): IRoomSessionRow[] {
    const rows: IRoomSessionRow[] = [];

    if (this.sessions.now) {
      rows.push({ label: 'Now', session: this.sessions.now });
    }

    if (this.sessions.next) {
      rows.push({ label: 'Next', session: this.sessions.next });
    }

    return rows;
  }

  public range(session: IScheduleSession): string {
    return `${RoomSessionsHelper.clock(session.start)} – ${RoomSessionsHelper.clock(session.end)}`;
  }

  public isPlanned(session: IScheduleSession): boolean {
    return !!session.inItinerary || this.addedIds.has(session.id);
  }

  public add(session: IScheduleSession): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || this.busyIds.has(session.id)) {
      return;
    }

    this.busyIds.add(session.id);
    this.errorMessage = '';
    this._toolsService
      .call<IItineraryChangeResult>('add_to_itinerary', { attendeeId, talkId: session.id }, { background: true })
      .subscribe({
        next: (result) => {
          this.busyIds.delete(session.id);

          if (result.inItinerary) {
            this.addedIds.add(session.id);
          }
        },
        error: (error: unknown) => {
          console.error('add_to_itinerary failed', error);
          this.busyIds.delete(session.id);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }
}
