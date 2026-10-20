import { PersonnelIncentiveService } from './personnel-incentive.service';
import { SqliteService } from './sqlite.service';

describe('PersonnelIncentiveService', () => {
  let db: jasmine.SpyObj<SqliteService>;
  let service: PersonnelIncentiveService;

  beforeEach(() => {
    db = jasmine.createSpyObj<SqliteService>('SqliteService', ['query']);
    service = new PersonnelIncentiveService(db);
  });

  it('calculates cashier incentive from linked-account sales grouped by size', async () => {
    db.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM salsettings')) {
        return [
          {
            salnosize: 1,
            sal2kg: 2,
            sal3kg: 2.5,
            sal5kg: 3,
            sal7kg: 4,
            sal11kg: 5,
            sal15kg: 5.5,
            sal22kg: 6,
            sal50kg: 7,
          },
        ] as any;
      }
      return [
        { size: '2.7 KG', qty: 3 },
        { size: '11kg', qty: 2 },
        { size: '250grams', qty: 100 },
      ] as any;
    });

    const result = await service.getCashierIncentive(
      12,
      34,
      '2026-10-01',
      '2026-10-31'
    );

    expect(result.totalIncentive).toBe(16);
    expect(result.breakdown).toEqual([
      { size: 'No Size', qty: 0, rate: 1, amount: 0 },
      { size: '2.7kg', qty: 3, rate: 2, amount: 6 },
      { size: '3kg', qty: 0, rate: 2.5, amount: 0 },
      { size: '5kg', qty: 0, rate: 3, amount: 0 },
      { size: '7kg', qty: 0, rate: 4, amount: 0 },
      { size: '11kg', qty: 2, rate: 5, amount: 10 },
      { size: '15kg', qty: 0, rate: 5.5, amount: 0 },
      { size: '22kg', qty: 0, rate: 6, amount: 0 },
      { size: '50kg', qty: 0, rate: 7, amount: 0 },
    ]);
    expect(db.query.calls.argsFor(0)[0]).toContain('u.userid = ?');
    expect(db.query.calls.argsFor(0)[0]).toContain(
      'TRIM(COALESCE(s.salescashier, \'\')) COLLATE NOCASE IN'
    );
    expect(db.query.calls.argsFor(0)[0]).toContain('TRIM(COALESCE(u.usern, \'\'))');
    expect(db.query.calls.argsFor(0)[0]).toContain('CAST(u.userid AS TEXT)');
    expect(db.query.calls.argsFor(0)[0]).not.toContain('personeltbl');
    expect(db.query.calls.argsFor(0)[0]).not.toContain('p.pname');
    expect(db.query.calls.argsFor(0)[0]).toContain('TRIM(sc.scpackage)');
    expect(db.query.calls.argsFor(0)[1]).toEqual([
      34,
      '2026-10-01',
      '2026-10-31',
    ]);
    expect(db.query.calls.argsFor(0)[0]).not.toContain('s.salesuser');
  });

  it('applies cylinder quota before size-based Rider incentive rates', async () => {
    db.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM deltransacttbl')) {
        return [
          { size: '2.7kg', qty: 5, firstDeliveryAt: '2026-10-01 09:00:00' },
          { size: '11kg', qty: 1, firstDeliveryAt: '2026-10-01 10:00:00' },
        ] as any;
      }
      return [
        {
          salnosize: 0,
          sal2kg: 2,
          sal3kg: 0,
          sal5kg: 0,
          sal7kg: 0,
          sal11kg: 10,
          sal15kg: 0,
          sal22kg: 0,
          sal50kg: 0,
          salriderquota: 5,
        },
      ] as any;
    });

    const result = await service.getRiderIncentive(
      12,
      '2026-10-01',
      '2026-10-31'
    );

    expect(result).toEqual(
      jasmine.objectContaining({
        totalIncentive: 10,
        quota: 5,
        totalSoldCylinders: 6,
        totalExcessCylinders: 1,
      })
    );
    expect(result.breakdown.find((line) => line.size === '2.7kg')).toEqual(
      jasmine.objectContaining({
        soldQty: 5,
        excessQty: 0,
        rate: 2,
        amount: 0,
      })
    );
    expect(result.breakdown.find((line) => line.size === '11kg')).toEqual(
      jasmine.objectContaining({
        soldQty: 1,
        excessQty: 1,
        rate: 10,
        amount: 10,
      })
    );
    const [sql, params] = db.query.calls.argsFor(0);
    expect(sql).toContain("UPPER(TRIM(d.deltype)) IN ('DELIVERY', '2-DELIVERY')");
    expect(sql).toContain('SUM(d.delitemqty) AS qty');
    expect(sql).toContain("NOT LIKE '%250%'");
    expect(sql).toContain('MIN(d.dtdate) AS firstDeliveryAt');
    expect(params).toEqual([12, 12, '2026-10-01', '2026-10-31']);
  });

  it('includes warehouse restocks in the Driver incentive calculation', async () => {
    db.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM salsettings')) return [];
      return [];
    });

    await service.getDriverIncentive(
      11,
      '2026-10-01',
      '2026-10-31'
    );

    const [sql, params] = db.query.calls.argsFor(0);
    expect(sql).toContain("'W.RESTOCK IN', 'W.RESTOCK OUT'");
    expect(sql).toContain("'W.RESTOCK INFILL', 'W.RESTOCK OUTEMPTY'");
    expect(params).toEqual([11, '2026-10-01', '2026-10-31']);
  });
});
