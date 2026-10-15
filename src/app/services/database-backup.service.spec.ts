import { SqliteService } from './sqlite.service';
import { DatabaseBackupService } from './database-backup.service';

describe('DatabaseBackupService', () => {
  let db: jasmine.SpyObj<SqliteService>;
  let service: DatabaseBackupService;
  let originalQueue: string | null;

  beforeEach(() => {
    originalQueue = localStorage.getItem('vpos_queued_orders');
    db = jasmine.createSpyObj<SqliteService>('SqliteService', [
      'query',
      'execute',
      'executeInTransaction',
    ]);
    db.execute.and.resolveTo();
    db.executeInTransaction.and.callFake(async (operation: any) =>
      operation()
    );
    service = new DatabaseBackupService(db);
  });

  afterEach(() => {
    if (originalQueue === null) {
      localStorage.removeItem('vpos_queued_orders');
    } else {
      localStorage.setItem('vpos_queued_orders', originalQueue);
    }
  });

  it('uses the required dated custom extension', () => {
    expect(service.getFormattedBackupFilename()).toMatch(
      /^Backup-\d{2}-\d{2}-\d{4}\.vmjamtechdatamobile$/
    );
  });

  it('rejects a backup whose table set differs from the live database', async () => {
    db.query.and.resolveTo([{ name: 'inventorytbl' }] as any);
    const backup = new File(
      [
        JSON.stringify({
          format: 'vmjamtechdatamobile',
          version: 1,
          database: 'vmjampos',
          createdAt: new Date().toISOString(),
          localSettings: { bir_settings: null, store_only_mode: null },
          tables: {},
        }),
      ],
      'backup.vmjamtechdatamobile'
    );

    await expectAsync(service.validateBackupFile(backup)).toBeRejectedWithError(
      'INVALID_BACKUP_FILE'
    );
    expect(db.executeInTransaction).not.toHaveBeenCalled();
  });

  it('restores validated rows inside the database transaction and clears queued carts', async () => {
    db.query.and.callFake(async (sql: string) => {
      if (sql.includes("name = 'ai_chunk_fts'")) return [] as any;
      if (sql.includes('sqlite_master')) return [{ name: 'inventorytbl' }] as any;
      if (sql.includes('PRAGMA table_info')) {
        return [{ name: 'itemid' }, { name: 'fillqty' }] as any;
      }
      return [] as any;
    });
    localStorage.setItem('vpos_queued_orders', '[{"queueNo":"QN1"}]');
    const backup = new File(
      [
        JSON.stringify({
          format: 'vmjamtechdatamobile',
          version: 1,
          database: 'vmjampos',
          createdAt: new Date().toISOString(),
          localSettings: { bir_settings: null, store_only_mode: null },
          tables: {
            inventorytbl: {
              columns: ['itemid', 'fillqty'],
              rows: [{ itemid: 1, fillqty: 42 }],
            },
          },
        }),
      ],
      'backup.json'
    );

    await service.restoreBackupFromFile(backup);

    expect(db.executeInTransaction).toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM "inventorytbl"',
      [],
      false
    );
    expect(db.execute).toHaveBeenCalledWith(
      'INSERT INTO "inventorytbl" ("itemid", "fillqty") VALUES (?, ?)',
      [1, 42],
      false
    );
    expect(localStorage.getItem('vpos_queued_orders')).toBeNull();
  });
});
