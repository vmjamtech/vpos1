import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root',
})
export class PersonelsService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async getPersonels(limit: number = 30, offset: number = 0): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/personels/filter/offset?limit=${limit}&offset=${offset}`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  //for offline sqlite database
  async getPersonelsdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * from personeltbl 
    ORDER BY pname ASC
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching Personels:', error);
      throw new Error('Failed to load Personels.');
    }
  }

  async checknameExists(pname: string): Promise<boolean> {
    const sql = `SELECT 1 FROM personeltbl WHERE pname = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [pname]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking pname:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async insert(data: {
    pname: string;
    paddress: string;
    pcontactnum?: string;
    prole?: string;
  }): Promise<boolean> {
    // Current timestamp in "YYYY-MM-DD HH:mm:ss"
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;

    const sql = `
    INSERT INTO personeltbl (pname, paddress, pcontactnum, prole, pcreatedate)
     VALUES (?, ?, ?, ?, ?)
  `;

    const params = [
      data.pname,
      data.paddress,
      data.pcontactnum || '',
      data.prole || '',
      date,
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error inserting personeltbl:', error);
      return false;
    }
  }

  async update(data: {
    pid: number;
    pname: string;
    paddress: string;
    pcontactnum?: string;
    prole?: string;
  }): Promise<boolean> {
    const sql = `
    UPDATE personeltbl SET pname= ?, paddress= ?, pcontactnum= ?, prole= ? WHERE pid= ?`;

    const params = [
      data.pname,
      data.paddress,
      data.pcontactnum || '',
      data.prole || '',
      data.pid,
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error updating personeltbl:', error);
      return false;
    }
  }

  async delete(id: number): Promise<number> {
    const sql = `
    DELETE FROM personeltbl
    WHERE pid = ?
  `;
    return await this.db.insert(sql, [id]);
  }

  async getPersonelsalary(id: number): Promise<any[]> {
    const sql = `SELECT * FROM salsettings WHERE salpid = ?`;

    try {
      return await this.db.query(sql, [id]);
    } catch (error) {
      console.error('Error fetching Personelsalary:', error);
      throw new Error('Failed to load Personelsalary.');
    }
  }

  async updatesalary(data: {
    pid: number;
    saldaily: number; 
    saldiv: number;
    sal2kg: number;
    sal5kg: number;
    sal7kg: number;
    sal11kg: number;
    sal22kg: number;
    sal50kg: number;
    isHave: boolean;
  }): Promise<boolean> {
    try {
      let sql = '';
      let params: any[] = [];

      if (data.isHave) {
        // UPDATE
        sql = `
        UPDATE salsettings
        SET saldaily = ?, saldiv = ?, sal2kg = ?, sal5kg = ?, 
            sal7kg = ?, sal11kg = ?, sal22kg = ?, sal50kg = ?
        WHERE salpid = ?
      `;
        params = [
          data.saldaily,
          data.saldiv,
          data.sal2kg,
          data.sal5kg,
          data.sal7kg,
          data.sal11kg,
          data.sal22kg,
          data.sal50kg,
          data.pid,
        ];
      } else {
        // INSERT
        sql = `
        INSERT INTO salsettings 
        (salpid, saldaily, saldiv, sal2kg, sal5kg, 
         sal7kg, sal11kg, sal22kg, sal50kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
        params = [
          data.pid,
          data.saldaily,
          data.saldiv,
          data.sal2kg,
          data.sal5kg,
          data.sal7kg,
          data.sal11kg,
          data.sal22kg,
          data.sal50kg,
        ];
      }

      await this.db.query(sql, params);
      return true;
    } catch (error) {
      console.error('Error updating updatesalary:', error);
      return false;
    }
  }
}
