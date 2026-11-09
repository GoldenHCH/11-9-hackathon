import { Injectable } from '@angular/core';

const adminKeyStorageKey = 'kubequest.adminKey';
const boothKeysStorageKey = 'kubequest.boothKeys';

export interface ISavedBooth {
  outpostId: string;
  name: string;
  key: string;
}

@Injectable({ providedIn: 'root' })
export class AccessKeyService {
  public get adminKey(): string | null {
    return this._read(adminKeyStorageKey);
  }

  public setAdminKey(key: string): void {
    this._write(adminKeyStorageKey, key);
  }

  public clearAdminKey(): void {
    const adminKey = this.adminKey;

    if (adminKey !== null && this.savedBooths.some((booth) => booth.key === adminKey)) {
      this._write(boothKeysStorageKey, JSON.stringify(this.savedBooths.filter((booth) => booth.key !== adminKey)));
    }

    this._remove(adminKeyStorageKey);
  }

  public get savedBooths(): ISavedBooth[] {
    const raw = this._read(boothKeysStorageKey);

    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed.filter((booth): booth is ISavedBooth => this._isSavedBooth(booth)) : [];
    } catch {
      return [];
    }
  }

  public boothKey(outpostId: string): string | null {
    return this.savedBooths.find((booth) => booth.outpostId === outpostId)?.key ?? this.adminKey;
  }

  public saveBooth(booth: ISavedBooth): void {
    if (booth.key === this.adminKey) {
      return;
    }

    const others = this.savedBooths.filter((saved) => saved.outpostId !== booth.outpostId);

    this._write(boothKeysStorageKey, JSON.stringify([booth, ...others]));
  }

  public forgetBooth(outpostId: string): void {
    this._write(boothKeysStorageKey, JSON.stringify(this.savedBooths.filter((saved) => saved.outpostId !== outpostId)));
  }

  private _isSavedBooth(value: unknown): value is ISavedBooth {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof Reflect.get(value, 'outpostId') === 'string' &&
      typeof Reflect.get(value, 'name') === 'string' &&
      typeof Reflect.get(value, 'key') === 'string'
    );
  }

  private _read(storageKey: string): string | null {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  private _write(storageKey: string, value: string): void {
    try {
      localStorage.setItem(storageKey, value);
    } catch (error) {
      console.error('Could not save the access link', error);
    }
  }

  private _remove(storageKey: string): void {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Could not clear the access link', error);
    }
  }
}
