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
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'alertnum' }] }),
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'itemcost' }, { name: 'alertnum' }] }),
          Promise.resolve({ values: [{ name: 'scid' }, { name: 'sccost' }, { name: 'totalcost' }] }),
          Promise.resolve({ values: [] }),
          Promise.resolve({ values: [{ name: 'pid' }, { name: 'pname' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }, { name: 'saldaily' }] }),
          Promise.resolve({ values: [{ name: 'salhid' }, { name: 'saltotal' }] }),
          Promise.resolve({ values: [{ name: 'pid' }, { name: 'pname' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }] })
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
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE inventorytbl ADD COLUMN cost_refill REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'UPDATE inventorytbl SET cost_refill = itemcost'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE inventorytbl ADD COLUMN cost_non_refill REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salescart ADD COLUMN cost_snapshot_version INTEGER NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(database.run).toHaveBeenCalledWith(
      jasmine.stringMatching(/CREATE TABLE IF NOT EXISTS shortcut_presets/)
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 5');
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE personeltbl ADD COLUMN linked_userid INTEGER'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salsettings ADD COLUMN salriderquota REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salsettings ADD COLUMN salriderrate REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salhistory ADD COLUMN saldays INTEGER NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salhistory ADD COLUMN salsalary REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salhistory ADD COLUMN salcommission REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 6');
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE personeltbl ADD COLUMN is_commission_eligible INTEGER NOT NULL DEFAULT 1'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 7');
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salsettings ADD COLUMN salnosize REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salsettings ADD COLUMN sal3kg REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE salsettings ADD COLUMN sal15kg REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 8');
  });

  it('does not add floorstock again when the column already exists', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.returnValues(
          Promise.resolve({ values: [{ user_version: 1 }] }),
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'floorstock' }] }),
          Promise.resolve({ values: [{ name: 'itemid' }, { name: 'itemcost' }, { name: 'floorstock' }] }),
          Promise.resolve({ values: [{ name: 'scid' }, { name: 'sccost' }, { name: 'totalcost' }] }),
          Promise.resolve({ values: [] }),
          Promise.resolve({ values: [{ name: 'pid' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }] }),
          Promise.resolve({ values: [{ name: 'salhid' }] }),
          Promise.resolve({ values: [{ name: 'pid' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }] })
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
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 8');
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

  it('adds dual refill costs to an existing price list with legacy fallback', async () => {
    const database = {
      query: jasmine
        .createSpy()
        .and.returnValues(
          Promise.resolve({ values: [{ user_version: 4 }] }),
          Promise.resolve({ values: [{ name: 'pricelisttbl' }] }),
          Promise.resolve({ values: [{ name: 'itemcost' }] }),
          Promise.resolve({ values: [{ name: 'pid' }, { name: 'linked_userid' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }, { name: 'salriderquota' }, { name: 'salriderrate' }] }),
          Promise.resolve({ values: [{ name: 'salhid' }, { name: 'saldays' }, { name: 'salsalary' }, { name: 'salcommission' }] }),
          Promise.resolve({ values: [{ name: 'pid' }, { name: 'linked_userid' }] }),
          Promise.resolve({ values: [{ name: 'salpid' }] })
        ),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await runDatabaseMigrations(database);

    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE pricelisttbl ADD COLUMN cost_refill REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'UPDATE pricelisttbl SET cost_refill = itemcost'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE pricelisttbl ADD COLUMN cost_non_refill REAL NOT NULL DEFAULT 0'
    );
    expect(database.run).toHaveBeenCalledWith(
      'UPDATE pricelisttbl SET cost_non_refill = itemcost'
    );
    expect(database.run).toHaveBeenCalledWith(
      'ALTER TABLE personeltbl ADD COLUMN is_commission_eligible INTEGER NOT NULL DEFAULT 1'
    );
    expect(database.run).toHaveBeenCalledWith('PRAGMA user_version = 8');
  });

  it('refuses database versions newer than the app supports', async () => {
    const database = {
      query: jasmine
        .createSpy()
          .and.resolveTo({ values: [{ user_version: 9 }] }),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await expectAsync(runDatabaseMigrations(database)).toBeRejectedWithError(
      /newer than supported version/
    );
    expect(database.run).not.toHaveBeenCalled();
  });
});