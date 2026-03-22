import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import moment from 'moment';

@Injectable({
  providedIn: 'root',
})
export class PettyCashService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getPettyCash(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * FROM pettylogstbl 
    ORDER BY pettylogdate DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching pettycash:', error);
      throw new Error('Failed to load pettycash.');
    }
  }

  async searchOfflineSpecific(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM pettylogstbl 
    WHERE 1=1
  `;

    const params: any[] = [];

    if (query) {
      const colonIndex = query.indexOf(':');

      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (field === 'pettylogremarks') {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          // Fallback: search only pettylogremarks
          sql += ` AND pettylogremarks LIKE '%' || ? || '%'`;
          params.push(query);
        }
      } else {
        // Search only pettylogremarks
        sql += ` AND pettylogremarks LIKE '%' || ? || '%'`;
        params.push(query);
      }
    }

    // Pagination
    sql += ` ORDER BY pettylogdate DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error searching pettycash:', error);
      throw new Error('Failed to search pettycash.');
    }
  }

  async getFilterdb(
    limit: number = 20,
    offset: number = 0,
    dateFrom?: string | null,
    dateTo?: string | null
  ): Promise<any[]> {
    let sql = `
    SELECT *
    FROM pettylogstbl
    WHERE 1=1
  `;

    const params: any[] = [];

    // Optional date filters
    if (dateFrom) {
      sql += ` AND date(pettylogdate) >= date(?)`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND date(pettylogdate) <= date(?)`;
      params.push(dateTo);
    }

    // Pagination
    sql += ` ORDER BY pettylogdate DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching pettycash:', error);
      throw new Error('Failed to load pettycash.');
    }
  }

  async getTotal(datefrom?: string, dateto?: string): Promise<number> {
    let sql = `
    SELECT 
      IFNULL(SUM(pettylogamount), 0.00)  
      AS total 
    FROM pettylogstbl WHERE 1=1
  `;

    const params: any[] = [];

    // Add optional filters
    if (datefrom && dateto) {
      sql += ` AND pettylogdate >= ? AND pettylogdate <= ?`;
      params.push(datefrom, dateto);
    } else if (datefrom) {
      sql += ` AND pettylogdate >= ?`;
      params.push(datefrom);
    } else if (dateto) {
      sql += ` AND pettylogdate <= ?`;
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

  async getCurrent(): Promise<number> {
    const sql = `
    SELECT IFNULL(SUM(pettyamount), 0.00) AS amount 
    FROM pettycashtbl
  `;

    try {
      const result = await this.db.query(sql);
      return result[0]?.amount ?? 0;
    } catch (error) {
      console.error('Error fetching getCurrent:', error);
      throw new Error('Failed to load getCurrent.');
    }
  }

  async insertPettyCashLog(data: any): Promise<number> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const itemdate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    const sql = `
    INSERT INTO pettylogstbl 
      (pettylogdate, pettylogamount, pettyorigamount, pettylogby, pettylogtype, pettylogremarks, pettypaymenthod)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
      itemdate,
      data.pettylogamount,
      data.pettyorigamount,
      data.pettylogby,
      data.pettylogtype,
      data.pettylogremarks,
      data.pettypaymenthod,
    ];

    try {
      return await this.db.insert(sql, params);
    } catch (error) {
      console.error('Error inserting pettycash log:', error);
      throw new Error('Failed to insert pettycash log.');
    }
  }
}
