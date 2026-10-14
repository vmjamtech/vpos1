import { Injectable } from '@angular/core';

const STORE_ONLY_KEY = 'store_only_mode';

@Injectable({ providedIn: 'root' })
export class StoreOnlyService {
  get enabled(): boolean {
    return localStorage.getItem(STORE_ONLY_KEY) === 'true';
  }

  set enabled(value: boolean) {
    localStorage.setItem(STORE_ONLY_KEY, String(value));
  }

  /** UI-only filter: drops warehouse and create/used actions when enabled. */
  filterActions<T extends { text?: string }>(buttons: T[]): T[] {
    if (!this.enabled) return buttons;
    return buttons.filter(
      (b) => !/warehouse|create convert|used convert/i.test(b.text ?? '')
    );
  }
}
