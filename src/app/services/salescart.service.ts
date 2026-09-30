import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import moment from 'moment';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class SalescartService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  private async getBaseUrl(): Promise<string> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    return `${apiBaseUrl(connection.ip, connection.port)}/salescart`;
  }

  async getAllCartItems(): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async getCartItems(limit: number, offset: number): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(
      this.http.get<any>(`${url}/paginated?limit=${limit}&offset=${offset}`)
    );
    return response;
  }

  async getCartItemById(scid: number): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(this.http.get<any>(`${url}/${scid}`));
    return response;
  }

  async getCartItemsByRef(screfnum: string): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(
      this.http.get<any>(`${url}/ref/${screfnum}`)
    );
    return response;
  }

  async addCartItem(cartItem: any): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(this.http.post<any>(url, cartItem));
    return response;
  }

  async updateCartItem(scid: number, cartItem: any): Promise<any> {
    const url = await this.getBaseUrl();
    const response = await firstValueFrom(
      this.http.patch<any>(`${url}/${scid}`, cartItem)
    );
    return response;
  }

  async addCartItemDb(data: any): Promise<any> {
    const insertQuery = `
      INSERT INTO salescart (
        screfnum, scdate, scitemcode, scitemdesc, scunit, scprice,
        sctotal, scqty, sccashier, scdiscount, scstats, scbrand,
        scpackage, sccost, totalcost, sclendqty, sclendstats
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const params = [
      data.screfnum,
      data.scdate || moment().format('YYYY-MM-DD HH:mm:ss'),
      data.scitemcode,
      data.scitemdesc,
      data.scunit,
      data.scprice,
      data.sctotal,
      data.scqty,
      data.sccashier,
      data.scdiscount,
      data.scstats,
      data.scbrand,
      data.scpackage,
      data.sccost,
      data.totalcost,
      data.sclendqty,
      data.sclendstats,
    ];

    // Insert row (void return)
    await this.db.execute(insertQuery, params);

    // Get inserted ID
    const row = await this.db.query(`SELECT last_insert_rowid() AS id`);
    const scid = row[0].id;

    return {
      scid,
      ...data,
      scdate: params[1],
    };
  }

  async getSalesDetailsByRefnum(screfnum: string): Promise<any> {
    const sql = `
    SELECT s.*, i.itemid FROM salescart s left join inventorytbl i on s.scitemcode=i.itemcode WHERE screfnum = ?
  `;

    try {
      return await this.db.query(sql, [screfnum]);
    } catch (error) {
      console.error('Error fetching sales details:', error);
      throw new Error('Failed to load sales details.');
    }
  }

  async cancelSalesItem(
    item: any, // current cart item
    cancelQty: number, // quantity to cancel
    custId: string,
    refnum: string,
    tendered: number,
    gtotal: number,
    salesStatus: string,
    note?: string
  ): Promise<{
    newTotal: number;
    newQty: number;
    newItemTotal: number;
    newTotalAmount: number;
    newSub: number;
    newVat: number;
    newTendered: number;
    newSalestatus: string;
    newSalesremarks: string;
  }> {
    const itemPrice = item.scprice;
    const newQty = Number(item.scqty) - cancelQty;
    const newTotal = itemPrice * cancelQty;
    const newItemTotal = newQty * itemPrice;

    // 1. Update customer balance if UNPAID
    if (salesStatus === 'UNPAID') {
      await this.db.execute(
        `UPDATE custinfo SET custbalance = custbalance - ? WHERE custid = ?`,
        [newTotal, custId]
      );

      console.log(`Customer balance updated for ID: ${custId}`);

      await this.db.execute(
        `UPDATE salestbl SET tenderbalance = tenderbalance - ? WHERE salesrefnum = ?`,
        [newTotal, refnum]
      );

      console.log(
        `Tender balance updated in sales table for REFNUM: ${refnum}`
      );
    }

    // 2. Update sales cart quantity and total
    await this.db.execute(
      `UPDATE salescart 
       SET scqty = scqty - ?, 
           sctotal = ? 
     WHERE screfnum = ? AND scitemcode = ?`,
      [cancelQty, newItemTotal, refnum, item.scitemcode]
    );

    console.log(
      `Sales cart updated: REFNUM: ${refnum}, ITEM CODE: ${item.scitemcode}`
    );

    // 3. Mark item as CANCELLED if quantity < 1
    await this.db.execute(
      `UPDATE salescart 
       SET scstats = 'CANCELLED' 
     WHERE screfnum = ? AND scitemcode = ? AND scqty < 1`,
      [refnum, item.scitemcode]
    );

    console.log(
      `Sales cart item cancelled if quantity < 1: ${item.scitemcode}`
    );

    // 4. Update sales totals
    let newTendered = tendered - newTotal;
    if (tendered < newTotal) newTendered = 0;

    const newTotalAmount = gtotal - newTotal;
    const newSub = newTotalAmount / 1.2;
    const newVat = newSub * 0.12;

    await this.db.execute(
      `UPDATE salestbl 
       SET salestotalamount = ?, 
           salessub = ?, 
           salesvat = ?, 
           salestotalitem = salestotalitem - ?, 
           salestender = ? 
     WHERE salesrefnum = ?`,
      [newTotalAmount, newSub, newVat, cancelQty, newTendered, refnum]
    );

    console.log(`Sales totals updated for REFNUM: ${refnum}`);

    await this.db.execute(
      `UPDATE salestbl 
       SET salestatus = 'CANCELLED', tenderbalance = 0 
     WHERE salesrefnum = ? AND salestotalitem < 1`,
      [refnum]
    );

    if (note) {
      await this.db.execute(
        `UPDATE salestbl SET salesremarks = salesremarks || CHAR(13) || CHAR(10) || ? WHERE salesrefnum = ?`,
        [`CANCEL ITEM: (${item.scitemcode}) NOTE: ${note}`, refnum]
      );
    }

    console.log(
      `Sale status updated to CANCELLED for REFNUM: ${refnum} if total items < 1`
    );

    // 3. Retrieve the updated status and remarks
    const [updatedSale] = await this.db.query(
      `SELECT salestatus, salesremarks FROM salestbl WHERE salesrefnum = ?`,
      [refnum]
    );

    const newSalestatus = updatedSale?.salestatus ?? null;
    const newSalesremarks = updatedSale?.salesremarks ?? null;

    console.log('Updated Sale Status:', newSalestatus);
    console.log('Updated Sales Remarks:', newSalesremarks);

    // Return all calculated values
    return {
      newTotal,
      newQty,
      newItemTotal,
      newTotalAmount,
      newSub,
      newVat,
      newTendered,
      newSalestatus,
      newSalesremarks,
    };
  }
}
