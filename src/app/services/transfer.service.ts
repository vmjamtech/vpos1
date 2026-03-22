import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import moment from 'moment-timezone';

@Injectable({
  providedIn: 'root',
})
export class TransferService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getTransfers(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * FROM pouttbl
    ORDER BY poutid DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching category:', error);
      throw new Error('Failed to load category.');
    }
  }

  async searchOfflineSpecific(query: string): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM pouttbl
    WHERE 1=1
  `;

    const params: any[] = [];
    if (query) {
      // check for field prefix
      const colonIndex = query.indexOf(':');
      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (
          field === 'poutrefnum' ||
          field === 'poutencoder' ||
          field === 'pouttype' ||
          field === 'pullsupplier'
        ) {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          // fallback: search both
          sql += ` AND (poutrefnum LIKE '%' || ? || '%' OR poutencoder LIKE '%' || ? || '%')`;
          params.push(query, query);
        }
      } else {
        // no prefix → search both
        sql += ` AND (poutrefnum LIKE '%' || ? || '%' OR poutrefnum LIKE '%' || ? || '%')`;
        params.push(query, query);
      }
    }

    sql += ` ORDER BY poutid DESC`;

    try {
      const rows = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error searching transfer:', error);
      throw new Error('Failed to search transfer.');
    }
  }

  async delete(id: number): Promise<number> {
    const sql = `
    DELETE FROM pouttbl
    WHERE poutid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async cancel(id: number): Promise<number> {
    const sql = `
    update pouttbl set pulloutremarks='CANCELLED'  
    WHERE poutid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async getSalesFilterdb(
    limit: number = 20,
    offset: number = 0,
    dateFrom?: string | null,
    dateTo?: string | null
  ): Promise<any[]> {
    let sql = `
    SELECT *
    FROM pouttbl
    WHERE 1=1
  `;

    const params: any[] = [];

    // Optional date filters
    if (dateFrom) {
      sql += ` AND date(pulldate) >= date(?)`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND date(pulldate) <= date(?)`;
      params.push(dateTo);
    }

    // Pagination
    sql += ` ORDER BY poutid DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching transfer:', error);
      throw new Error('Failed to load transfer.');
    }
  }

  async generateRefNum(): Promise<string> {
    const dateOnly = moment().tz('Asia/Manila').format('YYYY-MM-DD');

    const countQuery = `
        SELECT COUNT(*) as cnt
        FROM pouttbl
        WHERE DATE(pulldate) = ? 
      `;
    const result = await this.db.query(countQuery, [dateOnly]);
    const count = result[0]?.cnt || 0;

    const autoid = count + 1;
    const datePart = moment(dateOnly).format('MMDDYY');
    const autoidStr = autoid.toString().padStart(6, '0');

    return `TI${autoidStr}-${datePart}`;
  }

  async save(
    poutrefnum: string,
    poutencoder: string,
    pullsupplier: string,
    pulldate: string,
    pouttype: string,
    fillitems: any[],
    emptyitems: any[]
  ): Promise<void> {
    // Insert pullout header
    const totalQty =
      fillitems.reduce((sum, item) => sum + item.qty, 0) +
      emptyitems.reduce((sum, item) => sum + item.qty, 0);

    const headerSql = `
      INSERT INTO pouttbl
      (poutrefnum, pullsupplier, pulldate, pouttotalqty, poutencoder, pulloutremarks, pouttype)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.query(headerSql, [
      poutrefnum,
      pullsupplier,
      pulldate,
      totalQty,
      poutencoder,
      'Waiting',
      pouttype,
    ]);

    // Insert fill items
    const fillSql = `
      INSERT INTO pulloutcart
      (poutref, poutdate, poutitemcode, poutitemname, poutqty, pouttype)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    for (const item of fillitems) {
      await this.db.query(fillSql, [
        poutrefnum,
        pulldate,
        item.itemcode,
        item.itemname,
        item.qty,
        pouttype + 'FILL',
      ]);
    }

    // Insert empty items
    const emptySql = fillSql; // same structure
    for (const item of emptyitems) {
      await this.db.query(emptySql, [
        poutrefnum,
        pulldate,
        item.itemcode,
        item.itemname,
        item.qty,
        pouttype + 'EMPTY',
      ]);
    }
  }

  async saveRestock(
    poutrefnum: string,
    poutencoder: string,
    pullsupplier: string,
    pulldate: string,
    pouttype: string,
    restockprice: number,
    poutpid: number,
    fillitems: any[],
    emptyitems: any[]
  ): Promise<void> {
    // Insert pullout header
    const totalQty =
      fillitems.reduce((sum, item) => sum + item.qty, 0) +
      emptyitems.reduce((sum, item) => sum + item.qty, 0);

    const headerSql = `
      INSERT INTO pouttbl
      (poutrefnum, pullsupplier, pulldate, pouttotalqty, poutencoder, pulloutremarks, pouttype, restockprice, poutpid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.query(headerSql, [
      poutrefnum,
      pullsupplier,
      pulldate,
      totalQty,
      poutencoder,
      'Waiting',
      pouttype,
      restockprice,
      poutpid,
    ]);

    // Insert fill items
    const fillSql = `
      INSERT INTO pulloutcart
      (poutref, poutdate, poutitemcode, poutitemname, poutqty, pouttype)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    for (const item of fillitems) {
      await this.db.query(fillSql, [
        poutrefnum,
        pulldate,
        item.itemcode,
        item.itemname,
        item.qty,
        pouttype + 'FILL',
      ]);
    }

    // Insert empty items
    const emptySql = fillSql; // same structure
    for (const item of emptyitems) {
      await this.db.query(emptySql, [
        poutrefnum,
        pulldate,
        item.itemcode,
        item.itemname,
        item.qty,
        pouttype + 'EMPTY',
      ]);
    }
  }

  async updateStoreQuantity(
    isIncrease: boolean,
    items: any[],
    columnName: string,
    origin: string,
    poRef: string
  ): Promise<void> {
    try {
      const operation = isIncrease ? '+' : '-';

      for (const row of items) {
        const qty = row.qty;
        const itemCode = row.itemcode;

        // Update inventory
        const updateSql = `
        UPDATE inventorytbl
        SET ${columnName} = ${columnName} ${operation} ?
        WHERE itemcode = ?
      `;
        await this.db.query(updateSql, [qty, itemCode]);

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
          now.getDate()
        )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
          now.getSeconds()
        )}`;
        // Insert history
        const historySql = `
        INSERT INTO itemhistorytbl
        (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
        const remarks = `${
          isIncrease ? 'INCREASE' : 'DECREASE'
        }  ${columnName.toUpperCase()} QTY FROM ${origin}: ${poRef}`;
        await this.db.query(historySql, [
          itemdate,
          poRef,
          itemCode,
          origin,
          qty,
          remarks,
        ]);
      }

      const updateSql = `
        UPDATE pouttbl SET pulloutremarks = 'CONFIRMED' WHERE poutrefnum = ?
      `;
      await this.db.query(updateSql, [poRef]);
    } catch (error) {
      console.error('Error updateStoreQuantity:', error);
      throw new Error('Failed to Update.');
    }
  }

  async updateCancelStoreQuantity(
    isIncrease: boolean,
    items: any[],
    columnName: string,
    origin: string,
    poRef: string
  ): Promise<void> {
    try {
      const operation = isIncrease ? '+' : '-';

      for (const row of items) {
        const qty = row.qty;
        const itemCode = row.itemcode;

        // Update inventory
        const updateSql = `
        UPDATE inventorytbl
        SET ${columnName} = ${columnName} ${operation} ?
        WHERE itemcode = ?
      `;
        await this.db.query(updateSql, [qty, itemCode]);

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
          now.getDate()
        )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
          now.getSeconds()
        )}`;
        // Insert history
        const historySql = `
        INSERT INTO itemhistorytbl
        (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
        const remarks = `${
          isIncrease ? 'INCREASE' : 'DECREASE'
        }  ${columnName.toUpperCase()} QTY FROM ${origin}: ${poRef}`;
        await this.db.query(historySql, [
          itemdate,
          poRef,
          itemCode,
          origin,
          qty,
          remarks,
        ]);
      }

      const updateSql = `
        UPDATE pouttbl SET pulloutremarks = 'CANCELLED' WHERE poutrefnum = ?
      `;
      await this.db.query(updateSql, [poRef]);
    } catch (error) {
      console.error('Error updateStoreQuantity:', error);
      throw new Error('Failed to Update.');
    }
  }

  async getTransferCart(
    poutref: string,
    transtype: string
  ): Promise<{ fill: any[]; empty: any[] }> {
    try {
      // Fetch fill items
      const fillSql = `SELECT * FROM pulloutcart WHERE poutref = ? AND pouttype = ?`;
      const fill = await this.db.query(fillSql, [poutref, transtype + 'FILL']);

      // Fetch empty items
      const emptySql = `SELECT * FROM pulloutcart WHERE poutref = ? AND pouttype = ?`;
      const empty = await this.db.query(emptySql, [
        poutref,
        transtype + 'EMPTY',
      ]);

      return { fill, empty };
    } catch (error) {
      console.error('Error fetching transfer cart:', error);
      throw new Error('Failed to load transfer cart.');
    }
  }

  async addnoteTransferdb(poutrefnum: string, note: string): Promise<void> {
    const updateQuery = `
    UPDATE pouttbl SET notes = IFNULL(notes, '') || CHAR(13) || CHAR(10) || ? WHERE poutrefnum = ?
  `;
    const params = [`Additional Notes: ${note}`, poutrefnum];

    await this.db.query(updateQuery, params);
  }
}
