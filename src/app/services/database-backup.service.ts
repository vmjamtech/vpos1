import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SqliteService } from './sqlite.service';

interface BackupTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface DatabaseBackup {
  format: 'vmjamtechdatamobile';
  version: 1;
  database: 'vmjampos';
  createdAt: string;
  localSettings: {
    bir_settings: string | null;
    store_only_mode: string | null;
    vpos_shortcut_presets?: string | null;
    report_layout_summary?: string | null;
    report_layout_item_sold?: string | null;
    report_layout_inventory?: string | null;
    report_layout_floorstock?: string | null;
  };
  tables: Record<string, BackupTable>;
}

const REPORT_LAYOUT_KEYS = [
  'report_layout_summary',
  'report_layout_item-sold',
  'report_layout_inventory',
  'report_layout_floorstock',
] as const;

@Injectable({ providedIn: 'root' })
export class DatabaseBackupService {
  private readonly backupFormat = 'vmjamtechdatamobile' as const;
  private readonly backupVersion = 1 as const;
  private readonly databaseName = 'vmjampos' as const;
  private readonly legacyOptionalColumns: Record<string, string[]> = {
    inventorytbl: ['cost_refill', 'cost_non_refill'],
    pricelisttbl: ['cost_refill', 'cost_non_refill'],
    salescart: ['cost_snapshot_version'],
  };
  private readonly legacyOptionalTables = ['shortcut_presets'];

  constructor(private db: SqliteService) {}

  getFormattedBackupFilename(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    return `Backup-${month}-${day}-${year}.vmjamtechdatamobile`;
  }

  async exportBackup(): Promise<string> {
    const tableData = await this.db.executeInTransaction(async () => {
      const tables = await this.getApplicationTableNames();
      const snapshot: Record<string, BackupTable> = {};

      for (const table of tables) {
        const columns = await this.getTableColumns(table);
        const sourceRows = await this.db.query<Record<string, unknown>>(
          `SELECT ${columns.map((column) => this.quoteIdentifier(column)).join(', ')} FROM ${this.quoteIdentifier(table)}`
        );
        const rows = sourceRows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([column, value]) => [
              column,
              this.encodeSqlValue(value),
            ])
          )
        );
        snapshot[table] = { columns, rows };
      }

