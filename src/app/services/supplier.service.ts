import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getSuppliers(): Promise<any> {
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

  async getAllSuppliers(): Promise<any[]> {
    const sql = `SELECT * FROM suppliers ORDER BY suppname DESC`;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw new Error('Failed to load suppliers.');
    }
  }

  async getAllDriver(): Promise<any[]> {
    const sql = `SELECT * FROM personeltbl where prole='Driver' ORDER BY pname DESC`;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching Driver:', error);
      throw new Error('Failed to load Driver.');
    }
  }

  async getSuppliersdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * from suppliers 
    ORDER BY suppname ASC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw new Error('Failed to load suppliers.');
    }
  }

  async checknameExists(pname: string): Promise<boolean> {
    const sql = `SELECT 1 FROM suppliers WHERE suppname = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [pname]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking suppname:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async insertSupplier(data: {
    suppname: string;
    supptitle: string;
    suppaddress: string;
    suppcont: string;
    suppemail: string;
  }): Promise<boolean> {
    const sql = `
    INSERT INTO suppliers (suppname, supptitle, suppaddress, suppcont, suppemail)
    VALUES (?, ?, ?, ?, ?)
  `;
    try {
      await this.db.query(sql, [
        data.suppname,
        data.supptitle,
        data.suppaddress,
        data.suppcont,
        data.suppemail,
      ]);

      return true;
    } catch (error) {
      console.error('Error inserting suppliers:', error);
      return false;
    }
  }

  async updateSupplier(data: {
    id: number;
    suppname: string;
    supptitle: string;
    suppaddress: string;
    suppcont: string;
    suppemail: string;
  }): Promise<boolean> {
    const sql = `
    UPDATE suppliers
    SET suppname= ?, supptitle= ?, suppaddress= ?, 
    suppcont= ?, suppemail= ? WHERE suppid = ?
  `;
    try {
      await this.db.query(sql, [
        data.suppname,
        data.supptitle,
        data.suppaddress,
        data.suppcont,
        data.suppemail,
        data.id,
      ]);

      return true;
    } catch (error) {
      console.error('Error updating personeltbl:', error);
      return false;
    }
  }

  async deleteSupplier(id: number): Promise<number> {
    const sql = `
    DELETE FROM suppliers
    WHERE suppid = ?
  `;
    return await this.db.insert(sql, [id]);
  }
}
