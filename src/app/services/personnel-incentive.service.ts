import { Injectable } from '@angular/core';
import { sqliteInclusiveDateRange } from '../utils/date-range';
import {
  buildSizeIncentiveBreakdown,
  normalizeSizeKey,
  STANDARD_INCENTIVE_SIZES,
  SizeIncentiveBreakdownLine,
} from '../utils/personnel-rates.constants';
import { SqliteService } from './sqlite.service';

export type CashierIncentiveLine = SizeIncentiveBreakdownLine;

export interface PersonnelIncentiveResult {
  totalIncentive: number;
  breakdown: CashierIncentiveLine[];
}

export interface RiderIncentiveLine extends CashierIncentiveLine {
  soldQty: number;
  excessQty: number;
}

export interface RiderIncentiveResult {
  totalIncentive: number;
  quota: number;
  totalSoldCylinders: number;
  totalExcessCylinders: number;
  breakdown: RiderIncentiveLine[];
}

interface SizeIncentiveRow {
  size: string | null;
  qty: number;
  firstDeliveryAt?: string | null;
}

interface IncentiveRateSettings {
  salnosize: number;
  sal2kg: number;
  sal3kg: number;
  sal5kg: number;
  sal7kg: number;
  sal11kg: number;
  sal15kg: number;
  sal22kg: number;
  sal50kg: number;
}

@Injectable({ providedIn: 'root' })
export class PersonnelIncentiveService {
  constructor(private db: SqliteService) {}

  async getCashierIncentive(
    personnelId: number,
    linkedUserId: number,
    dateFrom: string | null,
    dateTo: string | null
  ): Promise<PersonnelIncentiveResult> {
    const dateFilter =
      dateFrom && dateTo
        ? `AND ${sqliteInclusiveDateRange('s.salesdate')}`
        : '';
    const rows = await this.db.query<SizeIncentiveRow>(
      `SELECT COALESCE(
                NULLIF(TRIM(i.itemsize), ''),
                NULLIF(TRIM(sc.scpackage), '')
              ) AS size,
              SUM(sc.scqty) AS qty
       FROM salescart sc
       INNER JOIN salestbl s ON sc.screfnum = s.salesrefnum
       LEFT JOIN inventorytbl i ON sc.scitemcode = i.itemcode
       INNER JOIN useraccounts u ON u.userid = ?
       WHERE TRIM(COALESCE(s.salescashier, '')) COLLATE NOCASE IN (
           NULLIF(TRIM(COALESCE(u.empname, '')), ''),
           NULLIF(TRIM(COALESCE(u.usern, '')), ''),
           CAST(u.userid AS TEXT)
         )
         AND TRIM(COALESCE(s.salescashier, '')) <> ''
         AND COALESCE(s.salestatus, '') <> 'CANCELLED'
         ${dateFilter}
       GROUP BY COALESCE(
         NULLIF(TRIM(i.itemsize), ''),
         NULLIF(TRIM(sc.scpackage), '')
       )`,
      dateFilter ? [linkedUserId, dateFrom, dateTo] : [linkedUserId]
    );

    return this.buildIncentiveResult(
      rows,
      await this.getRateSettings(personnelId)
    );
  }

