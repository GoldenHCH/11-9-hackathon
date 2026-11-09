import { Component, Input, OnChanges } from '@angular/core';
import { IHourCount } from '../../core/interfaces/exhibitor.interfaces';
import { StaffHelper } from '../staff.helper';
import { IHourBar } from '../staff.interfaces';

@Component({
  selector: 'app-hour-chart',
  templateUrl: './hour-chart.component.html',
  styleUrl: './hour-chart.component.scss',
})
export class HourChartComponent implements OnChanges {
  @Input({ required: true }) public hours: IHourCount[] = [];

  public bars: IHourBar[] = [];
  public summary = '';

  public ngOnChanges(): void {
    const largest = Math.max(0, ...this.hours.map((hour) => hour.visits));

    this.bars = this.hours.map((hour) => ({
      label: StaffHelper.hourLabel(hour.hour),
      visits: hour.visits,
      percent: largest > 0 ? Math.round((hour.visits / largest) * 100) : 0,
    }));

    const total = this.bars.reduce((sum, bar) => sum + bar.visits, 0);
    const peak = this.bars.find((bar) => bar.visits === largest && largest > 0);

    this.summary = peak
      ? `Visits by hour: ${total} in total, busiest at ${peak.label} with ${peak.visits}.`
      : 'Visits by hour: no visits yet today.';
  }
}
