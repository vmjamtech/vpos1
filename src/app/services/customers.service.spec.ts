import { HttpClient } from '@angular/common/http';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { CustomersService } from './customers.service';

describe('CustomersService pagination', () => {
  it('loads a 50-row page and counts with the selected search filter', async () => {
    const query = jasmine.createSpy('query').and.callFake(async (sql: string) => {
      if (sql.includes('COUNT(*)')) return [{ total: 73 }];
      return [{ custid: 51 }];
    });
    const service = new CustomersService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    const result = await service.getCustomerPage(2, 50, 'Main St', 'custadd');

    expect(result).toEqual({
      rows: [{ custid: 51 }],
      totalCount: 73,
      currentPage: 2,
    });
    const [countSql, countParams] = query.calls.argsFor(0);
    expect(countSql).toContain("custstatus <> 'inactive'");
    expect(countSql).toContain("custadd LIKE '%' || ? || '%'");
    expect(countParams).toEqual(['Main St']);
    const [pageSql, pageParams] = query.calls.argsFor(1);
    expect(pageSql).toContain('ORDER BY custname ASC LIMIT ? OFFSET ?');
    expect(pageParams).toEqual(['Main St', 50, 50]);
  });

  it('keeps empty result sets on page one', async () => {
    const query = jasmine
      .createSpy('query')
      .and.returnValues(Promise.resolve([{ total: 0 }]), Promise.resolve([]));
    const service = new CustomersService(
      {} as HttpClient,
      {} as StorageService,
      { query } as unknown as SqliteService
    );

    const result = await service.getCustomerPage(8, 50, '', 'custname');

    expect(result.currentPage).toBe(1);
    expect(result.totalCount).toBe(0);
  });
});
