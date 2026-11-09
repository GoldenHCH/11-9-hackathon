import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, Subscription, catchError, debounceTime, filter, switchMap, tap, throwError } from 'rxjs';
import { IExhibitorCard, IExhibitorDirectory, IListExhibitorsInput } from '../../core/interfaces/exhibitor.interfaces';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { BoothCardComponent } from '../booth-card/booth-card.component';
import { exhibitorDirectorySettings, exhibitorErrorCodes, staleAttendeeMessage } from '../exhibitors.constants';
import { ExhibitorsHelper } from '../exhibitors.helper';
import { IExhibitorFilters, IFacetGroup, IFacetOption } from '../exhibitors.interfaces';
import { ExhibitorFilterKey } from '../exhibitors.types';

@Component({
  selector: 'app-exhibitor-directory',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RouterLink,
    AlertBannerComponent,
    BoothCardComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './exhibitor-directory.component.html',
  styleUrl: './exhibitor-directory.component.scss',
})
export class ExhibitorDirectoryComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _queryChanges = new Subject<string>();
  private readonly _reloads = new Subject<void>();
  private _appliedQuery = '';
  private _loadMoreSubscription: Subscription | null = null;

  public attendeeId: string | null = null;
  public staleLinkMessage = '';
  public query = '';
  public filters: IExhibitorFilters = {};
  public exhibitors: IExhibitorCard[] = [];
  public total = 0;
  public facetGroups: IFacetGroup[] = [];
  public hasLoaded = false;
  public errorMessage = '';
  public isLoadingMore = false;
  public showFilters = false;
  public loadMoreError = '';

  public ngOnInit(): void {
    this.attendeeId = this._meService.attendeeId;

    this._queryChanges
      .pipe(
        debounceTime(exhibitorDirectorySettings.SEARCH_DEBOUNCE_MS),
        filter((value) => value !== this._appliedQuery),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => this.reload());

    this._reloads
      .pipe(
        tap(() => (this.errorMessage = '')),
        switchMap(() =>
          this._fetch(0).pipe(
            catchError((error: unknown) => {
              if (this.attendeeId && ExhibitorsHelper.errorCode(error) === exhibitorErrorCodes.UNKNOWN_ATTENDEE) {
                this._forgetAttendee();

                return this._fetch(0);
              }

              return throwError(() => error);
            }),
            catchError((error: unknown) => {
              console.error('list_exhibitors failed', error);
              this.errorMessage = 'The booth list didn’t load. Check your connection and try again.';
              this.hasLoaded = true;

              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((directory) => {
        this.exhibitors = directory.exhibitors;
        this._applyDirectory(directory);
      });

    this.reload();
  }

  public get hasFilters(): boolean {
    return ExhibitorsHelper.hasFilters(this.filters) || this.query.trim().length > 0;
  }

  public get activeFilterCount(): number {
    return Object.values(this.filters).filter((value) => value !== undefined && value !== '').length;
  }

  public get hasMore(): boolean {
    return this.exhibitors.length < this.total;
  }

  public get subtitle(): string {
    if (!this.hasLoaded || this.errorMessage) {
      return 'Every sponsor and project on the expo floor';
    }

    const noun = this.total === 1 ? 'booth' : 'booths';

    return this.hasFilters ? `${this.total} ${noun} match` : `${this.total} ${noun} on the expo floor`;
  }

  public onQueryChange(value: string): void {
    this.query = value;
    this._queryChanges.next(value.trim());
  }

  public clearQuery(): void {
    this.onQueryChange('');
  }

  public isSelected(key: ExhibitorFilterKey, option: IFacetOption): boolean {
    return this.filters[key] === option.value;
  }

  public toggleFilter(key: ExhibitorFilterKey, option: IFacetOption): void {
    this.filters = { ...this.filters, [key]: this.isSelected(key, option) ? undefined : option.value };
    this.reload();
  }

  public clearFilters(): void {
    this.filters = {};
    this.query = '';
    this.reload();
  }

  public reload(): void {
    this._appliedQuery = this.query.trim();
    this._loadMoreSubscription?.unsubscribe();
    this.isLoadingMore = false;
    this.loadMoreError = '';
    this._reloads.next();
  }

  public loadMore(): void {
    if (this.isLoadingMore || !this.hasMore) {
      return;
    }

    this.isLoadingMore = true;
    this.loadMoreError = '';
    this._loadMoreSubscription = this._fetch(this.exhibitors.length)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (directory) => {
          const known = new Set(this.exhibitors.map((exhibitor) => exhibitor.id));
          const added = directory.exhibitors.filter((exhibitor) => !known.has(exhibitor.id));

          this.exhibitors = [...this.exhibitors, ...added];
          this._applyDirectory(directory);

          if (added.length === 0) {
            this.total = this.exhibitors.length;
          }
          this.isLoadingMore = false;
        },
        error: (error: unknown) => {
          console.error('list_exhibitors next page failed', error);
          this.loadMoreError = 'More booths didn’t load. Try again.';
          this.isLoadingMore = false;
        },
      });
  }

  private _fetch(offset: number): Observable<IExhibitorDirectory> {
    const type = this.filters.type;
    const input: IListExhibitorsInput = {
      query: this._appliedQuery || undefined,
      type: type && ExhibitorsHelper.isExhibitorType(type) ? type : undefined,
      tier: this.filters.tier,
      zone: this.filters.zone,
      topic: this.filters.topic,
      attendeeId: this.attendeeId ?? undefined,
      limit: exhibitorDirectorySettings.PAGE_SIZE,
      offset,
    };

    return this._toolsService.call<IExhibitorDirectory>('list_exhibitors', input);
  }

  private _forgetAttendee(): void {
    this._meService.clear();
    this.attendeeId = null;
    this.staleLinkMessage = staleAttendeeMessage;
  }

  private _applyDirectory(directory: IExhibitorDirectory): void {
    this.total = directory.total;
    this.facetGroups = ExhibitorsHelper.facetGroups(directory.facets, this.filters);
    this.hasLoaded = true;
  }
}
