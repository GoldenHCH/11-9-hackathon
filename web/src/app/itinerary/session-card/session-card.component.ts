import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { ItineraryHelper } from '../itinerary.helper';
import { IScheduleSession } from '../itinerary.types';

@Component({
  selector: 'app-session-card',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  templateUrl: './session-card.component.html',
  styleUrl: './session-card.component.scss',
})
export class SessionCardComponent {
  @Input({ required: true }) public session!: IScheduleSession;
  @Input() public isPlanned = false;
  @Input() public isBusy = false;
  @Input() public isQuestBusy = false;
  @Input() public isQuestMade = false;
  @Input() public isLive = false;
  @Output() public readonly togglePlan = new EventEmitter<IScheduleSession>();
  @Output() public readonly makeQuest = new EventEmitter<IScheduleSession>();

  public get timeRange(): string {
    return ItineraryHelper.range(this.session.start, this.session.end);
  }

  public get place(): string {
    return `${this.session.room} · ${this.session.building} ${ItineraryHelper.shortLevel(this.session.level)}`;
  }

  public get speakers(): string {
    return this.session.speakers.join(', ');
  }
}
