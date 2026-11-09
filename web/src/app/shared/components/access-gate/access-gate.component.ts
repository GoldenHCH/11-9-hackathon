import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AlertBannerComponent } from '../alert-banner/alert-banner.component';

@Component({
  selector: 'app-access-gate',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AlertBannerComponent],
  templateUrl: './access-gate.component.html',
  styleUrl: './access-gate.component.scss',
})
export class AccessGateComponent {
  @Input({ required: true }) public heading = '';
  @Input({ required: true }) public message = '';
  @Input() public icon = 'lock';
  @Input() public fieldLabel = 'Paste your link';
  @Input() public hint = '';
  @Input() public errorMessage = '';
  @Output() public readonly linkSubmitted = new EventEmitter<string>();
  @Output() public readonly errorDismissed = new EventEmitter<void>();

  public link = '';

  public submit(): void {
    const trimmed = this.link.trim();

    if (!trimmed) {
      return;
    }

    this.linkSubmitted.emit(trimmed);
    this.link = '';
  }
}
