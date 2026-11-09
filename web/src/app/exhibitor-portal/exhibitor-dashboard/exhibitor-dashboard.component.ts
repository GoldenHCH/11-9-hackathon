import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subscription, catchError, map, of } from 'rxjs';
import { IExhibitorDashboard, IExhibitorVisitor, IPublicPlayer } from '../../core/interfaces/exhibitor.interfaces';
import { AccessKeyService } from '../../core/services/access-key.service';
import { ToolsService } from '../../core/services/tools.service';
import { AccessGateComponent } from '../../shared/components/access-gate/access-gate.component';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { BarListComponent } from '../../shared/components/bar-list/bar-list.component';
import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import { QrCodeComponent } from '../../shared/components/qr-code/qr-code.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { ExhibitorsHelper } from '../../exhibitors/exhibitors.helper';
import { HourChartComponent } from '../hour-chart/hour-chart.component';
import { exhibitorPollIntervalMs, staffExhibitorTypeLabels, staffKeyQueryParam } from '../staff.constants';
import { StaffHelper } from '../staff.helper';
import { IVisitorRow } from '../staff.interfaces';
import { VisitorListComponent } from '../visitor-list/visitor-list.component';

const questFunnelSteps = [
  { status: 'offered', label: 'Offered' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'completed', label: 'Completed' },
  { status: 'declined', label: 'Declined' },
] as const;

