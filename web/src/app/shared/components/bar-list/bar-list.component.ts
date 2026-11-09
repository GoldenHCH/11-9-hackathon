import { Component, Input, OnChanges } from '@angular/core';
import { IBarListItem, IBarListRow } from './bar-list.interfaces';

@Component({
  selector: 'app-bar-list',
  templateUrl: './bar-list.component.html',
  styleUrl: './bar-list.component.scss',
})
export class BarListComponent implements OnChanges {
  @Input({ required: true }) public items: IBarListItem[] = [];
  @Input() public label = '';
  @Input() public unit = '';
  @Input() public emptyMessage = 'Nothing yet.';
  @Input() public tone: 'primary' | 'accent' = 'primary';

  public rows: IBarListRow[] = [];

  public ngOnChanges(): void {
    const largest = Math.max(0, ...this.items.map((item) => item.value));

    this.rows = this.items.map((item) => ({
      ...item,
      percent: largest > 0 ? Math.max(item.value > 0 ? 2 : 0, Math.round((item.value / largest) * 100)) : 0,
    }));
  }
}
