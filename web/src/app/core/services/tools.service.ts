import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoadingService } from './loading.service';

interface IFixtureFile<TResult> {
  response?: TResult;
  variants?: Record<string, { response?: TResult } | TResult>;
}

export interface IToolCallOptions {
  variant?: string;
}

@Injectable({ providedIn: 'root' })
export class ToolsService {
  private readonly _http = inject(HttpClient);
  private readonly _loadingService = inject(LoadingService);

  public call<TResult>(toolName: string, input: object = {}, options: IToolCallOptions = {}): Observable<TResult> {
    const request = environment.useFixtures
      ? this._http.get<IFixtureFile<TResult> | TResult>(`/fixtures/${toolName}.json`).pipe(
          delay(environment.fixtureDelayMs),
          map((file) => this._unwrapFixture(file, options.variant)),
        )
      : this._http.post<TResult>(`${environment.apiBaseUrl}/tools/${toolName}`, input);

    return this._loadingService.track(request);
  }

  private _unwrapFixture<TResult>(file: IFixtureFile<TResult> | TResult, variant: string | undefined): TResult {
    if (typeof file !== 'object' || file === null || !('response' in file)) {
      return file as TResult;
    }

    const fixture = file as IFixtureFile<TResult>;
    const chosen = variant ? fixture.variants?.[variant] : undefined;

    if (chosen && typeof chosen === 'object' && 'response' in chosen) {
      return (chosen as { response: TResult }).response;
    }

    return (chosen as TResult | undefined) ?? (fixture.response as TResult);
  }
}
