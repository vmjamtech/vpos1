import { Injectable } from '@angular/core';
import { ShortcutPreset } from '../drawer/pos-sales/shortcut-preset.model';
import { SqliteService } from './sqlite.service';

const LEGACY_PRESETS_KEY = 'vpos_shortcut_presets';
const MAX_PRESETS = 6;

@Injectable({ providedIn: 'root' })
export class ShortcutPresetService {
  constructor(private db: SqliteService) {}

  async getAll(): Promise<ShortcutPreset[]> {
    await this.ensureTable();
    const rows = await this.db.query<{
      preset_id: string;
      preset_json: string;
    }>(
      'SELECT preset_id, preset_json FROM shortcut_presets ORDER BY position ASC'
    );

    if (rows.length > 0) {
      return rows.map(({ preset_id, preset_json }) => {
        const preset = JSON.parse(preset_json) as ShortcutPreset;
        if (preset.id !== preset_id) {
          throw new Error('Invalid shortcut preset data in database.');
        }
        return preset;
      });
    }

    const legacyPresets = this.readLegacyPresets();
    if (legacyPresets.length > 0) {
      await this.replaceAll(legacyPresets);
    }
    return legacyPresets;
  }

  async save(preset: ShortcutPreset): Promise<void> {
    const presets = await this.getAll();
    const existingIndex = presets.findIndex((item) => item.id === preset.id);
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      if (presets.length >= MAX_PRESETS) {
        throw new Error('All 6 shortcut slots are in use.');
      }
      presets.push(preset);
    }
    await this.replaceAll(presets);
  }

  async delete(presetId: string): Promise<void> {
    const presets = await this.getAll();
    await this.replaceAll(presets.filter((preset) => preset.id !== presetId));
  }

  private async ensureTable(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS shortcut_presets (
        preset_id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        preset_json TEXT NOT NULL
      )
    `);
  }

  private readLegacyPresets(): ShortcutPreset[] {
    if (typeof localStorage === 'undefined') return [];
    const stored = localStorage.getItem(LEGACY_PRESETS_KEY);
    if (!stored) return [];
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid legacy shortcut preset data.');
      }
      return parsed
        .filter(
          (preset): preset is ShortcutPreset =>
            !!preset &&
            typeof preset === 'object' &&
            typeof preset.id === 'string' &&
            typeof preset.codeName === 'string' &&
            Array.isArray(preset.items)
        )
        .slice(0, MAX_PRESETS);
    } catch (error) {
      console.error('Failed to migrate shortcut presets from local storage:', error);
      throw error;
    }
  }

  private async replaceAll(presets: ShortcutPreset[]): Promise<void> {
    await this.ensureTable();
    await this.db.executeInTransaction(async () => {
      await this.db.execute('DELETE FROM shortcut_presets', [], false);
      for (const [position, preset] of presets.entries()) {
        await this.db.execute(
          'INSERT INTO shortcut_presets (preset_id, position, preset_json) VALUES (?, ?, ?)',
          [preset.id, position, JSON.stringify(preset)],
          false
        );
      }
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_PRESETS_KEY);
    }
  }
}
