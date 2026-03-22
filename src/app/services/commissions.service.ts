import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class CommissionsService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getAllCommissions(category: string): Promise<any[]> {
    const sql = `SELECT t0.itemid, t0.itemcode, t0.itemname, t0.itemsize, t1.compickup, t1.comdel, t1.comid AS latest_comid FROM inventorytbl t0 INNER JOIN commtbl t1 ON t1.comitemid = t0.itemid WHERE t1.comid = (SELECT MAX(comid) FROM commtbl WHERE comitemid = t0.itemid) AND t0.itemcategory = ? ORDER BY t1.comid ASC`;

    try {
      return await this.db.query(sql, [category]);
    } catch (error) {
      console.error('Error fetching Commission:', error);
      throw new Error('Failed to load Commission.');
    }
  }

  async getCommissionsdb(
    category: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `SELECT t0.itemid, t0.itemcode, t0.itemname, t0.itemsize, t1.compickup, t1.comdel, t1.comid AS latest_comid FROM inventorytbl t0 INNER JOIN commtbl t1 ON t1.comitemid = t0.itemid WHERE t1.comid = (SELECT MAX(comid) FROM commtbl WHERE comitemid = t0.itemid) AND t0.itemcategory = ? ORDER BY t1.comid ASC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [category, limit, offset]);
    } catch (error) {
      console.error('Error fetching Commission:', error);
      throw new Error('Failed to load Commission.');
    }
  }

  async insertCommission(
    comitemid: number,
    compickup: number,
    comdel: number
  ): Promise<number> {
    const sql = `
    INSERT INTO commtbl (comitemid, compickup, comdel) VALUES (?, ?, ?)
  `;
    return await this.db.insert(sql, [comitemid, compickup, comdel]);
  }

  async updateCommission(comitemid: number, compickup: number, comdel: number) {
    const sql = `
    UPDATE commtbl
    SET compickup = ?, comdel = ?
    WHERE comitemid = ?
  `;
    return await this.db.insert(sql, [compickup, comdel, comitemid]);
  }

  async deleteCommission(id: number): Promise<number> {
    const sql = `
    DELETE FROM commtbl
    WHERE comitemid = ?
  `;
    return await this.db.insert(sql, [id]);
  }
}
