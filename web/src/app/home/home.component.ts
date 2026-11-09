import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, Observable, catchError, finalize, map, of, startWith, switchMap } from 'rxjs';

import { HttpErrorHelper } from '../core/helpers/http-error.helper';
import { HealthService } from '../core/services/health.service';
import { LoadingService } from '../core/services/loading.service';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { HomeHelper } from './home.helper';
import { IHealthViewState } from './home.interfaces';

@Component({
  selector: 'app-home',
  imports: [AlertBannerComponent, AsyncPipe, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly _healthService = inject(HealthService);
  private readonly _loadingService = inject(LoadingService);
  private readonly _refresh$ = new BehaviorSubject<void>(undefined);

  public readonly healthState$: Observable<IHealthViewState> = this._refresh$.pipe(
    switchMap(() => this._loadHealthState()),
  );

  public onRetry(): void {
    this._refresh$.next();
  }

  private _loadHealthState(): Observable<IHealthViewState> {
    this._loadingService.show();

    return this._healthService.getHealth().pipe(
      map((health) => HomeHelper.toReadyState(health)),
      catchError((error: unknown) => {
        console.error('Failed to load API health', error);

        return of<IHealthViewState>({ phase: 'error', errorMessage: HttpErrorHelper.getFriendlyMessage(error) });
      }),
      finalize(() => this._loadingService.hide()),
      startWith<IHealthViewState>({ phase: 'loading' }),
    );
  }
}
