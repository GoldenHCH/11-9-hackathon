import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ILocation } from '../../core/api.types';
import { DemoScanHelper, IDemoScanGroup } from '../demo-scan.helper';

@Component({
  selector: 'app-demo-scan-picker',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './demo-scan-picker.component.html',
  styleUrl: './demo-scan-picker.component.scss',
})
export class DemoScanPickerComponent implements OnInit {
  @Input() public locations: ILocation[] = [];
  @Input() public isLoading = false;
  @Input() public pendingLocationId: string | null = null;
  @Input() public errorMessage = '';
  @Output() public readonly picked = new EventEmitter<ILocation>();
  @Output() public readonly closed = new EventEmitter<void>();

  @ViewChild('searchInput', { static: true }) private readonly _searchInput?: ElementRef<HTMLInputElement>;

  public query = '';

  public ngOnInit(): void {
    setTimeout(() => this._searchInput?.nativeElement.focus());
  }

  public get groups(): IDemoScanGroup[] {
    return DemoScanHelper.groups(this.locations, this.query);
  }

  public detail(location: ILocation): string {
    return DemoScanHelper.detail(location);
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (!this.pendingLocationId) {
      this.closed.emit();
    }
  }
}
