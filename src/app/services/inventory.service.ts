import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
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

  async findbyItemCode(itemcode: string): Promise<any[]> {
    const sql = `SELECT * FROM inventorytbl WHERE itemcode = ?`;

    try {
      return await this.db.query(sql, [itemcode]);
    } catch (error) {
      console.error('Error fetching inventory by item code:', error);
      throw new Error('Failed to load inventory items.');
    }
  }

  async findByCategory(
    itemcategory: string,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const sql = `
    SELECT 
      t0.itemid,
      t0.itemcode,
      t0.itemname,
      t0.itemsize,
      t0.itemqty,
      t0.fillqty,
      t0.emptyqty,
      t1.Refill,
      t1.Non_Refill,
      t0.lendqty,
      t0.alertnum,
      t0.itemcost,
      t0.itemcategory,
      t2.compickup,
      t2.comdel
    FROM inventorytbl t0
    INNER JOIN pricelisttbl t1 
      ON t1.itemid = t0.itemid
       INNER JOIN commtbl t2 
      ON t2.comitemid = t0.itemid
    WHERE t0.itemcategory = ?
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [itemcategory, limit, offset]);
    } catch (error) {
      console.error('Error fetching inventory by category:', error);
      throw new Error('Failed to load inventory items.');
    }
  }

  async findWhByCategory(
    itemcategory: string,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const sql = `
    SELECT t0.itemid, t0.itemcategory, t0.itemcode, t0.itemname, t0.itemsize, t0.whfill as fillqty, t0.whempty as emptyqty, t0.whqty, t1.Refill, t1.Non_Refill, t0.lendqty, t0.itemcost, t0.icount as alertnum FROM inventorytbl t0 INNER JOIN pricelisttbl t1 ON t1.itemid = t0.itemid WHERE t0.itemcategory = ?
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [itemcategory, limit, offset]);
    } catch (error) {
      console.error('Error fetching inventory by category:', error);
      throw new Error('Failed to load inventory items.');
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
    fillqty?: number;
    emptyqty?: number;
    itemqty?: number;
    Refill?: number;
    Non_Refill?: number;
    comdel?: number;
    compickup?: number;
    itemcost?: number;
    alertnum?: number;
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
      itemcode, itemname, itemsize, itemcategory, fillqty, emptyqty, itemqty, 
      itemcost, alertnum, itemdate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
      item.itemcode,
      item.itemname,
      item.itemsize || '',
      item.itemcategory || '',
      item.fillqty || 0,
      item.emptyqty || 0,
      item.itemqty || 0,
      item.itemcost || 0,
      item.alertnum || 0,
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
      const historyRemarks = `ADDED ITEM WITH TOTAL QTY: ${item.itemqty || 0}`;
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.itemcode,
          'ADDED ITEM',
          item.itemqty || 0,
          historyRemarks,
        ]
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
    fillqty?: number;
    emptyqty?: number;
    itemqty?: number;
    Refill?: number;
    Non_Refill?: number;
    comdel?: number;
    compickup?: number;
    itemcost?: number;
    alertnum?: number;
    origfillqty?: number;
    origemptyqty?: number;
    origtotalqty?: number;
  }): Promise<boolean> {
    const sql = `
    UPDATE inventorytbl
    SET itemcode = ?, itemname = ?, itemsize = ?, itemcategory = ?, 
        fillqty = ?, emptyqty = ?, itemqty = ?, itemcost = ?, alertnum = ?
    WHERE itemid = ?
  `;

    const params = [
      item.itemcode,
      item.itemname,
      item.itemsize || '',
      item.itemcategory || '',
      item.fillqty || 0,
      item.emptyqty || 0,
      item.itemqty || 0,
      item.itemcost || 0,
      item.alertnum || 0,
      item.itemid,
    ];

    try {
      // Update main inventory
      await this.db.query(sql, params);

      // Update prices
      await this.db.query(
        `UPDATE pricelisttbl
       SET Refill = ?, Non_Refill = ?
       WHERE itemid = ?`,
        [item.Refill || 0, item.Non_Refill || 0, item.itemid]
      );

      // Update commissions
      await this.db.query(
        `UPDATE commtbl
       SET compickup = ?, comdel = ?
       WHERE comitemid = ?`,
        [item.compickup || 0, item.comdel || 0, item.itemid]
      );

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
        now.getSeconds()
      )}`;
      // --- Insert into item history ---
      const historyRemarks = `UPDATE FROM QTY: ${item.origtotalqty || 0} TO ${
        item.itemqty || 0
      }`;
      await this.db.query(
        `INSERT INTO itemhistorytbl (itemhdate, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?)`,
        [
          itemdate,
          item.itemcode,
          'UPDATE ITEM',
          item.itemqty || 0,
          historyRemarks,
        ]
      );

      return true;
    } catch (error) {
      console.error('Error updating item:', error);
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

  async updateInventoryQtydb(cartItems: any[]): Promise<void> {
    for (const item of cartItems) {
      const unit = item.unit || 'REFILL';

      if (unit === 'REFILL') {
        // Increase emptyqty, decrease fillqty
        const query = `
          UPDATE inventorytbl
          SET 
            emptyqty = emptyqty + ?,
            fillqty = fillqty - ?
          WHERE itemid = ?
        `;

        await this.db.execute(query, [item.qty, item.qty, item.itemid]);
      } else {
        // Decrease fillqty and itemqty
        const query = `
          UPDATE inventorytbl
          SET 
            fillqty = fillqty - ?,
            itemqty = itemqty - ?
          WHERE itemid = ?
        `;

        await this.db.execute(query, [item.qty, item.qty, item.itemid]);
      }
    }
  }

  async updateCancelInventoryQtyDb(
    cartItems: any[],
    refnum: string
  ): Promise<void> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
    for (const item of cartItems) {
      const unit = item.scunit ?? 'REFILL';
      const qty = item.scqty;
      const itemid = item.scitemcode;
      let remarks = '';

      if (unit === 'NON-REFILL') {
        // Increase fillqty
        await this.db.execute(
          `UPDATE inventorytbl SET fillqty = fillqty + ? WHERE itemcode = ?`,
          [qty, itemid]
        );

        remarks = `INCREASE FILL QTY FROM CANCEL PURCHASE REFNUM: ${refnum}`;
      } else if (unit === 'REFILL') {
        // Decrease emptyqty, increase fillqty
        await this.db.execute(
          `UPDATE inventorytbl 
         SET emptyqty = emptyqty - ?, fillqty = fillqty + ?
         WHERE itemcode = ?`,
          [qty, qty, itemid]
        );

        // Log both operations separately
        await this.db.execute(
          `INSERT INTO itemhistorytbl (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
          [
            itemdate,
            refnum,
            itemid,
            'CANCEL PURCHASE',
            qty,
            `DECREASE EMPTY QTY FROM CANCEL PURCHASE REFNUM: ${refnum}`,
          ]
        );

        remarks = `INCREASE FILL QTY FROM CANCEL PURCHASE REFNUM: ${refnum}`;
      }

      // Log the main operation
      await this.db.execute(
        `INSERT INTO itemhistorytbl (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [itemdate, refnum, itemid, 'CANCEL PURCHASE', qty, remarks]
      );
    }
  }

  async loadEmptyQty(itemcode: string): Promise<number> {
    const sql = `SELECT emptyqty FROM inventorytbl WHERE itemcode = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [itemcode]);
      if (result.length > 0) {
        return Number(result[0].emptyqty) || 0;
      }

      return 0;
    } catch (error) {
      console.error('Error loading empty qty:', error);
      return 0;
    }
  }

  async updateLendInventoryQtyDb(
    qty: number,
    itemcode: string,
    refnum: string
  ): Promise<void> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
    // Increase fillqty
    await this.db.execute(
      `UPDATE inventorytbl SET lendqty = lendqty + ?, emptyqty = emptyqty - ?  WHERE itemcode = ?`,
      [qty, qty, itemcode]
    );

    // Log both operations separately
    await this.db.execute(
      `INSERT INTO itemhistorytbl (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
      [
        itemdate,
        refnum,
        itemcode,
        'LEND ITEM',
        qty,
        `INCREASE LEND QTY FROM LEND ITEM REFNUM: ${refnum}`,
      ]
    );
  }

  async cancelItemUpdateDb(
    qty: number,
    itemcode: string,
    refnum: string,
    itemType: string,
    note?: string
  ): Promise<void> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    if (itemType === 'NON-REFILL') {
      // ---------------------------------
      // NON REFILL LOGIC
      // ---------------------------------
      await this.db.execute(
        `UPDATE inventorytbl 
         SET fillqty = fillqty + ? 
       WHERE itemcode = ?`,
        [qty, itemcode]
      );

      // Insert history
      await this.db.execute(
        `INSERT INTO itemhistorytbl 
        (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemdate,
          refnum,
          itemcode,
          'CANCEL ITEM',
          qty,
          `INCREASE FILL QTY FROM CANCEL ITEM REFNUM: ${refnum}`,
        ]
      );
    }

    // ------------------------------------------------------
    // REFILL LOGIC (EMPTY–>FILL Adjustment)
    // ------------------------------------------------------
    else if (itemType === 'REFILL') {
      // Update inventory
      await this.db.execute(
        `UPDATE inventorytbl 
         SET emptyqty = emptyqty - ?, 
             fillqty = fillqty + ? 
       WHERE itemcode = ?`,
        [qty, qty, itemcode]
      );

      // 1. DECREASE EMPTY LOG
      await this.db.execute(
        `INSERT INTO itemhistorytbl
        (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemdate,
          refnum,
          itemcode,
          'CANCEL ITEM',
          qty,
          `DECREASE EMPTY QTY FROM CANCEL ITEM REFNUM: ${refnum}`,
        ]
      );

      // 2. INCREASE FILL LOG
      await this.db.execute(
        `INSERT INTO itemhistorytbl
        (itemhdate, itemhrefnum, itemhitemc, itemhorigin, itemhqty, itemhremarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemdate,
          refnum,
          itemcode,
          'CANCEL ITEM',
          qty,
          `INCREASE FILL QTY FROM CANCEL ITEM REFNUM: ${refnum}`,
        ]
      );
    }
  }
}
