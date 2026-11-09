import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { pendingScanStorageKey } from '../../app.constants';
import { IClientConfig, IDemoScanToken, ILocation, IWorld } from '../../core/api.types';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';

@Injectable({ providedIn: 'root' })
export class DemoScanService {
  private readonly _http = inject(HttpClient);
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private _enabled$: Observable<boolean> | null = null;
  private _locations$: Observable<ILocation[]> | null = null;

  public isEnabled(): Observable<boolean> {
    if (!this._enabled$) {
      this._enabled$ = this._http.get<IClientConfig>(`${environment.apiBaseUrl}/config`).pipe(
        map((config) => config.demoSimulateScans === true),
        catchError((error: unknown) => {
          console.error('Could not read the app config', error);

          return of(false);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this._enabled$;
  }

  public getLocations(): Observable<ILocation[]> {
    if (!this._locations$) {
      this._locations$ = this._toolsService.call<IWorld>('world', {}, { background: true }).pipe(
        map((world) => world.buildings.flatMap((building) => building.levels.flatMap((level) => level.rooms.map((room) => room.location)))),
        tap({ error: () => (this._locations$ = null) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this._locations$;
  }

  public simulate(locationId: string): Observable<string> {
    return this._toolsService.call<IDemoScanToken>('demo_scan_token', { locationId }).pipe(
      tap((result) => this.open(result.path)),
      map((result) => result.path),
    );
  }

  private open(path: string): void {
    if (this._meService.attendeeId) {
      void this._router.navigateByUrl(path);

      return;
    }

    try {
      sessionStorage.setItem(pendingScanStorageKey, path);
    } catch (error) {
      console.error('Could not save the pending scan', error);
    }

    void this._router.navigateByUrl(`/onboarding?next=${encodeURIComponent(path)}`);
  }
}
