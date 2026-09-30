import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getInventoryByCategory(
    itemcategory: string,
    limit = 20,
    offset = 0
  ): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `${apiBaseUrl(connection.ip, connection.port)}/inventory/category/${encodeURIComponent(
      itemcategory
    )}?limit=${limit}&offset=${offset}`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async updateInventoryQty(
    cartItems: { itemid: number; qty: number; unit?: string }[]
  ): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `${apiBaseUrl(connection.ip, connection.port)}/inventory/update-qty`;

    return await firstValueFrom(this.http.post<any>(url, cartItems));
  }

  async findByCategory(
    itemcategory: string,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const sql = `
    SELECT itemid, itemcode, itemname, itemsize, fillqty, emptyqty, whqty, whfill, whempty, whdispose, icount, itemcategory FROM inventorytbl 
    WHERE itemcategory = ?
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [itemcategory, limit, offset]);
    } catch (error) {
      console.error('Error fetching warehouse inventory by category:', error);
      throw new Error('Failed to load warehouse inventory items.');
    }
  }

  async checkItemcodeExists(itemcode: string): Promise<boolean> {
    const sql = `SELECT 1 FROM inventorytbl WHERE itemcode = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [itemcode]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking item code:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async insertItem(item: {
    itemcode: string;
    itemname: string;
    itemsize?: string;
    itemcategory?: string;
    whfill?: number;
    whempty?: number;
    whqty?: number;
    Refill?: number;
    Non_Refill?: number;
    comdel?: number;
    compickup?: number;
    icount?: number;
  }): Promise<boolean> {
    // Current timestamp in "YYYY-MM-DD HH:mm:ss"
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    const sql = `
    INSERT INTO inventorytbl (
      itemcode, itemname, itemsize, itemcategory, whfill, whempty, whqty, icount, itemdate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
      item.itemcode,
      item.itemname,
      item.itemsize || '',
      item.itemcategory || '',
      item.whfill || 0,
      item.whempty || 0,
      item.whqty || 0,
      item.icount || 0,
      itemdate,
    ];

    try {
      // Insert main inventory
      await this.db.query(sql, params);
      // Get the inserted item's ID
      const result = await this.db.query(
        'SELECT itemid FROM inventorytbl WHERE itemcode = ? LIMIT 1',
        [item.itemcode]
      );
      const itemId = result[0].itemid;

      // Insert prices
      await this.db.query(
        `INSERT INTO pricelisttbl (Refill, Non_Refill, itemid) VALUES (?, ?, ?)`,
        [item.Refill || 0, item.Non_Refill || 0, itemId]
      );

      // Insert commissions
      await this.db.query(
        `INSERT INTO commtbl (comitemid, compickup, comdel) VALUES (?, ?, ?)`,
        [itemId, item.compickup || 0, item.comdel || 0]
      );
      // --- Insert into item history ---
      const historyRemarks = `ADDED WAREHOUSE ITEM WITH TOTAL QTY: ${
        item.whqty || 0
      }`;
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [itemdate, item.itemcode, 'ADDED ITEM', item.whqty || 0, historyRemarks]
      );

      return true;
    } catch (error) {
      console.error('Error inserting item:', error);
      return false;
    }
  }

  // Update existing inventory item
  async updateItem(item: {
    itemid: number;
    itemcode: string;
    itemname: string;
    itemsize?: string;
    itemcategory?: string;
    whfill?: number;
    whempty?: number;
    whqty?: number;
    icount?: number;
    origfillqty?: number;
    origemptyqty?: number;
    origtotalqty?: number;
  }): Promise<boolean> {
    const sql = `
    UPDATE inventorytbl
    SET itemcode = ?, itemname = ?, itemsize = ?, itemcategory = ?, 
        whfill = ?, whempty = ?, whqty = ?, icount = ?
    WHERE itemid = ?
  `;

    const params = [
      item.itemcode,
      item.itemname,
      item.itemsize || '',
      item.itemcategory || '',
      item.whfill || 0,
      item.whempty || 0,
      item.whqty || 0,
      item.icount || 0,
      item.itemid,
    ];

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
      const historyRemarks = `UPDATE FROM WAREHOUSE QTY: ${
        item.origtotalqty || 0
      } TO ${item.whqty || 0}`;
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.itemcode,
          'UPDATE ITEM',
          item.whqty || 0,
          historyRemarks,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      return false;
    }
  }

  // Update existing inventory item
  async updateQty(item: {
    itemcode: string;
    whempty: number;
  }): Promise<boolean> {
    const sql = `
    UPDATE inventorytbl
    SET whdispose = whdispose + ?, whempty = whempty - ? 
    WHERE itemcode = ?
  `;

    const params = [item.whempty, item.whempty, item.itemcode];

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
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.itemcode,
          'DISPOSED ITEM',
          item.whempty || 0,
          'INCREASE WAREHOUSE DISPOSED QTY FROM DISPOSED ITEM',
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      return false;
    }
  }

  // Update existing inventory item
  async updateDisposeQty(item: {
    disid: number;
    itemcode: string;
    whdispose: number;
    type: 'REPLACED' | 'JUNKED';
    isequal: boolean;
  }): Promise<boolean> {
    try {
      if (!['REPLACED', 'JUNKED'].includes(item.type)) {
        throw new Error('Invalid type. Must be REPLACED or JUNKED.');
      }

      // --- 1️⃣ Update inventory quantities based on type ---
      let sqlInventory = '';
      let paramsInventory: any[] = [];

      if (item.type === 'REPLACED') {
        sqlInventory = `
        UPDATE inventorytbl
        SET whdispose = whdispose - ?, whempty = whempty + ?
        WHERE itemcode = ?
      `;
        paramsInventory = [item.whdispose, item.whdispose, item.itemcode];
      } else {
        // JUNKED
        sqlInventory = `
        UPDATE inventorytbl
        SET whdispose = whdispose - ?
        WHERE itemcode = ?
      `;
        paramsInventory = [item.whdispose, item.itemcode];
      }

      await this.db.query(sqlInventory, paramsInventory);

      // --- 2️⃣ Update disposehistory ---
      let sqlDispose = '';
      let paramsDispose: any[] = [];

      if (item.isequal) {
        sqlDispose = `
        UPDATE disposehistory
        SET disqty = disqty - ?, disremarks = ?
        WHERE disid = ?
      `;
        paramsDispose = [item.whdispose, item.type, item.disid];
      } else {
        console.log('isequal from db', item.isequal);
        sqlDispose = `
        UPDATE disposehistory
        SET disqty = disqty - ?
        WHERE disid = ?
      `;
        paramsDispose = [item.whdispose, item.disid];
      }

      await this.db.query(sqlDispose, paramsDispose);

      // --- 3️⃣ Insert into item history ---
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
        now.getSeconds()
      )}`;

      const itemHistoryRemarks = `DECREASE WAREHOUSE DISPOSED QTY FROM ${item.type} ITEM`;

      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.itemcode,
          `${item.type} ITEM`,
          item.whdispose,
          itemHistoryRemarks,
        ]
      );

      console.log(
        `Disposed qty updated successfully for ${item.itemcode} (${item.type})`
      );

      return true;
    } catch (error) {
      console.error('Error updating disposed item:', error);
      return false;
    }
  }

  async deleteitem(id: number): Promise<number> {
    const sql = `
    DELETE FROM inventorytbl
    WHERE itemid = ?
  `;
    return await this.db.insert(sql, [id]);
  }
}