@Component({
  selector: 'app-exhibitor-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    AccessGateComponent,
    AlertBannerComponent,
    BarListComponent,
    HourChartComponent,
    QrCodeComponent,
    ScreenToolbarComponent,
    StatTileComponent,
    StateWrapperComponent,
    VisitorListComponent,
  ],
  templateUrl: './exhibitor-dashboard.component.html',
  styleUrl: './exhibitor-dashboard.component.scss',
})
export class ExhibitorDashboardComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _toolsService = inject(ToolsService);
  private readonly _accessKeyService = inject(AccessKeyService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _document = inject(DOCUMENT);

  private _key: string | null = null;
  private _isUnsavedKey = false;
  private _pollSubscription: Subscription | null = null;

  public outpostId = '';
  public dashboard: IExhibitorDashboard | null = null;
  public isLoading = false;
  public errorMessage = '';
  public showGate = false;
  public gateMessage = '';
  public liveMessage = '';
  public headerDetails = '';
  public boothLabel = '';
  public rankValue = '—';
  public rankDetail = '';
  public updatedText = '';
  public topicItems: IBarListItem[] = [];
  public levelItems: IBarListItem[] = [];
  public questItems: IBarListItem[] = [];
  public hereNowRows: IVisitorRow[] = [];
  public recentRows: IVisitorRow[] = [];

  public ngOnInit(): void {
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      this._start(params.get('outpostId') ?? '');
    });
  }

  public retry(): void {
    this._fetch().pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
  }

  public openLink(text: string): void {
    const link = StaffHelper.parseStaffLink(text, this._document.location.origin);

    if (!link) {
      this.gateMessage = 'That doesn’t look like a staff link. It should end in ?k=…';

      return;
    }

    if (link.outpostId && link.outpostId !== this.outpostId) {
      void this._router.navigate(['/exhibitor', link.outpostId], { queryParams: { [staffKeyQueryParam]: link.key } });

      return;
    }

    this._key = link.key;
    this._isUnsavedKey = true;
    this.showGate = false;
    this.gateMessage = '';
    this._startPolling();
  }

  public printQr(): void {
    window.print();
  }

  public copyLink(): void {
    const scanUrl = this.dashboard?.scanUrl;

    if (!scanUrl) {
      return;
    }

    this.liveMessage = '';
    navigator.clipboard
      .writeText(scanUrl)
      .then(() => {
        this.liveMessage = 'Copied';
      })
      .catch((error: unknown) => {
        console.error('Copy failed', error);
        this.liveMessage = 'Copy failed. Select the link below and copy it.';
      });
  }

  private _start(outpostId: string): void {
    this._stopPolling();
    this.outpostId = outpostId;
    this.dashboard = null;
    this.errorMessage = '';
    this.gateMessage = '';

    const queryKey = this._route.snapshot.queryParamMap.get(staffKeyQueryParam);

    if (queryKey) {
      this._key = queryKey;
      this._isUnsavedKey = true;
      void this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { [staffKeyQueryParam]: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else {
      this._key = this._accessKeyService.boothKey(outpostId);
      this._isUnsavedKey = false;
    }

    if (!this._key) {
      this.showGate = true;

      return;
    }

    this.showGate = false;
    this._startPolling();
  }

  private _startPolling(): void {
    this._stopPolling();
    this.isLoading = this.dashboard === null;
    this._pollSubscription = StaffHelper.visiblePoll(this._document, exhibitorPollIntervalMs, () => this._fetch())
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

    return this._toolsService
      .call<IExhibitorDashboard>('exhibitor_dashboard', { outpostId: this.outpostId, key })
      .pipe(
        map((dashboard) => {
          this._apply(dashboard, key);

          return false;
        }),
        catchError((error: unknown) => {
          this._handleError(error);

          return of(StaffHelper.isServerError(error));
        }),
      );
  }

  private _apply(dashboard: IExhibitorDashboard, key: string): void {
    this.dashboard = dashboard;
    this.isLoading = false;
    this.errorMessage = '';

    if (this._isUnsavedKey) {
      this._accessKeyService.saveBooth({ outpostId: this.outpostId, name: dashboard.exhibitor.name, key });
      this._isUnsavedKey = false;
    }

    const exhibitor = dashboard.exhibitor;
    const boothText = exhibitor.boothNumber ? ExhibitorsHelper.boothLabel(exhibitor) : '';
    const place = [exhibitor.hall ? ExhibitorsHelper.hallLabel(exhibitor.hall) : exhibitor.building, exhibitor.zone].filter(
      (part): part is string => Boolean(part),
    );

    this.boothLabel = boothText ? `${boothText} · ${exhibitor.name}` : exhibitor.name;
    this.headerDetails = [exhibitor.tier || staffExhibitorTypeLabels[exhibitor.exhibitorType], boothText, ...place]
      .filter((part) => part.length > 0)
      .join(' · ');
    this.rankValue = dashboard.rank ? `#${dashboard.rank.position}` : '—';
    this.rankDetail = dashboard.rank ? `of ${dashboard.rank.of} booths today` : 'No visits ranked yet';
    this.updatedText = `Updated ${StaffHelper.clockTime(dashboard.generatedAt)}`;
    this.topicItems = dashboard.visitorTopics.map((facet) => ({ label: facet.value, value: facet.count }));
    this.levelItems = dashboard.visitorLevels.map((facet) => ({ label: facet.value, value: facet.count }));
    this.questItems = questFunnelSteps.map((step) => ({ label: step.label, value: dashboard.quests[step.status] ?? 0 }));

    const nowMs = Date.now();

    this.recentRows = dashboard.recentVisitors.map((visitor) => this._visitorRow(visitor, nowMs));
    this.hereNowRows = dashboard.hereNow.map((player) => {
      const latestVisit = dashboard.recentVisitors.find((visitor) => visitor.player.id === player.id);

      return latestVisit ? this._visitorRow(latestVisit, nowMs) : this._playerRow(player, '', false);
    });
  }

  private _handleError(error: unknown): void {
    console.error('Booth dashboard failed to load', error);

    const badKeyMessage = StaffHelper.badKeyMessage(error);

    if (badKeyMessage) {
      this._forgetKey();
      this.gateMessage = badKeyMessage;
      this.showGate = true;
      this.isLoading = false;
      this.dashboard = null;

      return;
    }

    this.isLoading = false;
    this.errorMessage = StaffHelper.errorMessage(error, 'The booth dashboard didn’t load. Check your connection and try again.');
  }

  private _forgetKey(): void {
    this._stopPolling();

    const savedBooth = this._accessKeyService.savedBooths.find((booth) => booth.outpostId === this.outpostId);

    if (savedBooth && savedBooth.key === this._key) {
      this._accessKeyService.forgetBooth(this.outpostId);
    } else if (this._key !== null && this._key === this._accessKeyService.adminKey) {
      this._accessKeyService.clearAdminKey();
    }

    this._key = null;
    this._isUnsavedKey = false;
  }

  private _visitorRow(visitor: IExhibitorVisitor, nowMs: number): IVisitorRow {
    return this._playerRow(visitor.player, StaffHelper.timeAgo(visitor.at, nowMs), visitor.firstTimer);
  }

  private _playerRow(player: IPublicPlayer, when: string, firstTimer: boolean): IVisitorRow {
    return {
      id: player.id,
      handle: player.handle,
      faceSeed: player.faceSeed,
      levelName: player.levelName,
      when,
      firstTimer,
    };
  }
}
