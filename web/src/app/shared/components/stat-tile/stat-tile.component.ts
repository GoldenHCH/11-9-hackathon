import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-tile',
  imports: [MatIconModule],
  templateUrl: './stat-tile.component.html',
  styleUrl: './stat-tile.component.scss',
})
export class StatTileComponent {
  @Input({ required: true }) public label = '';
  @Input({ required: true }) public value: string | number = '';
  @Input() public detail = '';
  @Input() public icon = '';
}
