import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { runDatabaseMigrations } from './database-migrations';

@Injectable({
  providedIn: 'root',
})
export class SqliteService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private dbConn!: SQLiteDBConnection;
  private readonly dbName = 'vmjampos';
  private isAndroid = Capacitor.getPlatform() === 'android';
  private aiSchemaInitialized = false;

  constructor(private http: HttpClient) {}

  async initdb() {
    await this.sqlite.copyFromAssets(false);
  }

  // Initialize database connection
  async initializeDatabase() {
    try {
      if (this.isAndroid) {
        const ret = await this.sqlite.checkConnectionsConsistency();
        console.log('ret', ret);
        if (ret.result) {
          // DB is already consistent, reuse it
          this.dbConn = await this.sqlite.retrieveConnection(
            this.dbName,
            false
          );
        } else {
          // no valid connection, create a new one
          this.dbConn = await this.sqlite.createConnection(
            this.dbName,
            false,
            'no-encryption',
            1,
            false
          );
        }

        await this.dbConn.open();
  await runDatabaseMigrations(this.dbConn);
        await this.initializeAiSchema();
        console.log('Database connection established');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Execute SQL (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)
   */
  async execute(sql: string, params: any[] = []): Promise<void> {
    await this.ensureDb();
    await this.dbConn.run(sql, params);
  }

  async initializeAiSchema(): Promise<void> {
    if (this.aiSchemaInitialized) {
      return;
    }

    await this.ensureDbConnection();

    try {
      const schemaText = await firstValueFrom(
        this.http.get('assets/schema/ai-schema.sql', { responseType: 'text' })
      );
      await this.executeSqlScript(schemaText);
      this.aiSchemaInitialized = true;
    } catch (error) {
      console.error('Error initializing AI schema:', error);
      throw error;
    }
  }

  /**
   * Query SQL (SELECT)
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureDb();
    const result = await this.dbConn.query(sql, params);
    return result.values as T[];
  }

  /**
   * Insert helper (returns last insert id)
   */
  async insert(sql: string, params: any[] = []): Promise<number> {
    await this.ensureDb();
    const res = await this.dbConn.run(sql, params);
    return res.changes?.lastId ?? 0;
  }

  /**
   * Update helper (returns number of rows updated)
   */
  async update(sql: string, params: any[] = []): Promise<number> {
    await this.ensureDb();
    const res = await this.dbConn.run(sql, params);
    return res.changes?.changes ?? 0;
  }

  /**
   * Delete helper (returns number of rows deleted)
   */
  async delete(sql: string, params: any[] = []): Promise<number> {
    await this.ensureDb();
    const res = await this.dbConn.run(sql, params);
    return res.changes?.changes ?? 0;
  }

  /**
   * Get all records from a table
   */
  async getAll<T = any>(table: string): Promise<T[]> {
    return this.query<T>(`SELECT * FROM ${table}`);
  }

  /**
   * Get one record by ID
   */
  async getById<T = any>(table: string, id: number): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
      [id]
    );
    return result.length ? result[0] : null;
  }

  /**
   * Get records by multiple conditions
   */
  async getByQuery<T = any>(
    table: string,
    conditions: Record<string, any>
  ): Promise<T[]> {
    const keys = Object.keys(conditions);

    if (keys.length === 0) {
      return this.getAll<T>(table);
    }

    const whereClause = keys.map((k) => `${k} = ?`).join(' AND ');
    const values = keys.map((k) => conditions[k]);

    const sql = `SELECT * FROM ${table} WHERE ${whereClause}`;
    return this.query<T>(sql, values);
  }

  /**
   * Internal: ensure DB is initialized
   */
  private async ensureDb(): Promise<void> {
    await this.ensureDbConnection();
    if (!this.aiSchemaInitialized) {
      await this.initializeAiSchema();
    }
  }

  private async ensureDbConnection(): Promise<void> {
    if (!this.dbConn) {
      await this.initializeDatabase();
    }
  }

  private async executeSqlScript(sqlScript: string): Promise<void> {
    const statements = sqlScript
      .replace(/\r/g, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      try {
        await this.dbConn.run(statement);
      } catch (error) {
        // Keep migration resilient when optional features (like FTS5) are unavailable.
        console.warn('Skipping SQL statement during AI schema init:', statement);
        console.warn(error);
      }
    }
  }
}
