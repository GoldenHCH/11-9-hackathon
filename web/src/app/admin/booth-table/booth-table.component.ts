import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { ExhibitorType, IExhibitorStatRow } from '../../core/interfaces/exhibitor.interfaces';
import { staffExhibitorTierOrder, staffExhibitorTypeLabels } from '../../exhibitor-portal/staff.constants';
import { StaffHelper } from '../../exhibitor-portal/staff.helper';
import { QrCodeComponent } from '../../shared/components/qr-code/qr-code.component';
import { adminBoothSortOptions } from '../admin.constants';
import { BoothSortKey } from '../admin.types';

const boothTablePageSize = 25;

@Component({
  selector: 'app-booth-table',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    QrCodeComponent,
  ],
  templateUrl: './booth-table.component.html',
  styleUrl: './booth-table.component.scss',
})
export class BoothTableComponent implements OnChanges {
  private readonly _router = inject(Router);

  @Input({ required: true }) public rows: IExhibitorStatRow[] = [];

  public readonly sortOptions = adminBoothSortOptions;
  public readonly typeLabels = staffExhibitorTypeLabels;
  public readonly types: ExhibitorType[] = ['sponsor', 'project'];
  public query = '';
  public tierFilter = '';
  public typeFilter: ExhibitorType | '' = '';
  public sortKey: BoothSortKey = 'visits';
  public tiers: string[] = [];
  public filteredRows: IExhibitorStatRow[] = [];
  public visibleRows: IExhibitorStatRow[] = [];
  public visibleCount = boothTablePageSize;
  public openQrId: string | null = null;
  public liveMessage = '';

  public ngOnChanges(): void {
    const presentTiers = new Set(this.rows.map((row) => row.exhibitor.tier).filter((tier) => tier.length > 0));
    const knownOrder: readonly string[] = staffExhibitorTierOrder;

    this.tiers = [...presentTiers].sort((first, second) => this._tierRank(knownOrder, first) - this._tierRank(knownOrder, second));
    this.applyFilters();
  }

  public applyFilters(): void {
    const needle = this.query.trim().toLowerCase();
    const matching = this.rows.filter((row) => {
      const exhibitor = row.exhibitor;
      const matchesQuery =
        !needle || exhibitor.name.toLowerCase().includes(needle) || exhibitor.boothNumber.toLowerCase().includes(needle);

      return (
        matchesQuery &&
        (!this.tierFilter || exhibitor.tier === this.tierFilter) &&
        (!this.typeFilter || exhibitor.exhibitorType === this.typeFilter)
      );
    });

    this.filteredRows = matching.sort((first, second) => this._compare(first, second));
    this.visibleCount = boothTablePageSize;
    this._updateVisibleRows();
  }

  public showMore(): void {
    this.visibleCount += boothTablePageSize;
    this._updateVisibleRows();
  }

  private _updateVisibleRows(): void {
    this.visibleRows = this.filteredRows.slice(0, this.visibleCount);
  }

  public ariaSort(key: BoothSortKey): 'ascending' | 'descending' | null {
    if (this.sortKey !== key) {
      return null;
    }

    return key === 'name' ? 'ascending' : 'descending';
  }

  public openDashboard(row: IExhibitorStatRow): void {
    const path = StaffHelper.appPath(row.staffUrl, window.location.origin);

    if (path) {
      void this._router.navigateByUrl(path);
    }
  }

  public copyStaffLink(row: IExhibitorStatRow): void {
    this.liveMessage = '';
    navigator.clipboard
      .writeText(row.staffUrl)
      .then(() => {
        this.liveMessage = `Copied the staff link for ${row.exhibitor.name}`;
      })
      .catch((error: unknown) => {
        console.error('Copy failed', error);
        this.liveMessage = 'Copy failed. Open the dashboard and copy the address instead.';
      });
  }

  public toggleQr(row: IExhibitorStatRow): void {
    this.openQrId = this.openQrId === row.exhibitor.id ? null : row.exhibitor.id;
  }

  public printQr(): void {
    window.print();
  }

  private _compare(first: IExhibitorStatRow, second: IExhibitorStatRow): number {
    const byName = first.exhibitor.name.localeCompare(second.exhibitor.name);

    if (this.sortKey === 'visits') {
      return second.visitsToday - first.visitsToday || byName;
    }

    if (this.sortKey === 'unique') {
      return second.uniqueToday - first.uniqueToday || byName;
    }

    return byName;
  }

  private _tierRank(knownOrder: readonly string[], tier: string): number {
    const index = knownOrder.indexOf(tier);

    return index === -1 ? knownOrder.length : index;
  }
}
