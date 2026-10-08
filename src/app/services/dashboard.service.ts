import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getSales(
    fromDate: string,
    toDate: string,
    role: string,
    empName?: string
  ): Promise<number> {
    let totalSales = 0;

    let sql = '';
    const params: any[] = [fromDate, toDate];

    if (role?.toUpperCase() !== 'ADMINISTRATOR') {
      sql = `
        SELECT 
          IFNULL(SUM(salestotalamount), 0) 
          + IFNULL(SUM(salesdisc), 0) 
          + IFNULL(SUM(specialdisc), 0) AS total
        FROM salestbl
        WHERE DATE(salesdate) >= DATE(?)
          AND DATE(salesdate) <= DATE(?)
          AND salestatus <> 'CANCELLED'
          AND salescashier = ?
      `;
      params.push(empName);
    } else {
      sql = `
        SELECT 
          IFNULL(SUM(salestotalamount), 0) 
          + IFNULL(SUM(salesdisc), 0) 
          + IFNULL(SUM(specialdisc), 0) AS total
        FROM salestbl
        WHERE DATE(salesdate) >= DATE(?)
          AND DATE(salesdate) <= DATE(?)
          AND salestatus <> 'CANCELLED'
      `;
    }

    try {
      const res: any[] = await this.db.query(sql, params);
      if (res.length > 0) {
        totalSales = Number(res[0].total);
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
    }

    return totalSales;
  }

  async getProfit(fromDate: string, toDate: string): Promise<number> {
    let profit = 0;

    const sql = `
    SELECT
      SUM(a.total) AS totalsales,
      SUM(a.totaltender) AS totaltender,
      SUM(a.totalcreditcash) AS totalcreditcash,
      SUM(a.totalgcash) AS totalgcash,
      SUM(a.totalcreditgcash) AS totalcreditgcash,
      SUM(a.totalbank) AS totalbank,
      SUM(a.totalcreditbank) AS totalcreditbank,
      SUM(a.totaldiscount) AS totaldiscount,
      SUM(a.totalcredit) AS totalcredit,
      SUM(a.totalcreditpay) AS totalcreditpay,
      SUM(a.totalexpense) AS totalexpense,
      SUM(a.totalsalpaid) AS totalsalpaid,
      SUM(a.totalcashin) AS totalcashin,
      SUM(a.totalchange) AS totalchange,
      SUM(a.sumcost) AS sumcost,
      SUM(a.tender) AS tender,
      SUM(a.spcdisc) AS spcdisc,
      SUM(a.purchase) AS purchase
    FROM (
      -- Sales totals
      SELECT
        IFNULL(SUM(salestotalamount),0) AS total,
        IFNULL(SUM(CASE WHEN salespaym='CASH' THEN salestender - saleschange ELSE 0 END),0) AS totaltender,
        0 AS totalcreditcash,
        IFNULL(SUM(CASE WHEN salespaym='GCASH' THEN salestender ELSE 0 END),0) AS totalgcash,
        0 AS totalcreditgcash,
        IFNULL(SUM(CASE WHEN salespaym='BANK TRANSFER' THEN salestender ELSE 0 END),0) AS totalbank,
        0 AS totalcreditbank,
        IFNULL(SUM(salesdisc),0) AS totaldiscount,
        IFNULL(SUM(tendertotal),0) AS totalcredit,
        0 AS totalcreditpay,
        0 AS totalexpense,
        0 AS totalsalpaid,
        0 AS totalcashin,
        IFNULL(SUM(saleschange),0) AS totalchange,
        0 AS sumcost,
        IFNULL(SUM(salestender - saleschange),0) AS tender,
        IFNULL(SUM(specialdisc),0) AS spcdisc,
        0 AS purchase
      FROM salestbl
      WHERE DATE(salesdate) BETWEEN DATE(?) AND DATE(?)
        AND salestatus <> 'CANCELLED'

      UNION ALL

      -- Credit payments
      SELECT
        0 AS total,
        0 AS totaltender,
        IFNULL(SUM(CASE WHEN cppaymethod='CASH' THEN cppay ELSE 0 END),0) AS totalcreditcash,
        0 AS totalgcash,
        IFNULL(SUM(CASE WHEN cppaymethod='GCASH' THEN cppay ELSE 0 END),0) AS totalcreditgcash,
        0 AS totalbank,
        IFNULL(SUM(CASE WHEN cppaymethod='BANK TRANSFER' THEN cppay ELSE 0 END),0) AS totalcreditbank,
        0 AS totaldiscount,
        0 AS totalcredit,
        IFNULL(SUM(cppay),0) AS totalcreditpay,
        0 AS totalexpense,
        0 AS totalsalpaid,
        0 AS totalcashin,
        0 AS totalchange,
        0 AS sumcost,
        0 AS tender,
        0 AS spcdisc,
        0 AS purchase
      FROM creditpaymenttbl
      WHERE DATE(cppaydate) BETWEEN DATE(?) AND DATE(?)

      UNION ALL

      -- Petty logs
      SELECT
        0 AS total,
        0 AS totaltender,
        0 AS totalcreditcash,
        0 AS totalgcash,
        0 AS totalcreditgcash,
        0 AS totalbank,
        0 AS totalcreditbank,
        0 AS totaldiscount,
        0 AS totalcredit,
        0 AS totalcreditpay,
        IFNULL(SUM(CASE WHEN pettylogtype='CASH OUT' THEN pettylogamount ELSE 0 END),0) AS totalexpense,
        0 AS totalsalpaid,
        IFNULL(SUM(CASE WHEN pettylogtype='CASH IN' THEN pettylogamount ELSE 0 END),0) AS totalcashin,
        0 AS totalchange,
        0 AS sumcost,
        0 AS tender,
        0 AS spcdisc,
        0 AS purchase
      FROM pettylogstbl
      WHERE DATE(pettylogdate) BETWEEN DATE(?) AND DATE(?)

      UNION ALL

      -- Sale history
      SELECT
        0 AS total,
        0 AS totaltender,
        0 AS totalcreditcash,
        0 AS totalgcash,
        0 AS totalcreditgcash,
        0 AS totalbank,
        0 AS totalcreditbank,
        0 AS totaldiscount,
        0 AS totalcredit,
        0 AS totalcreditpay,
        0 AS totalexpense,
        IFNULL(salpaid,0) AS totalsalpaid,
        0 AS totalcashin,
        0 AS totalchange,
        0 AS sumcost,
        0 AS tender,
        0 AS spcdisc,
        0 AS purchase
      FROM salhistory
      WHERE DATE(salrefdate) BETWEEN DATE(?) AND DATE(?)
      GROUP BY salrefnum

      UNION ALL

      -- Pullouts
      SELECT
        0 AS total,
        0 AS totaltender,
        0 AS totalcreditcash,
        0 AS totalgcash,
        0 AS totalcreditgcash,
        0 AS totalbank,
        0 AS totalcreditbank,
        0 AS totaldiscount,
        0 AS totalcredit,
        0 AS totalcreditpay,
        0 AS totalexpense,
        0 AS totalsalpaid,
        0 AS totalcashin,
        0 AS totalchange,
        0 AS sumcost,
        0 AS tender,
        0 AS spcdisc,
        IFNULL(SUM(restockprice),0) AS purchase
      FROM pouttbl
      WHERE DATE(pulldate) BETWEEN DATE(?) AND DATE(?)
        AND pulloutremarks='CONFIRMED'

      UNION ALL

      -- Sale cost
      SELECT
        0 AS total,
        0 AS totaltender,
        0 AS totalcreditcash,
        0 AS totalgcash,
        0 AS totalcreditgcash,
        0 AS totalbank,
        0 AS totalcreditbank,
        0 AS totaldiscount,
        0 AS totalcredit,
        0 AS totalcreditpay,
        0 AS totalexpense,
        0 AS totalsalpaid,
        0 AS totalcashin,
        0 AS totalchange,
        IFNULL(SUM(t2.scqty * t3.itemcost),0) AS sumcost,
        0 AS tender,
        0 AS spcdisc,
        0 AS purchase
      FROM salestbl t1
      INNER JOIN salescart t2 ON t1.salesrefnum = t2.screfnum AND t1.salestatus<>'CANCELLED'
      LEFT JOIN inventorytbl t3 ON t2.scitemcode = t3.itemcode
      WHERE DATE(salesdate) BETWEEN DATE(?) AND DATE(?)
    ) a
  `;

    const params = [
      fromDate,
      toDate, // Sales
      fromDate,
      toDate, // Credit payments
      fromDate,
      toDate, // Petty logs
      fromDate,
      toDate, // Sale history
      fromDate,
      toDate, // Pullouts
      fromDate,
      toDate, // Sale cost
    ];

    try {
      const res: any[] = await this.db.query(sql, params);
      if (res.length > 0) {
        const row = res[0];

        const margin =
          row.totalsales + row.totaldiscount + row.spcdisc - row.sumcost;
        const income = row.totalcreditpay + row.totalcashin;
        const expense =
          row.totalexpense +
          row.totalcredit +
          row.totalsalpaid +
          row.totaldiscount +
          row.spcdisc;

        profit = margin + income - expense;
      }
    } catch (err) {
      console.error('Error fetching profit:', err);
    }

    return profit;
  }

  async getTotalExpense(
    fromDate: string,
    toDate: string,
    role: string,
    empName?: string
  ): Promise<number> {
    let totalExpense = 0;
    let sql = '';
    let params: any[] = [];

    if (role !== 'ADMINISTRATOR') {
      sql = `
      SELECT IFNULL(SUM(a.amount), 0) AS amount
      FROM (
        SELECT pettylogremarks AS rem, pettylogamount AS amount, pettylogdate AS cdate
        FROM pettylogstbl
        WHERE DATE(pettylogdate) BETWEEN DATE(?) AND DATE(?)
          AND pettylogby = ?
          AND pettylogtype = 'CASH OUT'
        UNION ALL
        SELECT pouttype AS rem, restockprice AS amount, pulldate AS cdate
        FROM pouttbl
        WHERE restockprice <> 0
          AND DATE(pulldate) BETWEEN DATE(?) AND DATE(?)
          AND poutencoder = ?
      ) a
    `;
      // define all parameters at once
      params = [fromDate, toDate, empName, fromDate, toDate, empName];
    } else {
      sql = `
      SELECT IFNULL(SUM(a.amount), 0) AS amount
      FROM (
        SELECT pettylogremarks AS rem, pettylogamount AS amount, pettylogdate AS cdate
        FROM pettylogstbl
        WHERE DATE(pettylogdate) BETWEEN DATE(?) AND DATE(?)
          AND pettylogtype = 'CASH OUT'
        UNION ALL
        SELECT pouttype AS rem, restockprice AS amount, pulldate AS cdate
        FROM pouttbl
        WHERE restockprice <> 0
          AND DATE(pulldate) BETWEEN DATE(?) AND DATE(?)
      ) a
    `;
      params = [fromDate, toDate, fromDate, toDate];
    }

    try {
      const res: any[] = await this.db.query(sql, params);
      if (res.length > 0) {
        totalExpense = Number(res[0].amount);
      }
    } catch (err) {
      console.error('Error fetching total expense:', err);
    }

    return totalExpense;
  }

  async getItemsSold(
    fromDate: string,
    toDate: string,
    role: string,
    empName?: string
  ): Promise<number> {
    let itemsSold = 0;
    let sql = '';
    let params: any[] = [fromDate, toDate];

    if (role === 'ADMINISTRATOR') {
      sql = `
      SELECT IFNULL(SUM(t2.scqty), 0) AS sumcost
      FROM salestbl t1
      INNER JOIN salescart t2 ON t1.salesrefnum = t2.screfnum AND t1.salestatus <> 'CANCELLED'
      LEFT JOIN inventorytbl t3 ON t2.scitemcode = t3.itemcode
      WHERE DATE(salesdate) BETWEEN DATE(?) AND DATE(?)
    `;
    } else {
      sql = `
      SELECT IFNULL(SUM(t2.scqty), 0) AS sumcost
      FROM salestbl t1
      INNER JOIN salescart t2 ON t1.salesrefnum = t2.screfnum AND t1.salestatus <> 'CANCELLED'
      LEFT JOIN inventorytbl t3 ON t2.scitemcode = t3.itemcode
      WHERE DATE(salesdate) BETWEEN DATE(?) AND DATE(?)
        AND t1.salescashier = ?
    `;
      params.push(empName);
    }

    try {
      const res: any[] = await this.db.query(sql, params);
      if (res.length > 0) {
        itemsSold = Number(res[0].sumcost);
      }
    } catch (err) {
      console.error('Error fetching items sold:', err);
    }

    return itemsSold;
  }

  async getTopItemsSold(
    fromDate: string,
    toDate: string
  ): Promise<{ scitemcode: string; scitemdesc: string; quantity: number }[]> {
    const sql = `
    SELECT scitemcode, scitemdesc, SUM(scqty) AS quantity
    FROM salescart
    WHERE DATE(scdate) >= DATE(?)
      AND DATE(scdate) <= DATE(?)
      AND scstats = 'PAID'
    GROUP BY scitemcode
    ORDER BY SUM(scqty) DESC
    LIMIT 5
  `;

    const params = [fromDate, toDate];

    try {
      const res: any[] = await this.db.query(sql, params);
      return res.map((r) => ({
        scitemcode: r.scitemcode,
        scitemdesc: r.scitemdesc,
        quantity: Number(r.quantity),
      }));
    } catch (err) {
      console.error('Error fetching top items sold:', err);
      return [];
    }
  }

  async getLatestSalesDate(): Promise<string | null> {
    const sql = `
      SELECT DATE(MAX(scdate)) AS latestDate
      FROM salescart
      WHERE scstats = 'PAID'
    `;

    try {
      const res: any[] = await this.db.query(sql);
      const value = res?.[0]?.latestDate;
      return value ? String(value) : null;
    } catch (err) {
      console.error('Error fetching latest sales date:', err);
      return null;
    }
  }

  async getPersonnelTransactions(
    fromDate: string,
    toDate: string,
    role: string,
    empName?: string
  ): Promise<{ pname: string; transcount: number; salary: number }[]> {
    let sql = '';
    const isAdmin = role?.toUpperCase() === 'ADMINISTRATOR';
    const params: any[] = !isAdmin
        ? [fromDate, toDate, empName] // include empName if not admin
        : [fromDate, toDate]; // admin only needs dates

    sql = !isAdmin
        ? `
      SELECT e.pname, COUNT(DISTINCT et.dtrefnum) AS transcount, SUM(et.dsalary) AS salary
      FROM personeltbl e
      LEFT JOIN deltransacttbl et ON e.pid = et.dtdelbyid OR e.pid = et.dtdelbyid2
      INNER JOIN salestbl st ON st.salesrefnum = et.dtrefnum AND st.salestatus <> 'CANCELLED'
      WHERE DATE(dtdate) BETWEEN DATE(?) AND DATE(?)
        AND et.delcashier = ?
      GROUP BY e.pname
    `
        : `
      SELECT e.pname, COUNT(DISTINCT et.dtrefnum) AS transcount, SUM(et.dsalary) AS salary
      FROM personeltbl e
      LEFT JOIN deltransacttbl et ON e.pid = et.dtdelbyid OR e.pid = et.dtdelbyid2
      INNER JOIN salestbl st ON st.salesrefnum = et.dtrefnum AND st.salestatus <> 'CANCELLED'
      WHERE DATE(dtdate) BETWEEN DATE(?) AND DATE(?)
      GROUP BY e.pname
    `;

    try {
      const res: any[] = await this.db.query(sql, params);
      return res.map((r) => ({
        pname: r.pname,
        transcount: Number(r.transcount),
        salary: Number(r.salary),
      }));
    } catch (err) {
      console.error('Error fetching personnel transactions:', err);
      return [];
    }
  }

  async getExpenseDetails(
    fromDate: string,
    toDate: string,
    role: string,
    empName?: string
  ): Promise<{ rem: string; amount: number; cdate: string }[]> {
    let sql = '';
    let params: any[] = [];

    if (role !== 'ADMINISTRATOR') {
      sql = `
        SELECT * FROM (
          SELECT pettylogremarks AS rem, pettylogamount AS amount, pettylogdate AS cdate
          FROM pettylogstbl
          WHERE DATE(pettylogdate) BETWEEN DATE(?) AND DATE(?)
            AND pettylogby = ?
            AND pettylogtype = 'CASH OUT'
          UNION ALL
          SELECT pouttype AS rem, restockprice AS amount, pulldate AS cdate
          FROM pouttbl
          WHERE restockprice <> 0
            AND DATE(pulldate) BETWEEN DATE(?) AND DATE(?)
            AND poutencoder = ?
        ) a
        ORDER BY cdate DESC;
      `;
      params = [fromDate, toDate, empName, fromDate, toDate, empName];
    } else {
      sql = `
        SELECT * FROM (
          SELECT pettylogremarks AS rem, pettylogamount AS amount, pettylogdate AS cdate
          FROM pettylogstbl
          WHERE DATE(pettylogdate) BETWEEN DATE(?) AND DATE(?)
            AND pettylogtype = 'CASH OUT'
          UNION ALL
          SELECT pouttype AS rem, restockprice AS amount, pulldate AS cdate
          FROM pouttbl
          WHERE restockprice <> 0
            AND DATE(pulldate) BETWEEN DATE(?) AND DATE(?)
        ) a
        ORDER BY cdate DESC;
      `;
      params = [fromDate, toDate, fromDate, toDate];
    }

    try {
      const res: any[] = await this.db.query(sql, params);
      return res.map((r) => ({
        rem: r.rem,
        amount: Number(r.amount),
        cdate: r.cdate,
      }));
    } catch (err) {
      console.error('Error fetching expense details:', err);
      return [];
    }
  }

  async getLendDetails(
    fromDate: string,
    toDate: string
  ): Promise<{ customer: string; itemcode: string; itemname: string; qty: number; cdate: string, status: string }[]> {
    let sql = '';
    let params: any[] = [];

    sql = `
         SELECT t1.lenddate as cdate, t2.salesdate as salesdate, t1.lendrefnum, t1.lendcustid, t1.lendcustname as rem, t1.lenditemcode, 
          t1.lenditemname, t1.lendqty as qty, t1.returnqty, t1.lendstatus, t2.salesdelby || ' | ' || t2.salesdelby2 AS sales_delivery 
          FROM lendhistory t1 INNER JOIN salestbl t2 ON t1.lendrefnum = t2.salesrefnum 
          WHERE t1.lendstatus <> 'R-DELETED' 
          and DATE(t1.lenddate) BETWEEN DATE(?) AND DATE(?)
          ORDER BY t1.lenddate DESC 
      `;
    params = [fromDate, toDate];

    try {
      const res: any[] = await this.db.query(sql, params);
      return res.map((r) => ({
        customer: r.rem,  
        qty: Number(r.qty),
        itemcode: r.lenditemcode,
        itemname: r.lenditemname,
        cdate: r.cdate, 
        status: r.lendstatus, 
      }));
    } catch (err) {
      console.error('Error fetching getLendDetails  :', err);
      return [];
    }
  }

  async getLowStocks(): Promise<any[]> {
    const sql = `
    SELECT 
      itemid,
      itemcode,
      itemname,
      itemsize,
      fillqty,
      alertnum
    FROM inventorytbl
    WHERE fillqty <= alertnum and alertnum > 0
    ORDER BY fillqty ASC;
  `;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching getLowStocks:', error);
      throw new Error('Failed to load getLowStocks.');
    }
  }

  async getWhLowStocks(): Promise<any[]> {
    const sql = `
    SELECT 
      itemid,
      itemcode,
      itemname,
      itemsize,
      whfill,
      icount
    FROM inventorytbl
    WHERE whfill <= icount and icount > 0
    ORDER BY whfill ASC;
  `;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching getWhLowStocks:', error);
      throw new Error('Failed to load getWhLowStocks.');
    }
  }
}