      return snapshot;
    });

    const backup: DatabaseBackup = {
      format: this.backupFormat,
      version: this.backupVersion,
      database: this.databaseName,
      createdAt: new Date().toISOString(),
      localSettings: {
        bir_settings: localStorage.getItem('bir_settings'),
        store_only_mode: localStorage.getItem('store_only_mode'),
        vpos_shortcut_presets: localStorage.getItem('vpos_shortcut_presets'),
        report_layout_summary: localStorage.getItem('report_layout_summary'),
        report_layout_item_sold: localStorage.getItem('report_layout_item-sold'),
        report_layout_inventory: localStorage.getItem('report_layout_inventory'),
        report_layout_floorstock: localStorage.getItem('report_layout_floorstock'),
      },
      tables: tableData,
    };
    const content = JSON.stringify(backup);
    const filename = this.getFormattedBackupFilename();

    if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Documents,
      });
      try {
        await Share.share({
          title: filename,
          dialogTitle: 'Save V-POS Database Backup',
          files: [uri],
        });
      } catch (error) {
        console.warn('Backup was saved but could not be shared:', error);
      }
    } else {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return filename;
  }

  async validateBackupFile(file: File): Promise<void> {
    await this.parseAndValidateBackup(file);
  }

  async restoreBackupFromFile(file: File): Promise<void> {
    const backup = await this.parseAndValidateBackup(file);
    const liveTables = Object.keys(backup.tables).sort();

    await this.db.executeInTransaction(async () => {
      await this.db.execute('PRAGMA defer_foreign_keys = ON', [], false);

      for (const table of liveTables) {
        await this.db.execute(
          `DELETE FROM ${this.quoteIdentifier(table)}`,
          [],
          false
        );
      }

      for (const table of liveTables) {
        const tableData = backup.tables[table];
        if (tableData.rows.length === 0) continue;
        const columnList = tableData.columns
          .map((column) => this.quoteIdentifier(column))
          .join(', ');
        const placeholders = tableData.columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})`;

        for (const row of tableData.rows) {
          await this.db.execute(
            sql,
            tableData.columns.map((column) => row[column]),
            false
          );
        }
      }

      const ftsTable = await this.db.query<{ name: string }>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'ai_chunk_fts'
      `);
      if (ftsTable.length > 0) {
        await this.db.execute(
          "INSERT INTO ai_chunk_fts(ai_chunk_fts) VALUES ('rebuild')",
          [],
          false
        );
      }
    });

    try {
      if (backup.localSettings.bir_settings === null) {
        localStorage.removeItem('bir_settings');
      } else {
        localStorage.setItem('bir_settings', backup.localSettings.bir_settings);
      }
      if (backup.localSettings.store_only_mode === null) {
        localStorage.removeItem('store_only_mode');
      } else {
        localStorage.setItem(
          'store_only_mode',
          backup.localSettings.store_only_mode
        );
      }
      if (backup.tables['shortcut_presets']?.rows.length) {
        localStorage.removeItem('vpos_shortcut_presets');
      } else {
        this.restoreLocalSetting(
          'vpos_shortcut_presets',
          backup.localSettings.vpos_shortcut_presets ?? null
        );
      }
      for (const key of REPORT_LAYOUT_KEYS) {
        const settingKey = key === 'report_layout_item-sold'
          ? 'report_layout_item_sold'
          : key;
        const value = backup.localSettings[settingKey];
        if (value !== undefined) this.restoreLocalSetting(key, value);
      }
      localStorage.removeItem('vpos_queued_orders');
    } catch (error) {
      console.warn('Unable to restore or clear local settings after database restore:', error);
    }
  }

  private async parseAndValidateBackup(file: File): Promise<DatabaseBackup> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (
      extension !== 'vmjamtechdatamobile' &&
      extension !== 'json'
    ) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    let backup: DatabaseBackup;
    try {
      backup = JSON.parse(await file.text()) as DatabaseBackup;
    } catch {
      throw new Error('INVALID_BACKUP_FILE');
    }

    if (
      !backup ||
      backup.format !== this.backupFormat ||
      backup.version !== this.backupVersion ||
      backup.database !== this.databaseName ||
      !backup.createdAt ||
      Number.isNaN(Date.parse(backup.createdAt)) ||
      !backup.localSettings ||
      (backup.localSettings.bir_settings !== null &&
        typeof backup.localSettings.bir_settings !== 'string') ||
      (backup.localSettings.store_only_mode !== null &&
        typeof backup.localSettings.store_only_mode !== 'string') ||
      !backup.tables ||
      typeof backup.tables !== 'object' ||
      Array.isArray(backup.tables)
    ) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    for (const settingKey of [
      'vpos_shortcut_presets',
      'report_layout_summary',
      'report_layout_item_sold',
      'report_layout_inventory',
      'report_layout_floorstock',
    ] as const) {
      const value = backup.localSettings[settingKey];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new Error('INVALID_BACKUP_FILE');
      }
    }

    const liveTables = await this.getApplicationTableNames();
    const backupTableNames = Object.keys(backup.tables);
    const expectedTableNames = liveTables.filter(
      (table) =>
        !this.legacyOptionalTables.includes(table) ||
        backupTableNames.includes(table)
    );
    if (
      JSON.stringify(backupTableNames.sort()) !==
      JSON.stringify([...expectedTableNames].sort())
    ) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    for (const table of liveTables) {
      const liveColumns = await this.getTableColumns(table);
      if (!backup.tables[table] && this.legacyOptionalTables.includes(table)) {
        backup.tables[table] = { columns: liveColumns, rows: [] };
        continue;
      }
      const savedTable = backup.tables[table];
      const optionalColumns = this.legacyOptionalColumns[table] ?? [];
      const legacyColumns = liveColumns.filter(
        (column) => !optionalColumns.includes(column)
      );
      const hasCurrentColumns =
        JSON.stringify(savedTable?.columns) === JSON.stringify(liveColumns);
      const missingColumns = liveColumns.filter(
        (column) => !savedTable?.columns?.includes(column)
      );
      const hasSupportedLegacyColumns =
        missingColumns.length > 0 &&
        missingColumns.every((column) =>
          this.legacyOptionalColumns[table]?.includes(column)
        ) &&
        savedTable?.columns?.every((column) => liveColumns.includes(column)) &&
        (JSON.stringify(savedTable?.columns) === JSON.stringify(legacyColumns) ||
          missingColumns.length < optionalColumns.length);
      if (
        !savedTable ||
        !Array.isArray(savedTable.columns) ||
        !Array.isArray(savedTable.rows) ||
        (!hasCurrentColumns && !hasSupportedLegacyColumns)
      ) {
        throw new Error('INVALID_BACKUP_FILE');
      }

      const validRows = savedTable.rows.every(
        (row) =>
          row !== null &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          Object.keys(row).length === savedTable.columns.length &&
          savedTable.columns.every((column) =>
            Object.prototype.hasOwnProperty.call(row, column)
          )
      );
      if (!validRows) throw new Error('INVALID_BACKUP_FILE');

      for (const row of savedTable.rows) {
        for (const value of Object.values(row)) {
          if (
            value !== null &&
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            !this.isEncodedBlob(value)
          ) {
            throw new Error('INVALID_BACKUP_FILE');
          }
        }
      }

      if (hasSupportedLegacyColumns) {
        savedTable.rows = savedTable.rows.map((row) => {
          const restoredRow = { ...row };
          for (const column of missingColumns) {
            restoredRow[column] =
              table === 'inventorytbl' || table === 'pricelisttbl'
                ? row['itemcost'] ?? 0
                : 0;
          }
          return restoredRow;
        });
        savedTable.columns = liveColumns;
      }
    }
    return backup;
  }

  private async getApplicationTableNames(): Promise<string[]> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS shortcut_presets (
        preset_id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        preset_json TEXT NOT NULL
      )
    `, [], false);
    const rows = await this.db.query<{ name: string; sql: string | null }>(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
      ORDER BY name
    `);
    return rows
      .filter(
        (row) =>
          !/^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(row.sql ?? '') &&
          !row.name.startsWith('ai_chunk_fts_')
      )
      .map((row) => row.name);
  }

  private async getTableColumns(table: string): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(
      `PRAGMA table_info(${this.quoteIdentifier(table)})`
    );
    if (rows.length === 0) throw new Error('INVALID_BACKUP_FILE');
    return rows.map((row) => row.name);
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error('INVALID_BACKUP_FILE');
    }
    return `"${identifier}"`;
  }

  private encodeSqlValue(value: unknown): unknown {
    if (Array.isArray(value) && value.every(this.isByte)) {
      return { type: 'Buffer', data: value };
    }
    if (ArrayBuffer.isView(value)) {
      return {
        type: 'Buffer',
        data: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
      };
    }
    return value;
  }

  private isEncodedBlob(
    value: unknown
  ): value is { type: 'Buffer'; data: number[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const blob = value as { type?: unknown; data?: unknown };
    return (
      blob.type === 'Buffer' &&
      Array.isArray(blob.data) &&
      blob.data.every(this.isByte)
    );
  }

  private isByte(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255;
  }

  private restoreLocalSetting(key: string, value: string | null): void {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
}
