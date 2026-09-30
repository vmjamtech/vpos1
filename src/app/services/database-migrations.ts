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