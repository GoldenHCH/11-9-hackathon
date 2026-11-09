import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const accessibleModeStorageKey = 'kubequest.accessibleMode';
const accessibleBodyClass = 'kq-accessible';

@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  private readonly _document = inject(DOCUMENT);

  public get isAccessible(): boolean {
    try {
      return localStorage.getItem(accessibleModeStorageKey) === 'true';
    } catch {
      return false;
    }
  }

  public restore(): void {
    this._applyClass(this.isAccessible);
  }

  public setAccessible(isAccessible: boolean): void {
    try {
      localStorage.setItem(accessibleModeStorageKey, String(isAccessible));
    } catch (error) {
      console.error('Could not save accessible mode', error);
    }

    this._applyClass(isAccessible);
  }

  private _applyClass(isAccessible: boolean): void {
    this._document.body.classList.toggle(accessibleBodyClass, isAccessible);
  }
}
