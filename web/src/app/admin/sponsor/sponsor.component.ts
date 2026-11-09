import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { BarListComponent } from '../../shared/components/bar-list/bar-list.component';
import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { SponsorNavComponent } from './sponsor-nav/sponsor-nav.component';
import {
  sponsorBoostBidLimits,
  sponsorBoostVisitLimits,
  sponsorDailyVisits,
  sponsorFunnel,
  sponsorKpis,
  sponsorName,
  sponsorReasons,
  sponsorRequestDefaults,
  sponsorRequestOptions,
  sponsorTier,
  sponsorWeeks,
} from './sponsor.constants';
import { ISponsorRequestOption } from './sponsor.interfaces';

@Component({
  selector: 'app-sponsor',
  imports: [
    BarListComponent,
    CurrencyPipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    ScreenToolbarComponent,
    SponsorNavComponent,
    StatTileComponent,
  ],
  templateUrl: './sponsor.component.html',
  styleUrls: ['./sponsor-page.scss', './sponsor.component.scss'],
})
export class SponsorComponent {
  public readonly name = sponsorName;
  public readonly tier = sponsorTier;
  public readonly kpis = sponsorKpis;
  public readonly reasons = sponsorReasons;
  public readonly options = sponsorRequestOptions;
  public readonly bidLimits = sponsorBoostBidLimits;
  public readonly visitLimits = sponsorBoostVisitLimits;

  public readonly days = sponsorDailyVisits.map((day) => ({ ...day, total: day.included + day.boosted }));
  public readonly dayMax = Math.max(...this.days.map((day) => day.total));

  public readonly funnelItems: IBarListItem[] = sponsorFunnel.map((step, index) => ({
    label: step.label,
    value: step.value,
    detail: index === 0 ? '' : `${Math.round((step.value / sponsorFunnel[index - 1].value) * 1000) / 10}%`,
  }));

  public readonly weeks = sponsorWeeks;
  public readonly weekMax = Math.max(...sponsorWeeks.map((week) => week.deals));

  public readonly requestForm = new FormGroup({
    boostBid: new FormControl(sponsorRequestDefaults.boostBid, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(sponsorBoostBidLimits.min), Validators.max(sponsorBoostBidLimits.max)],
    }),
    boostVisits: new FormControl(sponsorRequestDefaults.boostVisits, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(sponsorBoostVisitLimits.min), Validators.max(sponsorBoostVisitLimits.max)],
    }),
    talkQuest: new FormControl(sponsorRequestDefaults.talkQuest, { nonNullable: true }),
    campfire: new FormControl(sponsorRequestDefaults.campfire, { nonNullable: true }),
    recapFeature: new FormControl(sponsorRequestDefaults.recapFeature, { nonNullable: true }),
  });

  public isSent = false;

  public get boostCost(): number {
    const { boostBid, boostVisits } = this.requestForm.getRawValue();

    return (boostBid || 0) * (boostVisits || 0);
  }

  public get total(): number {
    const value = this.requestForm.getRawValue();

    return this.boostCost + this.options.reduce((sum, option) => sum + value[option.key] * option.unitPrice, 0);
  }

  public quantity(option: ISponsorRequestOption): number {
    return this.requestForm.controls[option.key].value;
  }

  public step(option: ISponsorRequestOption, change: number): void {
    const control = this.requestForm.controls[option.key];

    control.setValue(Math.min(option.max, Math.max(0, control.value + change)));
    this.isSent = false;
  }

  public send(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.isSent = true;
  }
}
