import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BarListComponent } from '../../shared/components/bar-list/bar-list.component';
import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import {
  sponsorAddOns,
  sponsorAuction,
  sponsorAuctionContext,
  sponsorAverageTouchPoints,
  sponsorDailyVisits,
  sponsorFunnel,
  sponsorIncluded,
  sponsorKpis,
  sponsorName,
  sponsorReasons,
  sponsorStories,
  sponsorTier,
  sponsorTouchPoints,
  sponsorWeeks,
} from './sponsor.constants';

@Component({
  selector: 'app-sponsor',
  imports: [
    BarListComponent,
    CurrencyPipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    PercentPipe,
    PixelFaceComponent,
    RouterLink,
    ScreenToolbarComponent,
    StatTileComponent,
  ],
  templateUrl: './sponsor.component.html',
  styleUrl: './sponsor.component.scss',
})
export class SponsorComponent {
  public readonly name = sponsorName;
  public readonly tier = sponsorTier;
  public readonly kpis = sponsorKpis;
  public readonly included = sponsorIncluded;
  public readonly addOns = sponsorAddOns;
  public readonly auctionContext = sponsorAuctionContext;
  public readonly touchPoints = sponsorTouchPoints;
  public readonly averageTouchPoints = sponsorAverageTouchPoints;
  public readonly reasons = sponsorReasons;
  public readonly stories = sponsorStories;

  public readonly days = sponsorDailyVisits.map((day) => ({ ...day, total: day.included + day.boosted }));
  public readonly dayMax = Math.max(...this.days.map((day) => day.total));
  public readonly includedTotal = this.days.reduce((sum, day) => sum + day.included, 0);
  public readonly boostedTotal = this.days.reduce((sum, day) => sum + day.boosted, 0);

  public readonly funnelItems: IBarListItem[] = sponsorFunnel.map((step, index) => ({
    label: step.label,
    value: step.value,
    detail: index === 0 ? '' : `${Math.round((step.value / sponsorFunnel[index - 1].value) * 1000) / 10}% kept`,
  }));

  public readonly auction = sponsorAuction.map((row) => ({ ...row, rank: Math.round(row.maxBid * row.relevance * 100) / 100 }));

  public readonly weeks = sponsorWeeks;
  public readonly weekMax = Math.max(...sponsorWeeks.map((week) => week.deals));
  public readonly totalDeals = sponsorWeeks.reduce((sum, week) => sum + week.deals, 0);
  public readonly dealsBy30 = this._dealsThroughWeek(4);
  public readonly dealsBy60 = this._dealsThroughWeek(9);

  private _dealsThroughWeek(lastWeek: number): number {
    return sponsorWeeks.filter((week) => week.week <= lastWeek).reduce((sum, week) => sum + week.deals, 0);
  }
}
