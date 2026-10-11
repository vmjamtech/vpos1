import { Injectable } from '@angular/core';
import { SqliteService } from './sqlite.service';

export interface ReportSummary {
  totalSales: number;
  totalCash: number;
  totalEwallet: number;
  totalBankTransfer: number;
  totalPaid: number;
  totalCapital: number;
  totalDiscounts: number;
  totalSpecialDiscount: number;
  totalCredit: number;
  totalPurchase: number;
  totalExpense: number;
  totalSalaryPaid: number;
  finalTotal: number;
}

export interface ItemSoldRow {
  itemCode: string;
  size: string;
  totalItems: number;
}

export interface ItemSoldReport {
  rows: ItemSoldRow[];
  totalItems: number;
  totalKg: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReportsDataService {
  constructor(private db: SqliteService) {}

  async getCashiers(): Promise<string[]> {
    const rows = await this.db.query<{ name: string }>(`
      SELECT DISTINCT empname AS name
      FROM useraccounts
      WHERE empname IS NOT NULL AND TRIM(empname) <> ''
      ORDER BY empname
    `);
    return rows.map((row) => row.name);
  }

  async getSummary(date: string, cashier = ''): Promise<ReportSummary> {
    const rows = await this.db.query<any>(
      `WITH report_args AS (
        SELECT ? AS report_date, ? AS cashier
      ), sales AS (
        SELECT
          COALESCE(SUM(s.salestotalamount + COALESCE(s.salesdisc, 0) + COALESCE(s.specialdisc, 0)), 0) AS totalSales,
          COALESCE(SUM(CASE WHEN s.salespaym = 'CASH' THEN COALESCE(s.salestender, 0) - COALESCE(s.saleschange, 0) ELSE 0 END), 0) AS totalCash,
          COALESCE(SUM(CASE WHEN s.salespaym IN ('EWALLET', 'GCASH') THEN COALESCE(s.salestender, 0) ELSE 0 END), 0) AS totalEwallet,
          COALESCE(SUM(CASE WHEN s.salespaym = 'BANK TRANSFER' THEN COALESCE(s.salestender, 0) ELSE 0 END), 0) AS totalBankTransfer,
          COALESCE(SUM(COALESCE(s.salesdisc, 0)), 0) AS totalDiscounts,
          COALESCE(SUM(COALESCE(s.specialdisc, 0)), 0) AS totalSpecialDiscount,
          COALESCE(SUM(CASE WHEN s.salestatus = 'UNPAID' THEN COALESCE(s.tenderbalance, 0) ELSE 0 END), 0) AS totalCredit
        FROM salestbl s CROSS JOIN report_args a
        WHERE DATE(s.salesdate) = DATE(a.report_date)
          AND s.salestatus <> 'CANCELLED'
          AND (a.cashier = '' OR s.salescashier = a.cashier)
      ), paid AS (
        SELECT COALESCE(SUM(p.cppay), 0) AS totalPaid
        FROM creditpaymenttbl p CROSS JOIN report_args a
        WHERE DATE(p.cppaydate) = DATE(a.report_date)
          AND (a.cashier = '' OR p.cpcashier = a.cashier)
      ), petty AS (
        SELECT
          COALESCE(SUM(CASE WHEN p.pettylogtype = 'CASH IN' THEN p.pettylogamount ELSE 0 END), 0) AS totalCapital,
          COALESCE(SUM(CASE WHEN p.pettylogtype = 'CASH OUT' THEN p.pettylogamount ELSE 0 END), 0) AS totalExpense
        FROM pettylogstbl p CROSS JOIN report_args a
        WHERE DATE(p.pettylogdate) = DATE(a.report_date)
          AND (a.cashier = '' OR p.pettylogby = a.cashier)
      ), purchases AS (
        SELECT COALESCE(SUM(p.restockprice), 0) AS totalPurchase
        FROM pouttbl p CROSS JOIN report_args a
        WHERE DATE(p.pulldate) = DATE(a.report_date)
          AND p.pulloutremarks = 'CONFIRMED'
          AND p.pouttype IN ('RESTOCK IN', 'RESTOCK OUT', 'W.RESTOCK IN', 'W.RESTOCK OUT')
          AND (a.cashier = '' OR p.poutencoder = a.cashier)
      ), salaries AS (
        SELECT COALESCE(SUM(grouped.paid), 0) AS totalSalaryPaid
        FROM (
          SELECT h.salrefnum, MAX(COALESCE(h.salpaid, 0)) AS paid
          FROM salhistory h CROSS JOIN report_args a
          WHERE DATE(h.salrefdate) = DATE(a.report_date)
            AND (a.cashier = '' OR h.salpaidby = a.cashier)
          GROUP BY h.salrefnum
        ) grouped
      )
      SELECT sales.*, paid.totalPaid, petty.totalCapital, petty.totalExpense,
        purchases.totalPurchase, salaries.totalSalaryPaid
      FROM sales CROSS JOIN paid CROSS JOIN petty CROSS JOIN purchases CROSS JOIN salaries`,
      [date, cashier]
    );

    const row = rows[0] ?? {};
    const summary = {
      totalSales: Number(row.totalSales) || 0,
      totalCash: Number(row.totalCash) || 0,
      totalEwallet: Number(row.totalEwallet) || 0,
      totalBankTransfer: Number(row.totalBankTransfer) || 0,
      totalPaid: Number(row.totalPaid) || 0,
      totalCapital: Number(row.totalCapital) || 0,
      totalDiscounts: Number(row.totalDiscounts) || 0,
      totalSpecialDiscount: Number(row.totalSpecialDiscount) || 0,
      totalCredit: Number(row.totalCredit) || 0,
      totalPurchase: Number(row.totalPurchase) || 0,
      totalExpense: Number(row.totalExpense) || 0,
      totalSalaryPaid: Number(row.totalSalaryPaid) || 0,
    };

    return {
      ...summary,
      finalTotal:
        summary.totalSales +
        summary.totalPaid +
        summary.totalCapital -
        summary.totalDiscounts -
        summary.totalSpecialDiscount -
        summary.totalCredit -
        summary.totalPurchase -
        summary.totalExpense -
        summary.totalSalaryPaid,
    };
  }

  async getItemSold(fromDate: string, toDate: string): Promise<ItemSoldReport> {
    const rows = await this.db.query<any>(
      `SELECT
         sc.scitemcode AS itemCode,
         COALESCE(sc.scpackage, '') AS size,
         COALESCE(SUM(sc.scqty), 0) AS totalItems
       FROM salescart sc
       INNER JOIN salestbl s ON s.salesrefnum = sc.screfnum
       WHERE DATE(sc.scdate) >= DATE(?)
         AND DATE(sc.scdate) <= DATE(?)
         AND s.salestatus <> 'CANCELLED'
       GROUP BY sc.scitemcode, sc.scpackage
       ORDER BY sc.scitemcode, sc.scpackage`,
      [fromDate, toDate]
    );

    const reportRows = rows.map((row) => ({
      itemCode: String(row.itemCode ?? ''),
      size: String(row.size ?? ''),
      totalItems: Number(row.totalItems) || 0,
    }));
    const totalItems = reportRows.reduce((sum, row) => sum + row.totalItems, 0);
    const totalKg = reportRows.reduce(
      (sum, row) => sum + row.totalItems * this.sizeInKg(row.size),
      0
    );

    return { rows: reportRows, totalItems, totalKg };
  }

  async getInventorySnapshot(date: string, location: 'STORE' | 'WAREHOUSE'):
    Promise<any[]> {
    if (date === this.getLocalDate()) {
      const filledColumn = location === 'STORE' ? 'fillqty' : 'whfill';
      const emptyColumn = location === 'STORE' ? 'emptyqty' : 'whempty';
      return this.db.query(
        `SELECT itemcode AS itemCode, itemname AS description,
           COALESCE(${filledColumn}, 0) AS filledQty,
           COALESCE(${emptyColumn}, 0) AS emptyQty
         FROM inventorytbl
         ORDER BY itemcode`
      );
    }

    return this.db.query(
      `SELECT item_code AS itemCode, description, filled_qty AS filledQty,
         empty_qty AS emptyQty
       FROM daily_inventory_snapshots
       WHERE snapshot_date = ? AND location = ?
       ORDER BY item_code`,
      [date, location]
    );
  }

  async getFloorstockSnapshot(date: string, cashier = ''): Promise<any[]> {
    if (date === this.getLocalDate()) {
      return this.db.query(
        `SELECT i.itemcode AS itemCode, COALESCE(i.fillqty, 0) AS filledQty,
           COALESCE(i.floorstock, 0) AS floorstock,
           MAX(0, COALESCE(i.floorstock, 0) - COALESCE(i.fillqty, 0)) AS restockNeed
         FROM inventorytbl i
         LEFT JOIN daily_inventory_snapshots s
           ON s.snapshot_date = ? AND s.location = 'STORE' AND s.item_code = i.itemcode
         WHERE (? = '' OR s.cashier_name = ?)
         ORDER BY i.itemcode`,
        [date, cashier, cashier]
      );
    }

    return this.db.query(
      `SELECT item_code AS itemCode, filled_qty AS filledQty, floorstock,
         MAX(0, floorstock - filled_qty) AS restockNeed
       FROM daily_inventory_snapshots
       WHERE snapshot_date = ? AND location = 'STORE'
         AND (? = '' OR cashier_name = ?)
       ORDER BY item_code`,
      [date, cashier, cashier]
    );
  }

  private sizeInKg(size: string): number {
    const normalized = size.trim().toLowerCase().replace(',', '.');
    const amount = Number(normalized.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? 0);
    if (!amount) return 0;
    if (normalized.includes('gram') || /\bg\b/.test(normalized)) {
      return amount / 1000;
    }
    return normalized.includes('kg') ? amount : 0;
  }

  private getLocalDate(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
  }
}