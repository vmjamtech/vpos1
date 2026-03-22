import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getCustomers(limit: number = 20, offset: number = 0): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/customers/filter/offset?limit=${limit}&offset=${offset}`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async searchCustomers(query: string): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${
      connection.port
    }/customers/search/q?q=${encodeURIComponent(query)}`;
    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async getAllCustomers(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/customers/select/all`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async adjustCustomerBalance(custid: number, amount: number): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/customers/${custid}/balance`;

    // Send PATCH request with JSON body
    const response = await firstValueFrom(
      this.http.patch<any>(url, { amount })
    );
    return response;
  }

  async updateBalance(custid: number, amount: number): Promise<any> {
    if (isNaN(custid)) {
      throw new Error('Invalid customer ID');
    }

    // Update custbalance
    const updateQuery = `
      UPDATE custinfo
      SET custbalance = custbalance + ?
      WHERE custid = ?
    `;
    await this.db.execute(updateQuery, [amount, custid]);

    // Return updated customer
    const row = await this.db.query(
      `SELECT * FROM custinfo WHERE custid = ? LIMIT 1`,
      [custid]
    );

    if (!row || row.length === 0) {
      throw new Error('Customer not found');
    }

    return row[0];
  }

  //for offline sqlite database
  async getCustomersdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * from custinfo
    WHERE custstatus <> 'inactive'
    ORDER BY custname ASC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching Customers:', error);
      throw new Error('Failed to load Customers.');
    }
  }

  async getCustomersBalancedb(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
  SELECT * FROM (
    SELECT custid, custname, custadd, custemail, custcontnum, custbalance, lendqty, custstatus 
    FROM custinfo
    WHERE custbalance > 0 AND custstatus <> 'inactive'

    UNION ALL

    SELECT custid, custname || '--(inactive)' AS custname, custadd, custemail, custcontnum, custbalance, lendqty, custstatus
    FROM custinfo
    WHERE custbalance > 0 AND custstatus = 'inactive'
  ) AS combined
  ORDER BY CASE WHEN custstatus='inactive' THEN 1 ELSE 0 END, custname ASC
  LIMIT ?
  OFFSET ?
`;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching Customers:', error);
      throw new Error('Failed to load Customers.');
    }
  }

  async searchCustomersOffline(query: string): Promise<any[]> {
    const sql = `
    SELECT * 
    FROM custinfo
    WHERE custstatus <> 'inactive'
      AND (
        custname LIKE '%' || ? || '%'
        OR custadd LIKE '%' || ? || '%'
      )
    ORDER BY custname ASC 
  `;

    try {
      const rows = await this.db.query(sql, [query, query]);
      return rows;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw new Error('Failed to search customers.');
    }
  }

  async searchCustomersOfflineSpecific(query: string): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM custinfo
    WHERE custstatus <> 'inactive'
  `;

    const params: any[] = [];
    if (query) {
      // check for field prefix
      const colonIndex = query.indexOf(':');
      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (field === 'custname' || field === 'custadd') {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          // fallback: search both
          sql += ` AND (custname LIKE '%' || ? || '%' OR custadd LIKE '%' || ? || '%')`;
          params.push(query, query);
        }
      } else {
        // no prefix → search both
        sql += ` AND (custname LIKE '%' || ? || '%' OR custadd LIKE '%' || ? || '%')`;
        params.push(query, query);
      }
    }

    sql += ` ORDER BY custname ASC`;

    try {
      const rows = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw new Error('Failed to search customers.');
    }
  }

  async checknameExists(custname: string): Promise<boolean> {
    const sql = `SELECT 1 FROM custinfo WHERE custname = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [custname]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking custname:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async insert(data: {
    custname: string;
    custadd: string;
    custcontnum?: string;
    custemail?: string;
  }): Promise<boolean> {
    // Current timestamp in "YYYY-MM-DD HH:mm:ss"
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    const sql = `
    INSERT INTO custinfo (custname, custadd, custcontnum, custemail, custdate) 
     VALUES (?, ?, ?, ?, ?)
  `;

    const params = [
      data.custname,
      data.custadd,
      data.custcontnum || '',
      data.custemail || '',
      date,
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error inserting customer:', error);
      return false;
    }
  }
  async update(data: {
    custid: number;
    custname: string;
    custadd: string;
    custcontnum?: string;
    custemail?: string;
  }): Promise<boolean> {
    const sql = `
    UPDATE custinfo SET custname= ?, custadd= ?, custcontnum= ?, custemail= ? WHERE custid= ?`;

    const params = [
      data.custname,
      data.custadd,
      data.custcontnum || '',
      data.custemail || '',
      data.custid,
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      return false;
    }
  }

  async delete(id: number): Promise<number> {
    const sql = `
    DELETE FROM custinfo
    WHERE custid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async restore(id: number): Promise<number> {
    const sql = `
    UPDATE custinfo SET custstatus='active' 
    WHERE custid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async getCustomersBalance(): Promise<number> {
    const sql = `SELECT SUM(custbalance) AS totalBalance FROM custinfo`;

    try {
      const result = await this.db.query(sql);
      // result is usually an array of rows: [{ totalBalance: 123 }]
      const total = result[0]?.totalBalance ?? 0;
      return Number(total);
    } catch (error) {
      console.error('Error fetching Customers balance:', error);
      throw new Error('Failed to load Customers balance.');
    }
  }

  async getCustomerBalanceById(id: number): Promise<number> {
    const sql = `SELECT custbalance FROM custinfo WHERE custid = ?`;

    try {
      const result = await this.db.query(sql, [id]);
      const total = result[0]?.custbalance ?? 0;
      return Number(total);
    } catch (error) {
      console.error('Error fetching Customer balance:', error);
      throw new Error('Failed to load Customer balance.');
    }
  }

  async getCustomerTotalsById(
    id: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<number> {
    let sql = `
    SELECT 
      IFNULL(SUM(salestotalamount), 0.00) 
      + IFNULL(SUM(salesdisc), 0.00) 
      + IFNULL(SUM(specialdisc), 0.00) AS total 
    FROM salestbl 
    WHERE salescustid = ?
  `;

    const params: any[] = [id];

    // If date filter is provided, add to SQL
    if (dateFrom && dateTo) {
      sql += ` AND DATE(salesdate) BETWEEN DATE(?) AND DATE(?)`;
      params.push(dateFrom, dateTo);
    }

    try {
      const result = await this.db.query(sql, params);
      const total = result[0]?.total ?? 0;
      return Number(total);
    } catch (error) {
      console.error('Error fetching Customer totals:', error);
      throw new Error('Failed to load Customer totals.');
    }
  }

  async getCustomerTransactionById(
    custid?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `SELECT * FROM salestbl 
             WHERE salescustid= ? 
             ORDER BY salesid DESC
             LIMIT ? OFFSET ?`;

    try {
      return await this.db.query(sql, [custid, limit, offset]);
    } catch (error) {
      console.error('Error fetching Customer transactions:', error);
      throw new Error('Failed to load Customer transactions.');
    }
  }

  async getCustomerTransactionByIdAndDate(
    datefrom: string,
    dateto: string,
    limit: number = 20,
    offset: number = 0,
    custid?: number
  ): Promise<any[]> {
    const sql = `
    SELECT * 
    FROM salestbl
    WHERE salescustid = ?
      AND date(salesdate) >= date(?)
      AND date(salesdate) <= date(?)
    ORDER BY salesid DESC
    LIMIT ? OFFSET ?;
  `;

    try {
      return await this.db.query(sql, [
        custid,
        datefrom,
        dateto,
        limit,
        offset,
      ]);
    } catch (error) {
      console.error('Error fetching customer transactions:', error);
      throw new Error('Failed to load customer transactions.');
    }
  }

  async UpdateInactiveCustomers(): Promise<boolean> {
    const sql = `
               UPDATE custinfo 
    SET custstatus = 'inactive' 
    WHERE custid NOT IN (
        SELECT salescustid 
        FROM (
            SELECT salescustid, MAX(salesdate) AS max_salesdate
            FROM salestbl
            GROUP BY salescustid
        ) AS max_dates
        WHERE julianday('now') - julianday(max_salesdate) <= 180
    ) 
    AND julianday('now') - julianday(custdate) > 180;`;

    try {
      await this.db.query(sql);

      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      return false;
    }
  }

  async countInactive(): Promise<number> {
    const sql = `SELECT Count(*) AS count FROM custinfo WHERE custstatus='inactive' `;

    try {
      const result = await this.db.query(sql);
      // result is usually an array of rows: [{ totalBalance: 123 }]
      const total = result[0]?.count ?? 0;
      return Number(total);
    } catch (error) {
      console.error('Error fetching countInactive:', error);
      throw new Error('Failed to load countInactive.');
    }
  }

  async getInactiveCustomers(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `SELECT * FROM custinfo WHERE custstatus='inactive'
      ORDER BY custname ASC
      LIMIT ? OFFSET ?`;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching Customers:', error);
      throw new Error('Failed to load Customers.');
    }
  }

  async updateCustomerBalance(
    status: string,
    custId: number,
    newBalance: number,
    refnum: string,
    notes?: string
  ): Promise<void> {
    try {
      // Step 1: Update customer balance if status is UNPAID
      if (status === 'UNPAID') {
        await this.db.execute(
          `UPDATE custinfo 
         SET custbalance = custbalance - ? 
         WHERE custid = ?`,
          [newBalance, custId]
        );
        console.log(
          `SUCCESSFUL: UPDATE CUSTOMER BALANCE for customer ID: ${custId}`
        );
      }

      // Step 2: Cancel sales in salescart
      await this.db.execute(
        `UPDATE salescart 
       SET scstats = 'CANCELLED' 
       WHERE screfnum = ?`,
        [refnum]
      );
      console.log(
        `SUCCESSFUL: CANCELLED FROM SALESCART, REF NUMBER: ${refnum}`
      );

      // Step 3: Cancel sales in salestbl and reset tender balance
      await this.db.execute(
        `UPDATE salestbl 
       SET salestatus = 'CANCELLED', tenderbalance = 0 , salesremarks = salesremarks || CHAR(13) || CHAR(10) || ?
       WHERE salesrefnum = ?`,
        [`CANCELLATION NOTE : ${notes ?? ''}`, refnum]
      );
      console.log(
        `SUCCESSFUL: CANCELLED FROM SALES TABLE, REF NUMBER: ${refnum}`
      );

      // Step 4: Delete related credit payments
      await this.db.execute(
        `DELETE FROM creditpaymenttbl 
       WHERE cprefnum = ?`,
        [refnum]
      );
      console.log(`SUCCESSFUL: DELETED CREDIT HISTORY, REF NUMBER: ${refnum}`);
    } catch (error) {
      console.error(
        'Error updating customer balance or cancelling sales:',
        error
      );
      throw error; // propagate error if needed
    }
  }
}
