import { SQLiteDBConnection } from '@capacitor-community/sqlite';

interface DatabaseMigration {
  version: number;
  apply: (database: SQLiteDBConnection) => Promise<void>;
}

const requiredTables = ['appdate', 'inventorytbl', 'salestbl', 'useraccounts'];

const migrations: DatabaseMigration[] = [
  {
    version: 1,
    apply: async (database) => {
      const result = await database.query(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      );
      const availableTables = new Set(
        (result.values ?? []).map((row: { name: string }) => row.name)
      );
      const missingTables = requiredTables.filter(
        (table) => !availableTables.has(table)
      );

      if (missingTables.length > 0) {
        throw new Error(
          `Database is missing required tables: ${missingTables.join(', ')}`
        );
      }
    },
  },
  {
    version: 2,
    apply: async (database) => {
      const result = await database.query(
        'PRAGMA table_info(inventorytbl)'
      );
      const hasFloorstock = (result.values ?? []).some(
        (column: { name: string }) => column.name === 'floorstock'
      );

      if (!hasFloorstock) {
        await database.run(
          'ALTER TABLE inventorytbl ADD COLUMN floorstock INTEGER NOT NULL DEFAULT 0'
        );
      }
    },
  },
  {
    version: 3,
    apply: async (database) => {
      await database.run(`
        CREATE TABLE IF NOT EXISTS daily_inventory_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_date TEXT NOT NULL,
          location TEXT NOT NULL CHECK (location IN ('STORE', 'WAREHOUSE')),
          item_code TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          filled_qty INTEGER NOT NULL DEFAULT 0,
          empty_qty INTEGER NOT NULL DEFAULT 0,
          floorstock INTEGER NOT NULL DEFAULT 0,
          cashier_name TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (snapshot_date, location, item_code)
        )
      `);
    },
  },
  {
    version: 4,
    apply: async (database) => {
      const inventoryResult = await database.query(
        'PRAGMA table_info(inventorytbl)'
      );
      const inventoryColumns = new Set(
        (inventoryResult.values ?? []).map((column: { name: string }) => column.name)
      );

      for (const column of ['cost_refill', 'cost_non_refill']) {
        if (!inventoryColumns.has(column)) {
          await database.run(
            `ALTER TABLE inventorytbl ADD COLUMN ${column} REAL NOT NULL DEFAULT 0`
          );
          await database.run(
            `UPDATE inventorytbl SET ${column} = itemcost`
          );
        }
      }

      const salescartResult = await database.query(
        'PRAGMA table_info(salescart)'
      );
      const salescartColumns = new Set(
        (salescartResult.values ?? []).map((column: { name: string }) => column.name)
      );

      if (!salescartColumns.has('cost_snapshot_version')) {
        await database.run(
          'ALTER TABLE salescart ADD COLUMN cost_snapshot_version INTEGER NOT NULL DEFAULT 0'
        );
      }
    },
  },
  {
    version: 5,
    apply: async (database) => {
      await database.run(`
        CREATE TABLE IF NOT EXISTS shortcut_presets (
          preset_id TEXT PRIMARY KEY,
          position INTEGER NOT NULL,
          preset_json TEXT NOT NULL
        )
      `);

      const priceListResult = await database.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pricelisttbl'"
      );
      if ((priceListResult.values ?? []).length > 0) {
        const columnsResult = await database.query(
          'PRAGMA table_info(pricelisttbl)'
        );
        const columns = new Set(
          (columnsResult.values ?? []).map(
            (column: { name: string }) => column.name
          )
        );
        for (const column of ['cost_refill', 'cost_non_refill']) {
          if (!columns.has(column)) {
            await database.run(
              `ALTER TABLE pricelisttbl ADD COLUMN ${column} REAL NOT NULL DEFAULT 0`
            );
            if (columns.has('itemcost')) {
              await database.run(
                `UPDATE pricelisttbl SET ${column} = itemcost`
              );
            }
          }
        }
      }
    },
  },
];

export async function runDatabaseMigrations(
  database: SQLiteDBConnection
): Promise<void> {
  const result = await database.query('PRAGMA user_version');
  let currentVersion = Number(result.values?.[0]?.user_version ?? 0);
  const latestVersion = migrations[migrations.length - 1]?.version ?? 0;

  if (currentVersion > latestVersion) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${latestVersion}.`
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await migration.apply(database);
    await database.run(`PRAGMA user_version = ${migration.version}`);
    currentVersion = migration.version;
  }
}