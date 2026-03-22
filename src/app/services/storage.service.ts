import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {}

  /** Initialize Ionic Storage */
  async init(): Promise<void> {
    if (!this._storage) {
      this._storage = await this.storage.create();
    }
  }

  /** Set item in storage */
  async set<T>(key: string, value: T): Promise<void> {
    await this.init();
    return this._storage!.set(key, value);
  }

  /** Get item from storage */
  async get<T>(key: string): Promise<T | null> {
    await this.init();
    return (await this._storage!.get(key)) ?? null;
  }

  /** Remove item from storage */
  async remove(key: string): Promise<void> {
    await this.init();
    return this._storage!.remove(key);
  }

  /** Clear all storage */
  async clear(): Promise<void> {
    await this.init();
    return this._storage!.clear();
  }
}
