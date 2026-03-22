import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class LenditemsService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getLends(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/categories/all`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async getLendHistoryByFilter(
    dateFrom: string | null,
    dateTo: string | null,
    type: string, // 'ALL', 'LENDED', 'RETURNED'
    limit: number = 30,
    offset: number = 0
  ): Promise<any[]> {
    console.log('TYPE', type);
    let sql = `
    SELECT 
      t1.itemhdate,
      t1.itemhrefnum,
      t2.lendcustname,
      t1.itemhitemc,
      t2.lenditemname,
      t1.itemhqty,
      t1.itemhremarks
    FROM itemhistorytbl t1
    INNER JOIN lendhistory t2
      ON t1.itemhrefnum = t2.lendrefnum
      AND t1.itemhitemc = t2.lenditemcode
    WHERE t2.lendstatus <> 'R-DELETED'
  `;

    const params: any[] = [];

    // ---------------------------------------------------
    // ✅ DATE FILTER (only apply when both dateFrom & dateTo exist)
    // ---------------------------------------------------
    if (dateFrom && dateTo) {
      sql += `
      AND date(t1.itemhdate) >= date(?)
      AND date(t1.itemhdate) <= date(?)
    `;
      params.push(dateFrom, dateTo);
    }

    // ---------------------------------------------------
    // ✅ TYPE FILTER
    // ---------------------------------------------------
    if (type === 'LENDED') {
      sql += ` AND t1.itemhremarks LIKE ?`;
      params.push('%LEND ITEM%');
    } else if (type === 'RETURNED') {
      sql += ` AND t1.itemhremarks LIKE ?`;
      params.push('%DECREASE LEND QTY FROM RETURN ITEM%');
    } else if (type === 'ALL') {
      sql += ` AND (t1.itemhremarks LIKE ? OR t1.itemhremarks LIKE ?)`;
      params.push('%LEND ITEM%', '%DECREASE LEND QTY FROM RETURN ITEM%');
    }

    // ---------------------------------------------------
    // Pagination
    // ---------------------------------------------------
    sql += ` ORDER BY t1.itemhdate DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const result = await this.db.query(sql, params);

      // Map remarks to status
      return result.map((row: any) => ({
        itemhdate: row.itemhdate,
        itemhrefnum: row.itemhrefnum,
        lendcustname: row.lendcustname,
        itemhitemc: row.itemhitemc,
        lenditemname: row.lenditemname,
        itemhqty: row.itemhqty,
        status: row.itemhremarks.includes('DECREASE LEND QTY FROM RETURN ITEM')
          ? 'RETURNED'
          : 'LENDED',
      }));
    } catch (error) {
      console.error('Error fetching lend history:', error);
      throw new Error('Failed to load lend history.');
    }
  }

  async getLendHistory(limit: number = 30, offset: number = 0): Promise<any[]> {
    const sql = `
   SELECT t1.itemhdate, t1.itemhrefnum, t2.lendcustname, t1.itemhitemc, t2.lenditemname, t1.itemhqty, 
     t1.itemhremarks FROM itemhistorytbl t1 INNER JOIN lendhistory t2 ON t1.itemhrefnum = t2.lendrefnum and   
	 t1.itemhitemc=t2.lenditemcode WHERE t2.lendstatus <> 'R-DELETED'  AND (t1.itemhremarks LIKE '%DECREASE LEND QTY FROM RETURN ITEM%' OR t1.itemhremarks LIKE     
	 '%LEND ITEM%') ORDER BY t1.itemhdate DESC
    LIMIT ? OFFSET ?;
  `;

    try {
      const result = await this.db.query(sql, [limit, offset]);

      // Map remarks to status
      return result.map((row: any) => ({
        itemhdate: row.itemhdate,
        itemhrefnum: row.itemhrefnum,
        lendcustname: row.lendcustname,
        itemhitemc: row.itemhitemc,
        lenditemname: row.lenditemname,
        itemhqty: row.itemhqty,
        status: row.itemhremarks.includes('DECREASE LEND QTY FROM RETURN ITEM')
          ? 'RETURNED'
          : 'LENDED',
      }));
    } catch (error) {
      console.error('Error fetching lend history:', error);
      throw new Error('Failed to load lend history.');
    }
  }

  async getAllLendsdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT t1.lendid, t2.salesdate, t1.lendrefnum, t1.lendcustid, t1.lendcustname, t1.lenditemcode, 
    t1.lenditemname, t1.lendqty, t1.returnqty, t1.lendstatus, t2.salesdelby || ' | ' || t2.salesdelby2 AS sales_delivery 
    FROM lendhistory t1 INNER JOIN salestbl t2 ON t1.lendrefnum = t2.salesrefnum 
    WHERE t1.lendstatus <> 'R-DELETED' 
    ORDER BY t2.salesdate  DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching ALL lends:', error);
      throw new Error('Failed to load ALL lends.');
    }
  }

  async getLendorReturn(
    type: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
    SELECT t1.lendid, t2.salesdate, t1.lendrefnum, t1.lendcustid, t1.lendcustname, t1.lenditemcode, 
    t1.lenditemname, t1.lendqty, t1.returnqty, t1.lendstatus, t2.salesdelby || ' | ' || t2.salesdelby2 AS sales_delivery 
    FROM lendhistory t1 INNER JOIN salestbl t2 ON t1.lendrefnum = t2.salesrefnum 
    WHERE t1.lendstatus = ?
    ORDER BY t2.salesdate  DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [type, limit, offset]);
    } catch (error) {
      console.error('Error fetching Dispose:', error);
      throw new Error('Failed to load Dispose.');
    }
  }

  async searchOfflineSpecific(query: string): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM disposehistory
    WHERE disqty > 0 AND disremarks <> 'D-DELETED'
  `;

    const params: any[] = [];
    if (query) {
      // check for field prefix
      const colonIndex = query.indexOf(':');
      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (field === 'disitemcode' || field === 'disitemdesc') {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          // fallback: search both
          sql += ` AND (disitemcode LIKE '%' || ? || '%' OR disitemdesc LIKE '%' || ? || '%')`;
          params.push(query, query);
        }
      } else {
        // no prefix → search both
        sql += ` AND (disitemcode LIKE '%' || ? || '%' OR disitemdesc LIKE '%' || ? || '%')`;
        params.push(query, query);
      }
    }

    sql += `  ORDER BY disdate DESC`;

    try {
      const rows = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error searching disposehistory:', error);
      throw new Error('Failed to search disposehistory.');
    }
  }

  // Update existing inventory item
  async updateQty(item: {
    refnum: string;
    itemcode: string;
    qty: number;
  }): Promise<boolean> {
    const sql = `UPDATE inventorytbl SET lendqty = lendqty - ?, 
                 emptyqty = emptyqty + ? WHERE itemcode = ?`;

    const params = [item.qty, item.qty, item.itemcode];

    try {
      await this.db.query(sql, params);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
        now.getSeconds()
      )}`;
      // --- Insert into item history ---
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.refnum,
          item.itemcode,
          'RETURN ITEM',
          item.qty || 0,
          `DECREASE LEND QTY FROM RETURN ITEM REFNUM : ${item.refnum}`,
        ]
      );

      // --- Insert into item history ---
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.refnum,
          item.itemcode,
          'RETURN ITEM',
          item.qty || 0,
          `INCREASE STORE EMPTY QTY FROM RETURN ITEM REFNUM : ${item.refnum}`,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating lend updateQty:', error);
      return false;
    }
  }

  // Update existing inventory item
  async updateReturnAll(item: {
    lendid: number;
    refnum: string;
    itemcode: string;
    qty: number;
  }): Promise<boolean> {
    const sql = `UPDATE salescart SET sclendqty = 0, sclendstats ='RETURNED' 
                WHERE scitemcode = ? AND screfnum = ?`;

    const params = [item.itemcode, item.refnum];

    try {
      await this.db.query(sql, params);

      await this.db.query(
        `UPDATE lendhistory SET lendqty = 0, lendstatus ='RETURNED', returnqty = returnqty + ? 
        WHERE lenditemcode = ? AND lendid = ?`,
        [item.qty || 0, item.itemcode, item.lendid]
      );
      return true;
    } catch (error) {
      console.error('Error updating lend updateQty:', error);
      return false;
    }
  }

  // Update existing inventory item
  async updateReturn(item: {
    lendid: number;
    refnum: string;
    itemcode: string;
    qty: number;
  }): Promise<boolean> {
    const sql = `UPDATE salescart SET sclendqty = sclendqty - ?
                WHERE scitemcode = ? AND screfnum = ?`;

    const params = [item.qty, item.itemcode, item.refnum];

    try {
      await this.db.query(sql, params);

      await this.db.query(
        `UPDATE lendhistory SET lendqty = lendqty - ?, returnqty = returnqty + ?
        WHERE lenditemcode = ? AND lendid = ?`,
        [item.qty || 0, item.qty || 0, item.itemcode, item.lendid]
      );
      return true;
    } catch (error) {
      console.error('Error updating lend updateQty:', error);
      return false;
    }
  }

  async deleteitem(id: number, refnum: string): Promise<number> {
    const sql = `
    UPDATE lendhistory SET lendstatus = 'R-DELETED' WHERE lenditemcode = ? AND lendrefnum = ?
  `;
    return await this.db.insert(sql, [id, refnum]);
  }

  async addLendHistory(item: {
    refnum: string;
    itemcode: string;
    itemname: string;
    qty: number;
    custid: string;
    custname: string;
  }): Promise<boolean> {
    try {
      // 1. CHECK IF LEND HISTORY ALREADY EXISTS (not returned)
      const checkSql = `
      SELECT COUNT(*) as count
      FROM lendhistory
      WHERE lendstatus <> 'RETURNED'
        AND lendrefnum = ?
        AND lenditemcode = ?
    `;

      const checkRes: any[] = await this.db.query(checkSql, [
        item.refnum,
        item.itemcode,
      ]);

      const count = Number(checkRes[0]?.count || 0);

      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');

      // 2. UPDATE EXISTING LEND HISTORY
      if (count > 0) {
        const updateSql = `
        UPDATE lendhistory
        SET lendqty = lendqty + ?
        WHERE lenditemcode = ? AND lendrefnum = ?
      `;

        await this.db.query(updateSql, [item.qty, item.itemcode, item.refnum]);

        console.log('SUCCESSFUL: Updating lend history');
      }
      // 3. INSERT NEW LEND HISTORY
      else {
        const insertSql = `
        INSERT INTO lendhistory
          (lendrefnum, lenditemcode, lenditemname, lendqty, lendcustid, lenddate, lendcustname, lendstatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'LENDED')
      `;

        await this.db.query(insertSql, [
          item.refnum,
          item.itemcode,
          item.itemname,
          item.qty,
          item.custid,
          timestamp,
          item.custname,
        ]);

        console.log('SUCCESSFUL: Adding lend history');
      }

      // 4. UPDATE SALESCART LEND COLUMN
      const updateCartSql = `
      UPDATE salescart SET sclendqty = COALESCE(sclendqty, 0) + ?, 
      sclendstats = 'LENDED'
      WHERE scitemcode = ? AND screfnum = ?; 
      `;

      const lendresult = await this.db.query(updateCartSql, [
        item.qty,
        item.itemcode,
        item.refnum,
      ]);

      console.log('Lend Item Updated in Salescart:', lendresult);

      return true;
    } catch (error) {
      console.error('Error adding lend history:', error);
      return false;
    }
  }
}
