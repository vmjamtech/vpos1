import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { SalesService } from './sales.service';

describe('SalesService date range queries', () => {
  it('loads a 50-row sales page and counts using the active filters', async () => {
    const query = jasmine.createSpy('query').and.callFake(async (sql: string) => {
      if (sql.includes('COUNT(*)')) return [{ total: 118 }];
      return [{ salesid: 51 }];
    });
    const service = new SalesService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    const result = await service.getSalesPage(
      2,
      50,
      '2026-09-01',
      '2026-09-30',
      'AB12',
      'salesrefnum'
    );

    expect(result).toEqual({
      rows: [{ salesid: 51 }],
      totalCount: 118,
      currentPage: 2,
    });
    const [countSql, countParams] = query.calls.argsFor(0);
    expect(countSql).toContain('date(s.salesdate) >= date(?)');
    expect(countSql).toContain('date(s.salesdate) <= date(?)');
    expect(countSql).toContain("s.salesrefnum LIKE '%' || ? || '%'");
    expect(countParams).toEqual(['2026-09-01', '2026-09-30', 'AB12']);
    const [pageSql, pageParams] = query.calls.argsFor(1);
    expect(pageSql).toContain('ORDER BY s.salesdate DESC LIMIT ? OFFSET ?');
    expect(pageParams).toEqual(['2026-09-01', '2026-09-30', 'AB12', 50, 50]);
  });

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
