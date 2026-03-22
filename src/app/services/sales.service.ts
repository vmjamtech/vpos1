import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import moment from 'moment';

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  // Get all sales
  async getAllSales(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/sales`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  // Get a sale by ID
  async getSaleById(salesid: number): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/sales/${salesid}`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  // Get a sale by reference number
  async getSaleByRefNum(salesrefnum: string): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/sales/ref/${salesrefnum}`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  // Create a new sale
  async createSale(sale: any): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/sales`;

    const response = await firstValueFrom(this.http.post<any>(url, sale));
    return response;
  }

  // Update a sale
  async updateSale(salesid: number, sale: any): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/sales/${salesid}`;

    const response = await firstValueFrom(this.http.patch<any>(url, sale));
    return response;
  }

  async getSalesdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT s.*, c.custadd FROM salestbl s left join custinfo c on s.salescustid = c.custid  ORDER BY s.salesdate DESC 
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw new Error('Failed to load sales.');
    }
  }

  async getSalesFilterdb(
    limit: number = 20,
    offset: number = 0,
    dateFrom?: string | null,
    dateTo?: string | null
  ): Promise<any[]> {
    let sql = `
    SELECT *
    FROM salestbl
    WHERE 1=1
  `;

    const params: any[] = [];

    // Optional date filters
    if (dateFrom) {
      sql += ` AND date(salesdate) >= date(?)`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND date(salesdate) <= date(?)`;
      params.push(dateTo);
    }

    // Pagination
    sql += ` ORDER BY salesdate DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw new Error('Failed to load sales.');
    }
  }

  async getTotalSales(datefrom?: string, dateto?: string): Promise<number> {
    let sql = `
    SELECT 
      IFNULL(SUM(salestotalamount), 0.00) 
      + IFNULL(SUM(salesdisc), 0.00) 
      + IFNULL(SUM(specialdisc), 0.00) 
      AS total 
    FROM salestbl 
    WHERE salestatus <> 'CANCELLED'
  `;

    const params: any[] = [];

    // Add optional filters
    if (datefrom && dateto) {
      sql += ` AND salesdate >= ? AND salesdate <= ?`;
      params.push(datefrom, dateto);
    } else if (datefrom) {
      sql += ` AND salesdate >= ?`;
      params.push(datefrom);
    } else if (dateto) {
      sql += ` AND salesdate <= ?`;
      params.push(dateto);
    }

    try {
      const result = await this.db.query(sql, params);
      return result[0]?.total ?? 0;
    } catch (error) {
      console.error('Error fetching total:', error);
      throw new Error('Failed to load total.');
    }
  }

  async searchOfflineSpecific(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM salestbl 
    WHERE 1=1
  `;

    const params: any[] = [];

    if (query) {
      const colonIndex = query.indexOf(':');

      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (field === 'salesrefnum' || field === 'salescust') {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          sql += ` AND (salesrefnum LIKE '%' || ? || '%' OR salescust LIKE '%' || ? || '%')`;
          params.push(query, query);
        }
      } else {
        sql += ` AND (salesrefnum LIKE '%' || ? || '%' OR salescust LIKE '%' || ? || '%')`;
        params.push(query, query);
      }
    }

    // Pagination
    sql += ` ORDER BY salesdate ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error searching salestbl:', error);
      throw new Error('Failed to search salestbl.');
    }
  }

  private async generateRefNum(salesdate: string): Promise<string> {
    const dateOnly = moment(salesdate).format('YYYY-MM-DD');

    const countQuery = `
      SELECT COUNT(*) as cnt
      FROM salestbl
      WHERE DATE(salesdate) = ? 
    `;
    const result = await this.db.query(countQuery, [dateOnly]);
    const count = result[0]?.cnt || 0;

    const autoid = count + 1;
    const datePart = moment(dateOnly).format('MMDDYY');
    const autoidStr = autoid.toString().padStart(6, '0');

    return `${autoidStr}-${datePart}`;
  }

  async createSaledb(data: any): Promise<any> {
    const salesdate = data.salesdate || moment().format('YYYY-MM-DD HH:mm:ss');
    const salesrefnum = await this.generateRefNum(salesdate);

    const insertQuery = `
    INSERT INTO salestbl (
      salesrefnum, salescust, salescustadd, salescustcont, salescustid,
      salespaym, salescashier, salesdelby, salesdelid,
      salesdelby2, salesdelid2, salestotalitem, salessub, salesvat,
      salestotalamount, saleschange, salesdate, salestender, salestatus,
      salescat, salespaytype, tenderbalance, tendertotal, salesremarks,
      salesdisc, bankrefnum, bankname, Custbankname, paydate
    ) VALUES (?,?,?,?,?,
     ?,?,?,?,
     ?,?,?,?,?,
     ?,?,?,?,?,
     ?,?,?,?,?,
     ?,?,?,?,?)
  `;

    const params = [
      salesrefnum,
      data.salescust,
      data.salescustadd,
      data.salescustcont,
      data.salescustid,
      data.salespaym,
      data.salescashier,
      data.salesdelby,
      data.salesdelid,
      data.salesdelby2,
      data.salesdelid2,
      data.salestotalitem,
      data.salessub,
      data.salesvat,
      data.salestotalamount,
      data.saleschange,
      salesdate,
      data.salestender,
      data.salestatus,
      data.salescat,
      data.salespaytype,
      data.tenderbalance,
      data.tendertotal,
      data.salesremarks,
      data.salesdisc,
      data.bankrefnum,
      data.bankname,
      data.Custbankname,
      data.paydate,
    ];

    // INSERT (no return expected)
    await this.db.query(insertQuery, params);

    // Get last inserted ID
    const rowIdQuery = `SELECT last_insert_rowid() AS id`;
    const row = await this.db.query(rowIdQuery);
    const salesid = row[0].id;

    return {
      salesid,
      salesrefnum,
      ...data,
      salesdate,
    };
  }

  async addnoteSaledb(salesrefnum: string, note: string): Promise<void> {
    const updateQuery = `
    UPDATE salestbl
    SET salesremarks = salesremarks || CHAR(13) || CHAR(10) || ?
    WHERE salesrefnum = ?
  `;
    const params = [note, salesrefnum];

    await this.db.query(updateQuery, params);
  }
}
