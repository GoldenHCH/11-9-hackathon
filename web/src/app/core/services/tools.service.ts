import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToolName } from '../api.types';
import { LoadingService } from './loading.service';

interface IToolFixture<TResult> {
  response: TResult;
}

interface IToolCallOptions {
  background?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private readonly _http = inject(HttpClient);
  private readonly _loadingService = inject(LoadingService);

  public call<TResult>(toolName: ToolName, input: object = {}, options: IToolCallOptions = {}): Observable<TResult> {
    const request = environment.useFixtures
      ? this._http.get<IToolFixture<TResult>>(`/fixtures/${toolName}.json`).pipe(
          map((fixture) => fixture.response),
          delay(environment.fixtureDelayMs),
        )
      : this._http.post<TResult>(`${environment.apiBaseUrl}/tools/${toolName}`, input);

    return options.background ? request : this._loadingService.track(request);
  }
}
