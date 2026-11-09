import { pendingScanStorageKey } from '../app.constants';

export class PendingScanHelper {
  public static take(nextParam: string | null): string | null {
    const stored = PendingScanHelper._read(sessionStorage) ?? PendingScanHelper._read(localStorage);
    PendingScanHelper._clear();

    const candidate = stored ?? nextParam;

    return PendingScanHelper._isSafePath(candidate) ? candidate : null;
  }

  private static _read(storage: Storage): string | null {
    try {
      return storage.getItem(pendingScanStorageKey);
    } catch {
      return null;
    }
  }

  private static _clear(): void {
    for (const storage of [sessionStorage, localStorage]) {
      try {
        storage.removeItem(pendingScanStorageKey);
      } catch (error) {
        console.error('Could not clear the pending scan', error);
      }
    }
  }

  private static _isSafePath(path: string | null): path is string {
    return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/onboarding');
  }
}
