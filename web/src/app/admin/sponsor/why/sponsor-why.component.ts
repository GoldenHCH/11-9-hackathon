import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PixelFaceComponent } from '../../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../../shared/components/screen-toolbar/screen-toolbar.component';
import { SponsorNavComponent } from '../sponsor-nav/sponsor-nav.component';
import {
  sponsorAddOns,
  sponsorAuction,
  sponsorAuctionContext,
  sponsorAverageTouchPoints,
  sponsorIncluded,
  sponsorName,
  sponsorStories,
  sponsorTier,
  sponsorTouchPoints,
} from '../sponsor.constants';

@Component({
  selector: 'app-sponsor-why',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    PercentPipe,
    PixelFaceComponent,
    RouterLink,
    ScreenToolbarComponent,
    SponsorNavComponent,
  ],
  templateUrl: './sponsor-why.component.html',
  styleUrls: ['../sponsor-page.scss', './sponsor-why.component.scss'],
})
export class SponsorWhyComponent {
  public readonly name = sponsorName;
  public readonly tier = sponsorTier;
  public readonly included = sponsorIncluded;
  public readonly addOns = sponsorAddOns;
  public readonly auctionContext = sponsorAuctionContext;
  public readonly touchPoints = sponsorTouchPoints;
  public readonly averageTouchPoints = sponsorAverageTouchPoints;
  public readonly stories = sponsorStories;
  public readonly auction = sponsorAuction.map((row) => ({ ...row, rank: Math.round(row.maxBid * row.relevance * 100) / 100 }));
}
