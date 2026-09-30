import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
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

  async getAllCategories(): Promise<any[]> {
    const sql = `SELECT * FROM categorytbl`;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching category:', error);
      throw new Error('Failed to load category.');
    }
  }

  async getCategoriesdb(
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
    SELECT * from categorytbl 
   
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

  async insertCategory(category: string, catmonitor: string): Promise<number> {
    const sql = `
    INSERT INTO categorytbl (category, catmonitor, cattype)
    VALUES (?, ?, 1)
  `;
    return await this.db.insert(sql, [category, catmonitor]);
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
}
