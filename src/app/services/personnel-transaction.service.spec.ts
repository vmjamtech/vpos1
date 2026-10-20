import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { PersonnelTransactionService } from './personnel-transaction.service';

describe('PersonnelTransactionService date filtering', () => {
  let query: jasmine.Spy;
  let service: PersonnelTransactionService;

  beforeEach(() => {
    query = jasmine.createSpy('query').and.resolveTo([]);
    service = new PersonnelTransactionService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );
  });

  it('includes the entire selected day for a same-day Rider range', async () => {
    await service.getRiderTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-25',
      'Rider',
      7,
      20,
      0,
      false
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
    expect(params).toEqual([
      7,
      7,
      '2026-09-25',
      '2026-09-25',
      20,
      0,
    ]);
  });

  it('keeps both selected dates for a multi-day Rider range', async () => {
    await service.getRiderTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-26',
      'Rider',
      7,
      20,
      0,
      false
    );

    const [, params] = query.calls.mostRecent().args;
    expect(params).toContain('2026-09-25');
    expect(params).toContain('2026-09-26');
  });

  it('filters both cashier sales and delivery timestamps by inclusive dates', async () => {
    await service.getCashierTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-25',
      'Cashier',
      7,
      20,
      0,
      false
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain('u.userid = ?');
    expect(params).not.toContain('Cashier');
    expect(sql).toContain(
      'DATE(t2.salesdate) >= DATE(?) AND DATE(t2.salesdate) <= DATE(?)'
    );
    expect(sql).toContain(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
    expect(sql).not.toContain('SUBSTR(');
    expect(params).toEqual([
      7,
      null,
      '2026-09-25',
      '2026-09-25',
      7,
      7,
      '2026-09-25',
      '2026-09-25',
      20,
      0,
    ]);
  });

  it('maps cashier transactions through the linked user account id', async () => {
    await service.getCashierTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-25',
      'Cashier name',
      7,
      20,
      0,
      false,
      34
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain('u.userid = ?');
    expect(sql).toContain('TRIM(COALESCE(u.usern, \'\'))');
    expect(params).not.toContain('Cashier personnel name');
    expect(params).toEqual([
      7,
      34,
      '2026-09-25',
      '2026-09-25',
      7,
      7,
      '2026-09-25',
      '2026-09-25',
      20,
      0,
    ]);
  });

  it('filters Driver pullout and delivery timestamps by inclusive dates', async () => {
    await service.getDriverTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-25',
      'Driver',
      11,
      20,
      0,
      false
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      'DATE(pulldate) >= DATE(?) AND DATE(pulldate) <= DATE(?)'
    );
    expect(sql).toContain(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
    expect(sql).toContain("'W.RESTOCK IN', 'W.RESTOCK OUT'");
    expect(sql).toContain("'W.RESTOCK INFILL', 'W.RESTOCK OUTEMPTY'");
    expect(sql).toContain('s.sal7kg * t1.poutqty');
    expect(sql).toContain('s.salnosize * t1.poutqty');
    expect(sql).toContain('s.sal3kg * t1.poutqty');
    expect(sql).toContain('s.sal15kg * t1.poutqty');
    expect(sql).not.toContain('SUBSTR(');
    expect(params).toEqual([
      11,
      '2026-09-25',
      '2026-09-25',
      11,
      11,
      '2026-09-25',
      '2026-09-25',
      20,
      0,
    ]);
  });

  it('normalizes plain and prefixed delivery categories without slicing', async () => {
    query.and.resolveTo([
      { salescat: 'PICK UP' },
      { salescat: '1-PICK UP' },
      { salescat: 'DELIVERY' },
      { salescat: '2-DELIVERY' },
    ]);

    const rows = await service.getRiderTransactionByIdAndDate(
      '2026-09-25',
      '2026-09-25',
      'Rider',
      7
    );

    expect(rows.map((row) => row.salescat)).toEqual([
      'PICK UP',
      'PICK UP',
      'DELIVERY',
      'DELIVERY',
    ]);
    expect(query.calls.mostRecent().args[0]).not.toContain('SUBSTR(');
  });

  it('calculates Driver commission only from non-cancelled POS categories', async () => {
    query.and.resolveTo([{ totalsalary: 0 }]);

    const total = await service.getDriverSumSalary(
      '2026-09-25',
      '2026-09-25',
      'Driver',
      11,
      false
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(total).toBe(0);
    expect(sql).toContain('FROM deltransacttbl t0');
    expect(sql).toContain("'PICK UP', 'DELIVERY', '1-PICK UP', '2-DELIVERY'");
    expect(sql).toContain("COALESCE(t0.dtstatus, '') <> 'CANCELLED'");
    expect(sql).not.toContain('pulloutcart');
    expect(sql).not.toContain('pouttbl');
    expect(params).toEqual([
      11,
      11,
      '2026-09-25',
      '2026-09-25',
    ]);
  });

  it('binds each Driver salary-days date range in SQL placeholder order', async () => {
    await service.getSalaryDays(
      'Driver',
      'Driver',
      11,
      '2026-09-25',
      '2026-09-25',
      false
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      'DATE(pulldate) >= DATE(?) AND DATE(pulldate) <= DATE(?)'
    );
    expect(sql).toContain(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
    expect(params).toEqual([
      11,
      '2026-09-25',
      '2026-09-25',
      11,
      11,
      '2026-09-25',
      '2026-09-25',
    ]);
  });

  it('uses only the tagged cashier account for salary-day sales', async () => {
    await service.getSalaryDays(
      'Cashier',
      'Cashier personnel name',
      7,
      '2026-09-25',
      '2026-09-25',
      false,
      34
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain('u.userid = ?');
    expect(sql).toContain('sales.salescashier');
    expect(params).not.toContain('Cashier personnel name');
    expect(params).toEqual([
      34,
      '2026-09-25',
      '2026-09-25',
      7,
      7,
      '2026-09-25',
      '2026-09-25',
    ]);
  });

  it('records the payout breakdown and deducts only paid commission', async () => {
    const execute = jasmine.createSpy('execute').and.resolveTo();
    const executeInTransaction = jasmine
      .createSpy('executeInTransaction')
      .and.callFake(async (operation: () => Promise<void>) => operation());
    const payoutDb = {
      query: jasmine.createSpy('query').and.resolveTo([{ valuez: 0 }]),
      execute,
      executeInTransaction,
    } as unknown as SqliteService;
    const payoutService = new PersonnelTransactionService(
      {} as HttpClient,
      {} as StorageService,
      payoutDb
    );

    await payoutService.insertPaySalaryHistory({
      pname: 'Rider',
      pid: 7,
      tendered: 100,
      totalPay: 100,
      dailyRate: 50,
      days: 1,
      salary: 50,
      commission: 40,
      commissionPaid: 20,
      additional: 15,
      lessPay: 5,
      incentive: 0,
      remarks: 'From Oct 01, 2026 to Oct 01, 2026',
      paidBy: 'Admin',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-01',
      paymentMethod: 'CASH',
    });

    expect(executeInTransaction).toHaveBeenCalled();
    expect(execute.calls.argsFor(0)[0]).toContain(
      'saldays, salsalary, salcommission'
    );
    expect(execute.calls.argsFor(0)[2]).toBeFalse();
    expect(execute.calls.mostRecent().args[0]).toContain(
      'SET ptotalpay = MAX(0, COALESCE(ptotalpay, 0) - ?)'
    );
    expect(execute.calls.mostRecent().args[1]).toEqual([20, 7]);
    expect(execute.calls.mostRecent().args[2]).toBeFalse();
  });
});