  async getRiderIncentive(
    personnelId: number,
    dateFrom: string | null,
    dateTo: string | null
  ): Promise<RiderIncentiveResult> {
    const dateFilter =
      dateFrom && dateTo
        ? `AND ${sqliteInclusiveDateRange('d.dtdate')}`
        : '';
    const rows = await this.db.query<SizeIncentiveRow>(
      `SELECT COALESCE(
                NULLIF(TRIM(i.itemsize), ''),
                NULLIF(TRIM(d.delitemsize), '')
              ) AS size,
              SUM(d.delitemqty) AS qty,
              MIN(d.dtdate) AS firstDeliveryAt
       FROM deltransacttbl d
       LEFT JOIN inventorytbl i ON i.itemcode = d.delitemcode
       WHERE (d.dtdelbyid = ? OR d.dtdelbyid2 = ?)
         AND UPPER(TRIM(d.deltype)) IN ('DELIVERY', '2-DELIVERY')
         AND COALESCE(d.dtstatus, '') <> 'CANCELLED'
         AND UPPER(COALESCE(
           NULLIF(TRIM(i.itemsize), ''),
           NULLIF(TRIM(d.delitemsize), ''),
           ''
         )) NOT LIKE '%250%'
         ${dateFilter}
       GROUP BY COALESCE(
         NULLIF(TRIM(i.itemsize), ''),
         NULLIF(TRIM(d.delitemsize), '')
       )
       ORDER BY firstDeliveryAt ASC`,
      dateFilter
        ? [personnelId, personnelId, dateFrom, dateTo]
        : [personnelId, personnelId]
    );

    const settings = await this.db.query<IncentiveRateSettings & {
      salriderquota: number;
    }>(
      `SELECT salnosize, sal2kg, sal3kg, sal5kg, sal7kg,
              sal11kg, sal15kg, sal22kg, sal50kg, salriderquota
       FROM salsettings WHERE salpid = ? LIMIT 1`,
      [personnelId]
    );
    const rates = this.mapRates(settings[0]);
    const grouped = new Map<
      string,
      { qty: number; firstDeliveryAt: string | null }
    >();

    rows.forEach((row) => {
      const size = normalizeSizeKey(row.size);
      const existing = grouped.get(size);
      grouped.set(size, {
        qty: (existing?.qty ?? 0) + (Number(row.qty) || 0),
        firstDeliveryAt:
          existing?.firstDeliveryAt && row.firstDeliveryAt
            ? existing.firstDeliveryAt < row.firstDeliveryAt
              ? existing.firstDeliveryAt
              : row.firstDeliveryAt
            : existing?.firstDeliveryAt ?? row.firstDeliveryAt ?? null,
      });
    });

    const allocationOrder = Array.from(grouped.entries()).sort(
      ([sizeA, itemA], [sizeB, itemB]) =>
        (itemA.firstDeliveryAt ?? '').localeCompare(itemB.firstDeliveryAt ?? '') ||
        STANDARD_INCENTIVE_SIZES.indexOf(normalizeSizeKey(sizeA)) -
          STANDARD_INCENTIVE_SIZES.indexOf(normalizeSizeKey(sizeB))
    );
    let remainingQuota = Math.max(0, Number(settings[0]?.salriderquota) || 0);
    const allocated = new Map<string, RiderIncentiveLine>();
    let totalSoldCylinders = 0;
    let totalExcessCylinders = 0;
    let totalIncentive = 0;

    allocationOrder.forEach(([size, item]) => {
      const standardSize = normalizeSizeKey(size);
      const soldQty = Math.max(0, Number(item.qty) || 0);
      const quotaUsed = Math.min(remainingQuota, soldQty);
      const excessQty = soldQty - quotaUsed;
      const rate = rates[standardSize] ?? 0;
      const amount = excessQty * rate;
      remainingQuota -= quotaUsed;
      totalSoldCylinders += soldQty;
      totalExcessCylinders += excessQty;
      totalIncentive += amount;
      allocated.set(standardSize, {
        size: standardSize,
        qty: soldQty,
        soldQty,
        excessQty,
        rate,
        amount,
      });
    });

    const breakdown = this.emptyBreakdown(rates).map((line) => ({
      ...line,
      ...(allocated.get(line.size) ?? { soldQty: 0, excessQty: 0 }),
    }));

    return {
      totalIncentive,
      quota: Math.max(0, Number(settings[0]?.salriderquota) || 0),
      totalSoldCylinders,
      totalExcessCylinders,
      breakdown,
    };
  }

  async getDriverIncentive(
    personnelId: number,
    dateFrom: string | null,
    dateTo: string | null
  ): Promise<PersonnelIncentiveResult> {
    const dateFilter =
      dateFrom && dateTo
        ? `AND ${sqliteInclusiveDateRange('p.pulldate')}`
        : '';
    const rows = await this.db.query<SizeIncentiveRow>(
      `SELECT NULLIF(TRIM(i.itemsize), '') AS size,
              SUM(pc.poutqty) AS qty
       FROM pulloutcart pc
       INNER JOIN pouttbl p ON pc.poutref = p.poutrefnum
       INNER JOIN inventorytbl i ON pc.poutitemcode = i.itemcode
       WHERE p.poutpid = ?
         AND p.pouttype IN (
           'RESTOCK IN', 'RESTOCK OUT', 'W.RESTOCK IN', 'W.RESTOCK OUT'
         )
         AND pc.pouttype IN (
           'RESTOCK INFILL', 'RESTOCK OUTEMPTY',
           'W.RESTOCK INFILL', 'W.RESTOCK OUTEMPTY'
         )
         AND p.pulloutremarks <> 'Waiting'
         ${dateFilter}
       GROUP BY NULLIF(TRIM(i.itemsize), '')`,
      dateFilter ? [personnelId, dateFrom, dateTo] : [personnelId]
    );

    return this.buildIncentiveResult(
      rows,
      await this.getRateSettings(personnelId)
    );
  }

  private async getRateSettings(
    personnelId: number
  ): Promise<Record<string, number>> {
    const settings = await this.db.query<IncentiveRateSettings>(
      `SELECT salnosize, sal2kg, sal3kg, sal5kg, sal7kg,
              sal11kg, sal15kg, sal22kg, sal50kg
       FROM salsettings WHERE salpid = ? LIMIT 1`,
      [personnelId]
    );
    return this.mapRates(settings[0]);
  }

  private mapRates(row?: IncentiveRateSettings): Record<string, number> {
    return {
      'No Size': Number(row?.salnosize) || 0,
      '2.7kg': Number(row?.sal2kg) || 0,
      '3kg': Number(row?.sal3kg) || 0,
      '5kg': Number(row?.sal5kg) || 0,
      '7kg': Number(row?.sal7kg) || 0,
      '11kg': Number(row?.sal11kg) || 0,
      '15kg': Number(row?.sal15kg) || 0,
      '22kg': Number(row?.sal22kg) || 0,
      '50kg': Number(row?.sal50kg) || 0,
    };
  }

  private emptyBreakdown(
    rates: Record<string, number>
  ): CashierIncentiveLine[] {
    return buildSizeIncentiveBreakdown([], rates).breakdown;
  }

  private buildIncentiveResult(
    rows: SizeIncentiveRow[],
    rates: Record<string, number>
  ): PersonnelIncentiveResult {
    const result = buildSizeIncentiveBreakdown(
      rows.map((row) => ({ size: row.size, qty: Number(row.qty) || 0 })),
      rates
    );
    return {
      totalIncentive: result.totalIncentive,
      breakdown: result.breakdown,
    };
  }
}
