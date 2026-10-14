import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { SalesService } from './sales.service';

describe('SalesService date range queries', () => {
  it('includes the entire selected calendar day in sales totals', async () => {
    const query = jasmine.createSpy('query').and.resolveTo([{ total: 0 }]);
    const service = new SalesService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await service.getTotalSales('2026-09-25', '2026-09-25');

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      'DATE(salesdate) >= DATE(?) AND DATE(salesdate) <= DATE(?)'
    );
    expect(params).toEqual(['2026-09-25', '2026-09-25']);
  });

  it('inserts regular and special discounts into separate existing columns', async () => {
    const query = jasmine.createSpy('query').and.callFake(async (sql: string) => {
      if (sql.includes('SELECT COUNT(*)')) return [{ cnt: 0 }];
      if (sql.includes('last_insert_rowid')) return [{ id: 1 }];
      return [];
    });
    const service = new SalesService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await service.createSaledb({ salesdisc: 12, specialdisc: 25 });

    const [sql, params] = query.calls
      .allArgs()
      .find(([statement]) => String(statement).includes('INSERT INTO salestbl'))!;
    expect(sql).toContain('salesdisc, specialdisc');
    expect((String(sql).match(/\?/g) ?? []).length).toBe(30);
    expect(params.length).toBe(30);
    expect(params[24]).toBe(12);
    expect(params[25]).toBe(25);
  });
});
