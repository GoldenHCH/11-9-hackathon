import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToolName } from '../api.types';
import { LoadingService } from './loading.service';

interface IToolFixture<TResult> {
  response: TResult;
  variants?: Record<string, { response?: TResult } | TResult>;
}

export interface IToolCallOptions {
  background?: boolean;
  variant?: string;
}

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private readonly _http = inject(HttpClient);
  private readonly _loadingService = inject(LoadingService);

  public call<TResult>(toolName: ToolName, input: object = {}, options: IToolCallOptions = {}): Observable<TResult> {
    const request = environment.useFixtures
      ? this._http.get<IToolFixture<TResult>>(`/fixtures/${toolName}.json`).pipe(
          map((fixture) => this._unwrapFixture(fixture, options.variant)),
          delay(environment.fixtureDelayMs),
        )
      : this._http.post<TResult>(`${environment.apiBaseUrl}/tools/${toolName}`, input);

    return options.background ? request : this._loadingService.track(request);
  }

  private _unwrapFixture<TResult>(fixture: IToolFixture<TResult>, variant: string | undefined): TResult {
    const chosen = variant ? fixture.variants?.[variant] : undefined;

    if (chosen === undefined) {
      return fixture.response;
    }

    if (typeof chosen === 'object' && chosen !== null && 'response' in chosen) {
      return (chosen as { response: TResult }).response;
    }

    return chosen as TResult;
  }

  public upload<TResult>(path: string, form: FormData): Observable<TResult> {
    return this._http.post<TResult>(`${environment.apiBaseUrl}/${path}`, form);
  }
}
