import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IMeet } from '../../core/api.types';

@Injectable({ providedIn: 'root' })
export class LiveMeetService {
  private readonly _waiting$ = new BehaviorSubject<IMeet | null>(null);

  public readonly waiting$ = this._waiting$.asObservable();

  public waitFor(meet: IMeet): void {
    if (meet.role === 'proposer' && meet.status === 'proposed' && meet.live) {
      this._waiting$.next(meet);
    }
  }

  public clear(): void {
    this._waiting$.next(null);
  }
}
