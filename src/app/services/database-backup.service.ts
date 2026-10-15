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
  };
  tables: Record<string, BackupTable>;
}

@Injectable({ providedIn: 'root' })
export class DatabaseBackupService {
  private readonly backupFormat = 'vmjamtechdatamobile' as const;
  private readonly backupVersion = 1 as const;
  private readonly databaseName = 'vmjampos' as const;

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

    const liveTables = await this.getApplicationTableNames();
    const backupTables = Object.keys(backup.tables).sort();
    if (JSON.stringify(backupTables) !== JSON.stringify([...liveTables].sort())) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    for (const table of liveTables) {
      const savedTable = backup.tables[table];
      const liveColumns = await this.getTableColumns(table);
      if (
        !savedTable ||
        !Array.isArray(savedTable.columns) ||
        !Array.isArray(savedTable.rows) ||
        JSON.stringify(savedTable.columns) !== JSON.stringify(liveColumns)
      ) {
        throw new Error('INVALID_BACKUP_FILE');
      }

      const validRows = savedTable.rows.every(
        (row) =>
          row !== null &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          Object.keys(row).length === liveColumns.length &&
          liveColumns.every((column) =>
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
    }
    return backup;
  }

  private async getApplicationTableNames(): Promise<string[]> {
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
}
