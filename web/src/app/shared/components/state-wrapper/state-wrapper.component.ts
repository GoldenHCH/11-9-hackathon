import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AlertBannerComponent } from '../alert-banner/alert-banner.component';

@Component({
  selector: 'app-state-wrapper',
  imports: [MatButtonModule, MatIconModule, AlertBannerComponent],
  templateUrl: './state-wrapper.component.html',
  styleUrl: './state-wrapper.component.scss',
})
export class StateWrapperComponent {
  @Input() public isLoading = false;
  @Input() public isEmpty = false;
  @Input() public errorMessage = '';
  @Input() public emptyIcon = 'inventory_2';
  @Input() public emptyMessage = 'Nothing here yet.';
  @Input() public emptyActionLabel = '';
  @Input() public skeletonRows = 3;
  @Output() public readonly retry = new EventEmitter<void>();
  @Output() public readonly emptyAction = new EventEmitter<void>();

  public get skeletonRowIndexes(): number[] {
    return Array.from({ length: this.skeletonRows }, (_, index) => index);
  }
}
