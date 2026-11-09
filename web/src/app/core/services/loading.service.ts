import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, debounceTime, distinctUntilChanged, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _pendingCount$ = new BehaviorSubject<number>(0);

  public readonly isLoading$: Observable<boolean> = this._pendingCount$.pipe(
    map((pendingCount) => pendingCount > 0),
    distinctUntilChanged(),
    debounceTime(0),
  );

  public show(): void {
    this._pendingCount$.next(this._pendingCount$.value + 1);
  }

  public hide(): void {
    this._pendingCount$.next(Math.max(0, this._pendingCount$.value - 1));
  }
}
