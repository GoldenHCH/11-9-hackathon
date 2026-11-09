import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { LoadingService } from '../../core/services/loading.service';
import { venueSchematicUrl } from '../venue.constants';
import { IVenueSchematic } from '../venue.interfaces';

@Injectable({ providedIn: 'root' })
export class VenueService {
  private readonly _http = inject(HttpClient);
  private readonly _loadingService = inject(LoadingService);
  private _schematic$: Observable<IVenueSchematic> | null = null;

  public getSchematic(): Observable<IVenueSchematic> {
    if (!this._schematic$) {
      this._schematic$ = this._loadingService
        .track(this._http.get<IVenueSchematic>(venueSchematicUrl))
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    return this._schematic$;
  }

  public reset(): void {
    this._schematic$ = null;
  }
}
