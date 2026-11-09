import { Location } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-screen-toolbar',
  imports: [MatIconModule],
  templateUrl: './screen-toolbar.component.html',
  styleUrl: './screen-toolbar.component.scss',
})
export class ScreenToolbarComponent {
  private readonly _location = inject(Location);

  @Input({ required: true }) public title = '';
  @Input() public subtitle = '';
  @Input() public showBack = false;

  public goBack(): void {
    this._location.back();
  }
}
