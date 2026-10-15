import { SqliteService } from './sqlite.service';
import { DatabaseResetService } from './database-reset.service';

describe('DatabaseResetService', () => {
  let db: jasmine.SpyObj<SqliteService>;
  let service: DatabaseResetService;
  let originalQueue: string | null;

  beforeEach(() => {
    originalQueue = localStorage.getItem('vpos_queued_orders');
    db = jasmine.createSpyObj<SqliteService>('SqliteService', [
      'execute',
      'executeInTransaction',
    ]);
    db.execute.and.resolveTo();
    db.executeInTransaction.and.callFake(async (operation: any) =>
      operation()
    );
    service = new DatabaseResetService(db);
  });

  afterEach(() => {
    if (originalQueue === null) {
      localStorage.removeItem('vpos_queued_orders');
    } else {
      localStorage.setItem('vpos_queued_orders', originalQueue);
    }
  });

  it('rejects empty or unknown module selections before starting a transaction', async () => {
    await expectAsync(service.executeScopedReset([])).toBeRejected();
    await expectAsync(
      service.executeScopedReset(['unknown' as any])
    ).toBeRejected();

    expect(db.executeInTransaction).not.toHaveBeenCalled();
  });

  it('resets only the selected inventory fields and clears dependent active lends and queues', async () => {
    localStorage.setItem('vpos_queued_orders', '[{"queueNo":"QN1"}]');

    await service.executeScopedReset(['inventory']);

    const statements = db.execute.calls.allArgs().map(([sql]) => String(sql));
    expect(db.executeInTransaction).toHaveBeenCalled();
    expect(statements.some((sql) => /UPDATE inventorytbl[\s\S]*fillqty = 0/.test(sql))).toBeTrue();
    expect(statements.some((sql) => sql.includes("DELETE FROM lendhistory WHERE lendstatus = 'LENDED'"))).toBeTrue();
    expect(statements.some((sql) => sql.includes('DELETE FROM salestbl'))).toBeFalse();
    expect(localStorage.getItem('vpos_queued_orders')).toBeNull();
  });

  it('clears sale payment and transaction tables and customer balances when Sales is selected', async () => {
    await service.executeScopedReset(['sales']);

    const statements = db.execute.calls.allArgs().map(([sql]) => String(sql));
    expect(statements).toContain('DELETE FROM creditpaymenttbl');
    expect(statements).toContain('DELETE FROM salescart');
    expect(statements).toContain('DELETE FROM salestbl');
    expect(statements).toContain('UPDATE custinfo SET custbalance = 0');
    expect(localStorage.getItem('vpos_queued_orders')).toBeNull();
  });

  it('restores the saved queue if a selected reset fails', async () => {
    const savedQueue = '[{"queueNo":"QN1"}]';
    localStorage.setItem('vpos_queued_orders', savedQueue);
    db.executeInTransaction.and.rejectWith(new Error('transaction failed'));

    await expectAsync(service.executeScopedReset(['sales'])).toBeRejected();

    expect(localStorage.getItem('vpos_queued_orders')).toBe(savedQueue);
  });
});
