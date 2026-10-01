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
});
