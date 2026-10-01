import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { ItemhistoryService } from './itemhistory.service';

describe('ItemhistoryService date filters', () => {
  it('returns all item-history origins for ALL within the selected dates', async () => {
    const query = jasmine.createSpy('query').and.resolveTo([]);
    const service = new ItemhistoryService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    await service.getItemHistoryByfilter(
      'SKU-1',
      '2026-09-25',
      '2026-09-25',
      'ALL',
      20,
      0
    );

    const [sql, params] = query.calls.mostRecent().args;
    expect(sql).toContain('date(itemhdate) >= date(?)');
    expect(sql).toContain('date(itemhdate) <= date(?)');
    expect(sql).not.toContain('LIKE');
    expect(params).toEqual(['SKU-1', '2026-09-25', '2026-09-25', 20, 0]);
  });
});
