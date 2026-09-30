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
          })
        ),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await runDatabaseMigrations(database);

    expect(database.run).toHaveBeenCalledOnceWith(
      'PRAGMA user_version = 1'
    );
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
        .and.resolveTo({ values: [{ user_version: 2 }] }),
      run: jasmine.createSpy().and.resolveTo({}),
    } as unknown as SQLiteDBConnection;

    await expectAsync(runDatabaseMigrations(database)).toBeRejectedWithError(
      /newer than supported version/
    );
    expect(database.run).not.toHaveBeenCalled();
  });
});