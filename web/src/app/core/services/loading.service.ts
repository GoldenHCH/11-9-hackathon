import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, asapScheduler, defer, distinctUntilChanged, finalize, map, observeOn } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _pendingCount = new BehaviorSubject(0);

  public readonly isLoading$ = this._pendingCount.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
    observeOn(asapScheduler),
  );

  public track<T>(source: Observable<T>): Observable<T> {
    return defer(() => {
      this._pendingCount.next(this._pendingCount.value + 1);

      return source.pipe(finalize(() => this._pendingCount.next(Math.max(0, this._pendingCount.value - 1))));
    });
  }
}
