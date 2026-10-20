import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';

describe('SqliteService transaction handling', () => {
  it('rolls back prior writes when a later write in the transaction fails', async () => {
    let persistedHistory: string[] = [];
    let transactionSnapshot: string[] = [];
    const connection = {
      beginTransaction: jasmine.createSpy('beginTransaction').and.callFake(
        async () => {
          transactionSnapshot = [...persistedHistory];
        }
      ),
      commitTransaction: jasmine
        .createSpy('commitTransaction')
        .and.resolveTo(),
      rollbackTransaction: jasmine
        .createSpy('rollbackTransaction')
        .and.callFake(async () => {
          persistedHistory = [...transactionSnapshot];
        }),
      run: jasmine.createSpy('run').and.callFake(async (sql: string) => {
        if (sql.startsWith('INSERT INTO salhistory')) {
          persistedHistory.push('salary-history');
          return {};
        }
        if (sql.startsWith('UPDATE personeltbl')) {
          throw new Error('Simulated balance update failure.');
        }
        return {};
      }),
    };
    const db = new SqliteService({} as HttpClient);
    Object.defineProperty(db, 'dbConn', { value: connection });
    Object.defineProperty(db, 'aiSchemaInitialized', { value: true });

    await expectAsync(
      db.executeInTransaction(async () => {
        await db.execute('INSERT INTO salhistory (...) VALUES (...)', [], false);
        await db.execute('UPDATE personeltbl SET ptotalpay = ?', [0], false);
      })
    ).toBeRejectedWithError('Simulated balance update failure.');

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commitTransaction).not.toHaveBeenCalled();
    expect(connection.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(persistedHistory).toEqual([]);
    expect(connection.run.calls.argsFor(0)[2]).toBeFalse();
    expect(connection.run.calls.argsFor(1)[2]).toBeFalse();
  });
});
