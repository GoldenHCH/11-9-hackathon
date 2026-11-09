import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IScheduleSession } from '../../itinerary/itinerary.types';

@Component({
  selector: 'app-now-next-bar',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './now-next-bar.component.html',
  styleUrl: './now-next-bar.component.scss',
})
export class NowNextBarComponent {
  @Input() public isActive = false;
  @Input() public isLoading = false;
  @Input() public errorMessage = '';
  @Input() public liveSessions: IScheduleSession[] = [];
  @Output() public readonly toggled = new EventEmitter<void>();
  @Output() public readonly retry = new EventEmitter<void>();
  @Output() public readonly sessionPicked = new EventEmitter<IScheduleSession>();
}
