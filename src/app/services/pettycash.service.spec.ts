import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { PettyCashService } from './pettycash.service';

describe('PettyCashService date range queries', () => {
  it('includes the entire selected calendar day in petty cash totals', async () => {
    const query = jasmine.createSpy('query').and.resolveTo([{ total: 0 }]);
    const service = new PettyCashService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await service.getTotal('2026-09-25', '2026-09-25');

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      'DATE(pettylogdate) >= DATE(?) AND DATE(pettylogdate) <= DATE(?)'
    );
    expect(params).toEqual(['2026-09-25', '2026-09-25']);
  });

  it('returns separate Cash In and Cash Out totals for the selected dates', async () => {
    const query = jasmine
      .createSpy('query')
      .and.resolveTo([{ cashInTotal: 2500, cashOutTotal: 500 }]);
    const service = new PettyCashService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    const totals = await service.getTotalsByType(
      '2026-09-25',
      '2026-09-26'
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain(
      "SUM(CASE WHEN pettylogtype = 'CASH IN' THEN pettylogamount ELSE 0 END) AS cashInTotal"
    );
    expect(sql).toContain(
      "SUM(CASE WHEN pettylogtype = 'CASH OUT' THEN pettylogamount ELSE 0 END) AS cashOutTotal"
    );
    expect(params).toEqual(['2026-09-25', '2026-09-26']);
    expect(totals).toEqual({ cashInTotal: 2500, cashOutTotal: 500 });
  });

  it('returns zero Cash Out when there are no Cash Out rows', async () => {
    const query = jasmine
      .createSpy('query')
      .and.resolveTo([{ cashInTotal: 2000, cashOutTotal: 0 }]);
    const service = new PettyCashService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await expectAsync(
      service.getTotalsByType('2026-09-25', '2026-09-25')
    ).toBeResolvedTo({ cashInTotal: 2000, cashOutTotal: 0 });
  });

  it('returns zero Cash In when there are no Cash In rows', async () => {
    const query = jasmine
      .createSpy('query')
      .and.resolveTo([{ cashInTotal: 0, cashOutTotal: 500 }]);
    const service = new PettyCashService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await expectAsync(
      service.getTotalsByType('2026-09-25', '2026-09-25')
    ).toBeResolvedTo({ cashInTotal: 0, cashOutTotal: 500 });
  });
});
