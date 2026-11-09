import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-alert-banner',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.scss',
})
export class AlertBannerComponent {
  @Input({ required: true }) public message = '';
  @Input() public actionLabel = '';
  @Input() public dismissible = true;
  @Output() public readonly action = new EventEmitter<void>();
  @Output() public readonly dismissed = new EventEmitter<void>();
}
