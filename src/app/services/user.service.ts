import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  async login(username: string, password: string): Promise<any> {
    // Get saved connection from storage
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `${apiBaseUrl(connection.ip, connection.port)}/useraccounts/login`;
    const body = { username, password };

    try {
      const response = await this.http.post<any>(url, body).toPromise();
      return response;
    } catch (error: any) {
      let errorMsg = 'An unknown error occurred!';

      if (error.error instanceof ErrorEvent) {
        errorMsg = `Client-side error: ${error.error.message}`;
      } else if (error.status === 400) {
        errorMsg = error.error.message; // e.g., "Invalid username" or "Invalid password"
      } else {
        errorMsg = `Server-side error: ${error.status} ${error.message}`;
      }

      throw new Error(errorMsg);
    }
  }

  // Login function
  async logindb(username: string, password: string): Promise<any> {
    try {
      // Check if username exists
      const userByUsername = await this.db.query(
        `SELECT * FROM useraccounts WHERE usern = ? LIMIT 1`,
        [username]
      );

      if (userByUsername.length === 0) {
        throw new Error('Invalid username');
      }

      // Check if password matches
      const user = await this.db.query(
        `SELECT * FROM useraccounts WHERE usern = ? AND passw = ? LIMIT 1`,
        [username, password]
      );

      if (user.length === 0) {
        throw new Error('Invalid password');
      }

      return user[0];
    } catch (error: any) {
      let errorMsg = 'An unknown error occurred!';

      if (error.message === 'Invalid username') {
        errorMsg = 'Invalid username';
      } else if (error.message === 'Invalid password') {
        errorMsg = 'Invalid password';
      } else if (error.message === 'Account is inactive') {
        errorMsg = 'Account is inactive';
      } else {
        errorMsg = error.message;
      }

      throw new Error(errorMsg);
    }
  }

  async getUsersdb(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
    SELECT * FROM useraccounts 
    LIMIT ?
    OFFSET ?
  `;

    try {
      return await this.db.query(sql, [limit, offset]);
    } catch (error) {
      console.error('Error fetching useraccounts:', error);
      throw new Error('Failed to load useraccounts.');
    }
  }

  async searchUserOfflineSpecific(query: string): Promise<any[]> {
    let sql = `
    SELECT * 
    FROM useraccounts WHERE 1=1
  `;

    const params: any[] = [];
    if (query) {
      // check for field prefix
      const colonIndex = query.indexOf(':');
      if (colonIndex > 0) {
        const field = query.slice(0, colonIndex).toLowerCase().trim();
        const value = query.slice(colonIndex + 1).trim();

        if (field === 'empname' || field === 'usern') {
          sql += ` AND ${field} LIKE '%' || ? || '%'`;
          params.push(value);
        } else {
          // fallback: search both
          sql += ` AND (empname LIKE '%' || ? || '%' OR usern LIKE '%' || ? || '%')`;
          params.push(query, query);
        }
      } else {
        // no prefix → search both
        sql += ` AND (empname LIKE '%' || ? || '%' OR usern LIKE '%' || ? || '%')`;
        params.push(query, query);
      }
    }

    sql += ` ORDER BY empname ASC`;

    try {
      const rows = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error searching useraccounts:', error);
      throw new Error('Failed to search useraccounts.');
    }
  }

  async checknameExists(usern: string): Promise<boolean> {
    const sql = `SELECT 1 FROM useraccounts WHERE empname = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [usern]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking user:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async checkUsernameExists(usern: string): Promise<boolean> {
    const sql = `SELECT 1 FROM useraccounts WHERE usern = ? LIMIT 1`;

    try {
      const result = await this.db.query(sql, [usern]);
      // If any row returned, code exists
      return result.length > 0;
    } catch (error) {
      console.error('Error checking user:', error);
      // optional: rethrow or return false
      return false;
    }
  }

  async insert(data: {
    empname: string;
    usern: string;
    passw: string;
    accnttype: string;
    empaddress?: string;
    empcontnum?: string;
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
    INSERT INTO useraccounts (empname, empaddress, empcontnum, usern, passw, accnttype, accntdate) 
     VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
      data.empname,
      data.empaddress,
      data.empcontnum || '',
      data.usern || '',
      data.passw || '',
      data.accnttype || '',
      date,
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error inserting user:', error);
      return false;
    }
  }
  async update(data: {
    userid: number;
    usern: string;
    passw: string;
    accnttype: string;
    empaddress?: string;
    empcontnum?: string;
  }): Promise<boolean> {
    const sql = `
    UPDATE custinfo SET usern= ?, passw= ?, accnttype= ?, empaddress= ?, empcontnum=? WHERE custid= ?`;

    const params = [
      data.usern,
      data.passw,
      data.accnttype || '',
      data.empaddress || '',
      data.empcontnum || '',
      data.userid || '',
    ];

    try {
      await this.db.query(sql, params);

      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  async delete(id: number): Promise<number> {
    const sql = `
    DELETE FROM useraccounts
    WHERE userid = ?
  `;
    return await this.db.insert(sql, [id]);
  }
}
