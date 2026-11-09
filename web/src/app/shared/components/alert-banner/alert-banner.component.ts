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
  @Input({ required: true }) public message!: string;

  @Input() public dismissible = false;

  @Output() public readonly dismissed = new EventEmitter<void>();

  public onDismiss(): void {
    this.dismissed.emit();
  }
}
