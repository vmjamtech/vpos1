import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class DisposeService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getCategories(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `${apiBaseUrl(connection.ip, connection.port)}/categories/all`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async getAllDisposeJunkdb(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
    SELECT *
    FROM disposehistory
    WHERE disremarks <> 'D-DELETED'
      AND disqty > 0
    ORDER BY disdate DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching ALL dispose/junk:', error);
      throw new Error('Failed to load ALL dispose/junk.');
    }
  }

  async getDisposedb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * FROM disposehistory WHERE disqty > 0 AND disremarks <> 'D-DELETED' ORDER BY disdate DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching Dispose:', error);
      throw new Error('Failed to load Dispose.');
    }
  }

  async getDisposeorJunkdb(
    limit: number = 20,
    offset: number = 0,
    isDispose: boolean = true
  ): Promise<any[]> {
    // Determine operator based on boolean flag
    const operator = isDispose ? '=' : '<>';

    const sql = `
    SELECT *
    FROM disposehistory
    WHERE disremarks ${operator} 'DISPOSED'
      AND disremarks <> 'D-DELETED'
      AND disqty > 0
    ORDER BY disdate DESC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
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

  async insertDispose(item: {
    disitemcode: string;
    disitemdesc: string;
    disqty: number;
    disremarks: string;
    disby?: string;
    DisposeNote?: string;
    disdate: string;
  }): Promise<number> {
    const sql = `
    INSERT INTO disposehistory (disitemcode, disitemdesc, disqty, disremarks, disby, DisposeNote, disdate) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
      item.disitemcode,
      item.disitemdesc,
      item.disqty || 0,
      item.disremarks,
      item.disby,
      item.DisposeNote || '',
      item.disdate,
    ];
    return await this.db.insert(sql, params);
  }

  async updateCategory(id: number, category: string, catmonitor: string) {
    const sql = `
    UPDATE categorytbl
    SET category = ?, catmonitor = ?
    WHERE catid = ?
  `;
    return await this.db.insert(sql, [category, catmonitor, id]);
  }

  async deleteCategory(id: number): Promise<number> {
    const sql = `
    DELETE FROM categorytbl
    WHERE catid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async deleteitem(id: number): Promise<number> {
    const sql = `
    UPDATE disposehistory SET disremarks = 'D-DELETED' WHERE disid = ?
  `;
    return await this.db.insert(sql, [id]);
  }
}
