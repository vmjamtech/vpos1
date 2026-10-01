import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class ItemhistoryService {
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
    return `${apiBaseUrl(connection.ip, connection.port)}/itemhistory`;
  }

  async getAll(): Promise<any> {
    const url = (await this.getBaseUrl()) + '/all';
    return await firstValueFrom(this.http.get<any>(url));
  }

  async getById(itemhid: number): Promise<any> {
    const url = (await this.getBaseUrl()) + `/${itemhid}`;
    return await firstValueFrom(this.http.get<any>(url));
  }

  async getByItemCode(itemhitemc: string): Promise<any> {
    const url =
      (await this.getBaseUrl()) + `/item/${encodeURIComponent(itemhitemc)}`;
    return await firstValueFrom(this.http.get<any>(url));
  }

  async getByRefNum(itemhrefnum: string): Promise<any> {
    const url =
      (await this.getBaseUrl()) + `/ref/${encodeURIComponent(itemhrefnum)}`;
    return await firstValueFrom(this.http.get<any>(url));
  }

  async create(history: any): Promise<any> {
    const url = await this.getBaseUrl();
    return await firstValueFrom(this.http.post<any>(url, history));
  }

  async getItemHistory(
    itemcode: string,
    limit: number = 30,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `SELECT itemhdate, itemhrefnum, itemhqty, itemhorigin, itemhremarks FROM itemhistorytbl 
    WHERE itemhitemc = ? ORDER BY itemhid DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [itemcode, limit, offset]);
    } catch (error) {
      console.error('Error fetching ItemHistory:', error);
      throw new Error('Failed to load ItemHistory.');
    }
  }

  async getItemHistoryByfilter(
    itemcode: string,
    datefrom: string,
    dateto: string,
    type: string,
    limit: number = 30,
    offset: number = 0
  ): Promise<any[]> {
    let sql = `
    SELECT itemhdate, itemhrefnum, itemhqty, itemhorigin, itemhremarks
    FROM itemhistorytbl 
    WHERE itemhitemc = ?
      AND date(itemhdate) >= date(?)
      AND date(itemhdate) <= date(?)
  `;

    const params: any[] = [itemcode, datefrom, dateto];
    if (type && type !== 'ALL') {
      sql += ` AND (itemhremarks LIKE ? OR itemhorigin LIKE ?)`;
      const likeType = `%${type}%`;
      params.push(likeType, likeType);
    }

    sql += `
    ORDER BY itemhid DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      params.push(limit, offset);
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching ItemHistory filter:', error);
      throw new Error('Failed to load ItemHistory filter.');
    }
  }

  async createItemHistorydb(data: any): Promise<any> {
    const query = `
      INSERT INTO itemhistorytbl (
        itemhdate, itemhitemc, itemhrefnum, itemhorigin,
        itemhqty, itemhremarks, itemhfromqty, itemhtoqty
      ) VALUES (?,?,?,?,?,?,?,?)
    `;

    const params = [
      data.itemhdate,
      data.itemhitemc,
      data.itemhrefnum,
      data.itemhorigin,
      data.itemhqty,
      data.itemhremarks,
      data.itemhfromqty,
      data.itemhtoqty,
    ];

    // Insert row
    await this.db.execute(query, params);

    // Read last inserted ID
    const row = await this.db.query(`SELECT last_insert_rowid() AS id`);
    const id = row[0].id;

    return {
      id,
      ...data,
    };
  }
}
