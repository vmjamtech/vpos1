import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { runDatabaseMigrations } from './database-migrations';

describe('runDatabaseMigrations', () => {
  it('records the baseline version without changing business rows', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.returnValues(
          Promise.resolve({ values: [{ user_version: 0 }] }),
          Promise.resolve({
            values: [
              { name: 'appdate' },
              { name: 'inventorytbl' },
              { name: 'salestbl' },
              { name: 'useraccounts' },
            ],
          }),
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'alertnum' }] })
        ),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await runDatabaseMigrations(database);

    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE inventorytbl ADD COLUMN floorstock INTEGER NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 1');
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 2');
    expect(database.run).toHaveBeenCalledWith(
      jasmine.stringMatching(
        /CREATE TABLE IF NOT EXISTS daily_inventory_snapshots[\s\S]*floorstock INTEGER NOT NULL DEFAULT 0[\s\S]*UNIQUE \(snapshot_date, location, item_code\)/
      )
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 3');
  });

  it('does not add floorstock again when the column already exists', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.returnValues(
          Promise.resolve({ values: [{ user_version: 1 }] }),
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'floorstock' }] })
        ),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await runDatabaseMigrations(database);

    expect(database.run).not.toHaveBeenCalledWith(
      'ALTER TABLE inventorytbl ADD COLUMN floorstock INTEGER NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      jasmine.stringMatching(/CREATE TABLE IF NOT EXISTS daily_inventory_snapshots/)
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 3');
  });

  it('rejects a database missing required business tables', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.returnValues(
          Promise.resolve({ values: [{ user_version: 0 }] }),
          Promise.resolve({ values: [{ name: 'appdate' }] })
        ),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await expectAsync(runDatabaseMigrations(database)).toBeRejectedWithError(
      /missing required tables/
    );
    expect(database.run).not.toHaveBeenCalled();
  });

  it('refuses database versions newer than the app supports', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.resolveTo({ values: [{ user_version: 4 }] }),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await expectAsync(runDatabaseMigrations(database)).toBeRejectedWithError(
      /newer than supported version/
    );
    expect(database.run).not.toHaveBeenCalled();
  });
});