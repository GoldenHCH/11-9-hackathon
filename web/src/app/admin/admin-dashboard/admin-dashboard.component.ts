import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subscription, catchError, map, of } from 'rxjs';
import { IAdminOverview, IExhibitorGroupStat, IExhibitorStatRow } from '../../core/interfaces/exhibitor.interfaces';
import { AccessKeyService } from '../../core/services/access-key.service';
import { ToolsService } from '../../core/services/tools.service';
import { staffExhibitorTierOrder, adminPollIntervalMs, staffKeyQueryParam, staffQuietTiers } from '../../exhibitor-portal/staff.constants';
import { StaffHelper } from '../../exhibitor-portal/staff.helper';
import { AccessGateComponent } from '../../shared/components/access-gate/access-gate.component';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { BarListComponent } from '../../shared/components/bar-list/bar-list.component';
import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import {
  adminMeetFunnelSteps,
  adminQuestFunnelSteps,
  adminQuietBoothLimit,
  adminTopBoothCount,
  adminXpTypeLabels,
} from '../admin.constants';
import { IAdminKpi, IBoothLink, IBossRow } from '../admin.interfaces';
import { BoothTableComponent } from '../booth-table/booth-table.component';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    AccessGateComponent,
    AlertBannerComponent,
    BarListComponent,
    BoothTableComponent,
    ScreenToolbarComponent,
    StatTileComponent,
    StateWrapperComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _toolsService = inject(ToolsService);
  private readonly _accessKeyService = inject(AccessKeyService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _document = inject(DOCUMENT);

  private _key: string | null = null;
  private _pollSubscription: Subscription | null = null;

  public overview: IAdminOverview | null = null;
  public isLoading = false;
  public errorMessage = '';
  public showGate = false;
  public gateMessage = '';
  public updatedText = '';
  public kpis: IAdminKpi[] = [];
  public xpItems: IBarListItem[] = [];
  public meetItems: IBarListItem[] = [];
  public questItems: IBarListItem[] = [];
  public roomItems: IBarListItem[] = [];
  public bosses: IBossRow[] = [];
  public tierItems: IBarListItem[] = [];
  public zoneItems: IBarListItem[] = [];
  public topBooths: IBarListItem[] = [];
  public quietBooths: IBoothLink[] = [];
  public quietBoothsHidden = 0;
  public tableRows: IExhibitorStatRow[] = [];

  public ngOnInit(): void {
    const queryKey = this._route.snapshot.queryParamMap.get(staffKeyQueryParam);

    if (queryKey) {
      this._accessKeyService.setAdminKey(queryKey);
      void this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { [staffKeyQueryParam]: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    this._key = queryKey ?? this._accessKeyService.adminKey;

    if (!this._key) {
      this.showGate = true;

      return;
    }

    this._startPolling();
  }

  public retry(): void {
    this._fetch().pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
  }

  public openLink(text: string): void {
    const link = StaffHelper.parseStaffLink(text, this._document.location.origin);

    if (!link) {
      this.gateMessage = 'That doesn’t look like an organizer link. It should end in /admin?k=…';

      return;
    }

    this._accessKeyService.setAdminKey(link.key);
    this._key = link.key;
    this.showGate = false;
    this.gateMessage = '';
    this._startPolling();
  }

  public forgetKey(): void {
    this._stopPolling();
    this._accessKeyService.clearAdminKey();
    this._key = null;
    this.overview = null;
    this.showGate = true;
  }

  private _startPolling(): void {
    this._stopPolling();
    this.isLoading = this.overview === null;
    this._pollSubscription = StaffHelper.visiblePoll(this._document, adminPollIntervalMs, () => this._fetch())
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe();
  }

  private _stopPolling(): void {
    this._pollSubscription?.unsubscribe();
    this._pollSubscription = null;
  }

  private _fetch(): Observable<boolean> {
    const key = this._key;

    if (!key) {
      return EMPTY;
    }

    return this._toolsService.call<IAdminOverview>('admin_overview', { key }).pipe(
      map((overview) => {
        this._apply(overview);

        return false;
      }),
      catchError((error: unknown) => {
        this._handleError(error);

        return of(StaffHelper.isServerError(error));
      }),
    );
  }

  private _handleError(error: unknown): void {
    console.error('Organizer overview failed to load', error);
    this.isLoading = false;

    const badKeyMessage = StaffHelper.badKeyMessage(error);

    if (badKeyMessage) {
      this.forgetKey();
      this.gateMessage = badKeyMessage;

      return;
    }

    this.errorMessage = StaffHelper.errorMessage(error, 'The organizer view didn’t load. Check your connection and try again.');
  }

  private _apply(overview: IAdminOverview): void {
    const stats = overview.stats;
    const booths = overview.exhibitors;

    this.overview = overview;
    this.isLoading = false;
    this.errorMessage = '';
    this.updatedText = `Updated ${StaffHelper.clockTime(overview.generatedAt)}`;
    this.kpis = [
      { label: 'Players', value: this._count(stats.players), detail: '', icon: 'groups' },
      { label: 'Check-ins today', value: this._count(stats.checkInsToday), detail: '', icon: 'login' },
      { label: 'XP today', value: this._count(stats.xpToday), detail: '', icon: 'bolt' },
      {
        label: 'Meets done',
        value: this._count(stats.meets['met'] ?? 0),
        detail: `${stats.meets['accepted'] ?? 0} accepted · ${stats.meets['proposed'] ?? 0} proposed`,
        icon: 'local_fire_department',
      },
      { label: 'Booth visits today', value: this._count(booths.visitsToday), detail: `${booths.uniqueVisitorsToday} unique players`, icon: 'storefront' },
      {
        label: 'Booths visited today',
        value: `${booths.visitedToday} of ${booths.total}`,
        detail: `${booths.sponsors} sponsors · ${booths.projects} projects`,
        icon: 'map',
      },
    ];
    this.xpItems = Object.entries(stats.xpByType)
      .map(([type, value]) => ({ label: adminXpTypeLabels[type] ?? type, value: value ?? 0 }))
      .sort((first, second) => second.value - first.value);
    this.meetItems = adminMeetFunnelSteps.map((step) => ({ label: step.label, value: stats.meets[step.key] ?? 0 }));
    this.questItems = adminQuestFunnelSteps.map((step) => ({ label: step.label, value: stats.quests[step.key] ?? 0 }));
    this.roomItems = stats.busiestRooms.map((room) => ({
      label: room.location.name,
      value: room.count,
      detail: room.location.building ?? '',
    }));
    this.bosses = stats.bosses.map((boss) => ({
      id: boss.talkId,
      title: boss.title ?? boss.talkId,
      status: boss.status,
      health: boss.health,
      maxHealth: boss.maxHealth,
      percent: boss.maxHealth > 0 ? Math.round((boss.health / boss.maxHealth) * 100) : 0,
      participants: boss.participants,
    }));
    this.tierItems = this._groupItems([...overview.byTier].sort((first, second) => this._tierRank(first) - this._tierRank(second)));
    this.zoneItems = this._groupItems([...overview.byZone].sort((first, second) => second.visits - first.visits));
    this.topBooths = [...overview.table]
      .filter((row) => row.visitsToday > 0)
      .sort((first, second) => second.visitsToday - first.visitsToday)
      .slice(0, adminTopBoothCount)
      .map((row) => ({
        label: row.exhibitor.name,
        value: row.visitsToday,
        detail: row.exhibitor.boothNumber ? `Booth ${row.exhibitor.boothNumber}` : '',
      }));

    const quietTiers: readonly string[] = staffQuietTiers;

    const quietRows = overview.table.filter((row) => quietTiers.includes(row.exhibitor.tier) && row.visitsToday === 0);

    this.quietBoothsHidden = Math.max(0, quietRows.length - adminQuietBoothLimit);
    this.quietBooths = quietRows.slice(0, adminQuietBoothLimit).map((row) => ({
        id: row.exhibitor.id,
        name: row.exhibitor.name,
        detail: [row.exhibitor.tier, row.exhibitor.boothNumber ? `Booth ${row.exhibitor.boothNumber}` : ''].filter(Boolean).join(' · '),
      }));
    this.tableRows = overview.table;
  }

  private _count(value: number): string {
    return value.toLocaleString('en-US');
  }

  private _groupItems(groups: IExhibitorGroupStat[]): IBarListItem[] {
    return groups.map((group) => ({
      label: group.value,
      value: group.visits,
      detail: `${group.exhibitors} booth${group.exhibitors === 1 ? '' : 's'}`,
    }));
  }

  private _tierRank(group: IExhibitorGroupStat): number {
    const knownOrder: readonly string[] = staffExhibitorTierOrder;
    const index = knownOrder.indexOf(group.value);

    return index === -1 ? knownOrder.length : index;
  }
}
