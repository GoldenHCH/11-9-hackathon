import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import { IHealthResponse } from '../interfaces/health.interfaces';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly _http = inject(HttpClient);

  public getHealth(): Observable<IHealthResponse> {
    return this._http.get<IHealthResponse>('/healthz').pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.error?.status === 'degraded') {
          return of(error.error as IHealthResponse);
        }

        return throwError(() => error);
      }),
    );
  }
}
