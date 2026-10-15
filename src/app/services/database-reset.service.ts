import { Injectable } from '@angular/core';
import { SqliteService } from './sqlite.service';

export type ResetModule =
  | 'inventory'
  | 'customer'
  | 'personnel'
  | 'transfer'
  | 'sales';

const RESET_MODULES: ResetModule[] = [
  'inventory',
  'customer',
  'personnel',
  'transfer',
  'sales',
];

@Injectable({ providedIn: 'root' })
export class DatabaseResetService {
  constructor(private db: SqliteService) {}

  async executeScopedReset(modules: ResetModule[]): Promise<void> {
    const selectedModules = new Set(modules);
    if (
      selectedModules.size === 0 ||
      modules.some((module) => !RESET_MODULES.includes(module))
    ) {
      throw new Error('Select at least one valid reset module.');
    }

    const clearsQueue =
      selectedModules.has('sales') || selectedModules.has('inventory');
    const queueSnapshot = clearsQueue
      ? localStorage.getItem('vpos_queued_orders')
      : null;

    try {
      await this.db.executeInTransaction(async () => {
        if (selectedModules.has('transfer')) {
          await this.db.execute('DELETE FROM pulloutcart', [], false);
          await this.db.execute('DELETE FROM pouttbl', [], false);
        }

        if (selectedModules.has('personnel')) {
          await this.db.execute('DELETE FROM deltransacttbl', [], false);
          await this.db.execute('DELETE FROM salhistory', [], false);
          await this.db.execute(
            'UPDATE personeltbl SET ptotalpay = 0',
            [],
            false
          );
        }

        if (selectedModules.has('customer')) {
          await this.db.execute('UPDATE custinfo SET custbalance = 0', [], false);
        }

        if (
          selectedModules.has('customer') ||
          selectedModules.has('sales') ||
          selectedModules.has('inventory')
        ) {
          await this.db.execute(`
            UPDATE salescart
            SET sclendqty = 0, sclendstats = 'RETURNED'
            WHERE EXISTS (
              SELECT 1
              FROM lendhistory
              WHERE lendstatus = 'LENDED'
                AND COALESCE(lendqty, 0) > 0
                AND lendrefnum = salescart.screfnum
                AND lenditemcode = salescart.scitemcode
            )
          `, [], false);
          await this.db.execute('UPDATE inventorytbl SET lendqty = 0', [], false);
          await this.db.execute(
            "DELETE FROM lendhistory WHERE lendstatus = 'LENDED' AND COALESCE(lendqty, 0) > 0",
            [],
            false
          );
        }

        if (selectedModules.has('sales')) {
          await this.db.execute('DELETE FROM creditpaymenttbl', [], false);
          await this.db.execute('DELETE FROM salescart', [], false);
          await this.db.execute('DELETE FROM salestbl', [], false);
          await this.db.execute('UPDATE custinfo SET custbalance = 0', [], false);
        }

        if (selectedModules.has('inventory')) {
          await this.db.execute(`
            UPDATE inventorytbl
            SET fillqty = 0,
                emptyqty = 0,
                lendqty = 0,
                whfill = 0,
                whempty = 0
          `, [], false);
        }

        if (clearsQueue) {
          localStorage.removeItem('vpos_queued_orders');
        }
      });
    } catch (error) {
      if (clearsQueue) {
        if (queueSnapshot === null) {
          localStorage.removeItem('vpos_queued_orders');
        } else {
          localStorage.setItem('vpos_queued_orders', queueSnapshot);
        }
      }
      throw error;
    }
  }
}
