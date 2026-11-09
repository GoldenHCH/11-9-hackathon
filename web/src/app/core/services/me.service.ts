import { Injectable } from '@angular/core';

const attendeeIdStorageKey = 'kubequest.attendeeId';

@Injectable({ providedIn: 'root' })
export class MeService {
  public get attendeeId(): string | null {
    try {
      return localStorage.getItem(attendeeIdStorageKey);
    } catch {
      return null;
    }
  }

  public setAttendeeId(attendeeId: string): void {
    try {
      localStorage.setItem(attendeeIdStorageKey, attendeeId);
    } catch (error) {
      console.error('Could not save the personal link id', error);
    }
  }

  public clear(): void {
    try {
      localStorage.removeItem(attendeeIdStorageKey);
    } catch (error) {
      console.error('Could not clear the personal link id', error);
    }
  }
}
