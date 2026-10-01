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
    expect(sql).toContain(
      'DATE(t2.salesdate) >= DATE(?) AND DATE(t2.salesdate) <= DATE(?)'
    );
    expect(sql).toContain(
      'DATE(dtdate) >= DATE(?) AND DATE(dtdate) <= DATE(?)'
    );
    expect(params).toEqual([
      7,
      'Cashier',
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
});
