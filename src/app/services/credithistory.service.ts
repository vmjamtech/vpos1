import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root',
})
export class CreditHistoryService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getCreditHistorydb(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
    SELECT * from creditpaymenttbl 
   
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching creditpaymenttbl:', error);
      throw new Error('Failed to load creditpaymenttbl.');
    }
  }

  async getCreditHistoryByrefnumdb(
    refnum: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
    SELECT * FROM creditpaymenttbl WHERE cprefnum= ?
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [refnum, limit, offset]);
    } catch (error) {
      console.error('Error fetching creditpaymenttbl:', error);
      throw new Error('Failed to load creditpaymenttbl.');
    }
  }

  async insertCreditPayment(creditpayment: any): Promise<void> {
    // 1. Insert into creditpaymenttbl
    const insertSql = `
    INSERT INTO creditpaymenttbl 
      (cprefnum, cpcustname, cpcashier, cppaydate, cppay, cpcustcat, cpbalance, cprembal, cpcustid, ri, cppaymethod) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const params = [
      creditpayment.cprefnum,
      creditpayment.cpcustname,
      creditpayment.cpcashier,
      creditpayment.cppaydate,
      creditpayment.cppay,
      creditpayment.cpcustcat,
      creditpayment.cpbalance,
      creditpayment.cprembal,
      creditpayment.cpcustid,
      creditpayment.ri,
      creditpayment.cppaymethod,
    ];
    await this.db.insert(insertSql, params);

    // 2. Update customer balances
    await this.db.execute(
      `UPDATE custinfo 
     SET custbalance = custbalance - ?, 
         ribalance = ribalance + ? 
     WHERE custid = ?`,
      [creditpayment.cppay, creditpayment.cprembal, creditpayment.cpcustid]
    );

    // 3. Update sales tenderbalance
    await this.db.execute(
      `UPDATE salestbl 
     SET tenderbalance = tenderbalance - ? 
     WHERE salesrefnum = ?`,
      [creditpayment.cppay, creditpayment.cprefnum]
    );

    // 4. If remaining balance <= 0, mark sales as PAID
    const sale = await this.db.query(
      `SELECT tenderbalance FROM salestbl WHERE salesrefnum = ?`,
      [creditpayment.cprefnum]
    );
    if (sale.length && sale[0].tenderbalance <= 0) {
      await this.db.execute(
        `UPDATE salestbl SET salestatus = 'PAID' WHERE salesrefnum = ?`,
        [creditpayment.cprefnum]
      );
    }
  }

  async updateTransaction(sales: {
    salesrefnum: string;
    salespaym: string;
    salestender: number;
    salespaytype: string;
    tenderbalance: number;
    custid: number;
    ptype: string; // FULL or PARTIAL
    tenderlbl: number;
    empname: string;
  }): Promise<void> {
    const sql = `
      UPDATE salestbl 
      SET salespaym=?, salestender=?, tenderbalance=?, salespaytype=?, salestatus='PAID'
      WHERE salesrefnum=?
    `;
    const params = [
      sales.salespaym,
      sales.salestender,
      sales.tenderbalance * -1, // same as VB.NET multiply by -1
      sales.salespaytype,
      sales.salesrefnum,
    ];
    await this.db.execute(sql, params);

    // Update customer balance for partial payments
    if (sales.ptype === 'PARTIAL PAYMENT') {
      const sqlCust = `
        UPDATE custinfo
        SET custbalance = custbalance - ?
        WHERE custid=?
      `;
      await this.db.execute(sqlCust, [sales.tenderlbl, sales.custid]);
    }
  }

  /** Update transaction to UNPAID */
  async updateToUnpaid(data: {
    salesrefnum: string;
    salespaym: string;
    salestender: number;
    salespaytype: string;
    origamount: number;
    ntrbalance: number;
    custid: number;
    empname: string;
  }): Promise<void> {
    const newAmount = data.origamount - data.salestender;

    const sql = `
      UPDATE salestbl
      SET salespaym=?, salestender=?, tenderbalance=?, salespaytype=?, tendertotal=?, salestatus='UNPAID'
      WHERE salesrefnum=?
    `;
    const params = [
      data.salespaym,
      data.salestender,
      data.ntrbalance + newAmount,
      data.salespaytype,
      data.ntrbalance + newAmount,
      data.salesrefnum,
    ];
    await this.db.execute(sql, params);
    // Update customer balance
    const sqlCust = `
      UPDATE custinfo
      SET custbalance = custbalance + ?
      WHERE custid=?
    `;
    await this.db.execute(sqlCust, [newAmount, data.custid]);
  }
}
