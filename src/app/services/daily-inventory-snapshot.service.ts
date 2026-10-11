import { Injectable } from '@angular/core';
import { SqliteService } from './sqlite.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class DailyInventorySnapshotService {
  constructor(
    private db: SqliteService,
    private storageService: StorageService
  ) {}

  async captureCurrentInventory(cashierName?: string): Promise<void> {
    try {
      const user = await this.storageService.get<any>('login-data');
      const cashier = cashierName ?? user?.empname ?? '';
      const snapshotDate = this.getLocalDate();

      await this.db.execute(
        `INSERT INTO daily_inventory_snapshots (
          snapshot_date, location, item_code, description, filled_qty,
          empty_qty, floorstock, cashier_name, updated_at
        )
        SELECT ?, 'STORE', itemcode, COALESCE(itemname, ''),
          COALESCE(fillqty, 0), COALESCE(emptyqty, 0), COALESCE(floorstock, 0),
          ?, CURRENT_TIMESTAMP
        FROM inventorytbl
        WHERE itemcode IS NOT NULL
        ON CONFLICT(snapshot_date, location, item_code) DO UPDATE SET
          description = excluded.description,
          filled_qty = excluded.filled_qty,
          empty_qty = excluded.empty_qty,
          floorstock = excluded.floorstock,
          cashier_name = excluded.cashier_name,
          updated_at = CURRENT_TIMESTAMP`,
        [snapshotDate, cashier]
      );

      await this.db.execute(
        `INSERT INTO daily_inventory_snapshots (
          snapshot_date, location, item_code, description, filled_qty,
          empty_qty, floorstock, cashier_name, updated_at
        )
        SELECT ?, 'WAREHOUSE', itemcode, COALESCE(itemname, ''),
          COALESCE(whfill, 0), COALESCE(whempty, 0), COALESCE(floorstock, 0),
          ?, CURRENT_TIMESTAMP
        FROM inventorytbl
        WHERE itemcode IS NOT NULL
        ON CONFLICT(snapshot_date, location, item_code) DO UPDATE SET
          description = excluded.description,
          filled_qty = excluded.filled_qty,
          empty_qty = excluded.empty_qty,
          floorstock = excluded.floorstock,
          cashier_name = excluded.cashier_name,
          updated_at = CURRENT_TIMESTAMP`,
        [snapshotDate, cashier]
      );
    } catch (error) {
      console.error('Failed to capture daily inventory snapshot:', error);
    }
  }

  private getLocalDate(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
  }
}