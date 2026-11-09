import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoadingService } from './loading.service';

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private readonly _http = inject(HttpClient);
  private readonly _loadingService = inject(LoadingService);

  public call<TResult>(toolName: string, input: object = {}): Observable<TResult> {
    const request = environment.useFixtures
      ? this._http.get<TResult>(`/fixtures/${toolName}.json`).pipe(delay(environment.fixtureDelayMs))
      : this._http.post<TResult>(`${environment.apiBaseUrl}/tools/${toolName}`, input);

    return this._loadingService.track(request);
  }
}
