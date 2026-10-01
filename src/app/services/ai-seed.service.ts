import { Injectable } from '@angular/core';
import { SqliteService } from './sqlite.service';

interface IntentSeed {
  intentKey: string;
  description: string;
  sqlTemplate: string;
  allowedRoles?: string;
}

interface GuardrailSeed {
  tableName: string;
  columns: string[];
}

interface KnowledgeSeed {
  domain: string;
  title: string;
  content: string;
  tags: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiSeedService {
  private isSeeding = false;
  private isSeeded = false;

  constructor(private sqliteService: SqliteService) {}

  async seedIfNeeded(): Promise<void> {
    if (this.isSeeded || this.isSeeding) {
      return;
    }

    this.isSeeding = true;

    try {
      await this.sqliteService.initializeAiSchema();
      await this.seedPromptTemplates();
      await this.seedIntents();
      await this.seedGuardrails();
      await this.seedKnowledgeAndChunks();
      this.isSeeded = true;
    } finally {
      this.isSeeding = false;
    }
  }

  private async seedPromptTemplates(): Promise<void> {
    const prompt = `You are the local V-POS assistant.
Answer using only project data and seeded project knowledge.
If there is no matching data, say you do not have that information yet.
Keep answers concise and actionable.`;

    await this.sqliteService.execute(
      `INSERT OR IGNORE INTO ai_prompt_template (key, template, version, is_active)
       VALUES (?, ?, 1, 1)`,
      ['system_main', prompt]
    );
  }

  private async seedIntents(): Promise<void> {
    const intents: IntentSeed[] = [
      {
        intentKey: 'low_stock_items',
        description: 'Low stock items where current fill quantity is below or equal threshold.',
        sqlTemplate:
          'SELECT itemcode, itemname, fillqty, alertnum FROM inventorytbl WHERE alertnum > 0 AND fillqty <= alertnum ORDER BY fillqty ASC LIMIT 20',
      },
      {
        intentKey: 'sales_today_total',
        description: 'Current day sales count and amount.',
        sqlTemplate:
          "SELECT COUNT(*) AS sales_count, IFNULL(SUM(salestotalamount), 0) AS total_amount FROM salestbl WHERE DATE(salesdate) = DATE(?)",
      },
      {
        intentKey: 'unpaid_sales_today',
        description: 'Unpaid sales for current day.',
        sqlTemplate:
          "SELECT salesrefnum, salescust, IFNULL(tenderbalance, 0) AS tenderbalance, salesdate FROM salestbl WHERE salestatus = 'UNPAID' AND DATE(salesdate) = DATE(?) ORDER BY tenderbalance DESC LIMIT 20",
      },
      {
        intentKey: 'customer_balance_top',
        description: 'Top customers by outstanding balance.',
        sqlTemplate:
          'SELECT custname, IFNULL(custbalance, 0) AS custbalance FROM custinfo WHERE IFNULL(custbalance, 0) > 0 ORDER BY custbalance DESC LIMIT 10',
      },
      {
        intentKey: 'petty_cash_total_today',
        description: 'Total petty cash logs for current day.',
        sqlTemplate:
          "SELECT COUNT(*) AS entries_count, IFNULL(SUM(CASE WHEN pettylogtype = 'CASH IN' THEN pettylogamount ELSE 0 END), 0) AS cash_in_total, IFNULL(SUM(CASE WHEN pettylogtype = 'CASH OUT' THEN pettylogamount ELSE 0 END), 0) AS cash_out_total FROM pettylogstbl WHERE DATE(pettylogdate) = DATE(?)",
      },
      {
        intentKey: 'transfers_today',
        description: 'Transfer records for current day.',
        sqlTemplate:
          "SELECT poutrefnum, pullsupplier, pouttype, IFNULL(pouttotalqty, 0) AS pouttotalqty, IFNULL(pulloutremarks, '') AS pulloutremarks, pulldate FROM pouttbl WHERE DATE(pulldate) = DATE(?) ORDER BY poutid DESC LIMIT 20",
      },
      {
        intentKey: 'personnel_activity_today',
        description: 'Personnel delivery activity summary for current day.',
        sqlTemplate:
          "SELECT IFNULL(dtdelby, 'UNASSIGNED') AS personnel, COUNT(*) AS transaction_count, IFNULL(SUM(dsalary), 0) AS salary_total FROM deltransacttbl WHERE DATE(dtdate) = DATE(?) GROUP BY dtdelby ORDER BY transaction_count DESC LIMIT 10",
      },
    ];

    for (const intent of intents) {
      await this.sqliteService.execute(
        `INSERT INTO ai_intent
         (intent_key, description, sql_template, allowed_roles, is_active, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))
         ON CONFLICT(intent_key) DO UPDATE SET
           description = excluded.description,
           sql_template = excluded.sql_template,
           allowed_roles = excluded.allowed_roles,
           is_active = 1,
           updated_at = datetime('now')`,
        [
          intent.intentKey,
          intent.description,
          intent.sqlTemplate,
          intent.allowedRoles ?? 'ADMINISTRATOR,MANAGER,CASHIER',
        ]
      );
    }
  }

  private async seedGuardrails(): Promise<void> {
    const guardrails: GuardrailSeed[] = [
      { tableName: 'inventorytbl', columns: ['itemcode', 'itemname', 'fillqty', 'alertnum'] },
      { tableName: 'salestbl', columns: ['salesrefnum', 'salescust', 'salestotalamount', 'salesdate', 'salestatus', 'tenderbalance'] },
      { tableName: 'salescart', columns: ['screfnum', 'scitemcode', 'scitemdesc', 'scqty', 'scdate', 'scstats'] },
      { tableName: 'custinfo', columns: ['custname', 'custbalance'] },
      { tableName: 'pettylogstbl', columns: ['pettylogdate', 'pettylogamount'] },
      { tableName: 'pouttbl', columns: ['poutrefnum', 'pullsupplier', 'pouttype', 'pouttotalqty', 'pulloutremarks', 'pulldate'] },
      { tableName: 'deltransacttbl', columns: ['dtdelby', 'dtdate', 'dsalary'] },
    ];

    for (const entry of guardrails) {
      for (const columnName of entry.columns) {
        await this.sqliteService.execute(
          `INSERT OR IGNORE INTO ai_sql_guardrail
           (table_name, column_name, can_read, can_write)
           VALUES (?, ?, 1, 0)`,
          [entry.tableName, columnName]
        );
      }
    }
  }

  private async seedKnowledgeAndChunks(): Promise<void> {
    const docs: KnowledgeSeed[] = [
      {
        domain: 'project-help',
        title: 'V-POS Overview',
        tags: 'overview,modules,capabilities',
        content:
          'V-POS is an Android-ready, offline-first POS app. Key modules include POS checkout, sales management, inventory, transfers, customers, personnel, petty cash, settings, dashboard analytics, notifications, and iMin receipt printing.',
      },
      {
        domain: 'sales',
        title: 'Payment Methods',
        tags: 'sales,payment,methods',
        content:
          'POS payment methods supported: CASH, GCASH, and BANK TRANSFER. Payment type can be FULL PAYMENT or PARTIAL PAYMENT. Partial payments produce an UNPAID sale with a remaining tender balance.',
      },
      {
        domain: 'sales',
        title: 'Receipt Reprint',
        tags: 'sales,printing,reprint',
        content:
          'To reprint a receipt: open Sales list, open a sale details, and use Reprint Receipt. The printer must be connected and in normal status.',
      },
      {
        domain: 'sales',
        title: 'Cancellation Rules',
        tags: 'sales,cancel,inventory',
        content:
          'Cancelling an order requires a cancellation note. Cancelling updates sale status, reverses inventory changes, and adjusts linked personnel salary/transaction records. Items can also be cancelled with a quantity and required note.',
      },
      {
        domain: 'inventory',
        title: 'Lending Rules',
        tags: 'inventory,lending,returns',
        content:
          'Lending is allowed only for REFILL items. NON-REFILL items cannot be lent. Empty quantity must be available. Max lend quantity is limited by sold qty minus already lended qty. Lending updates inventory, creates lend history, and can print a lend slip.',
      },
      {
        domain: 'sales',
        title: 'Sales Module Rules',
        tags: 'sales,payment,credit',
        content:
          'Sales supports FULL PAYMENT and PARTIAL PAYMENT. Payment methods include CASH, GCASH, and BANK TRANSFER. Unpaid sales keep tender balance and can be settled later from sales details.',
      },
      {
        domain: 'inventory',
        title: 'Inventory Rules',
        tags: 'inventory,stock,low-stock',
        content:
          'Inventory tracks item fill quantity, empty quantity, lending quantity, and alert threshold. Low stock means fill quantity is less than or equal to alert number. Inventory is updated by purchases, lending, transfer, restock, and cancellation flows.',
      },
      {
        domain: 'transfers',
        title: 'Transfers Module',
        tags: 'transfer,restock,warehouse',
        content:
          'Transfer workflows include store convert, create convert, used convert, store restock out/in, warehouse out/in, and warehouse restock out/in. Every transfer has a reference number, supplier/destination, quantities, and status.',
      },
      {
        domain: 'personnel',
        title: 'Personnel and Salary',
        tags: 'personnel,salary,delivery',
        content:
          'Personnel module stores rates and tracks transaction-based salary records. Salary updates are linked to delivery transactions and can be affected by order or item cancellation.',
      },
    ];

    for (const doc of docs) {
      const knowledgeId = await this.getOrCreateKnowledge(doc);
      await this.seedChunksForKnowledge(knowledgeId, doc.content, doc.tags);
    }
  }

  private async getOrCreateKnowledge(knowledge: KnowledgeSeed): Promise<number> {
    const existing = await this.sqliteService.query<{ id: number }>(
      `SELECT id
       FROM ai_knowledge
       WHERE domain = ? AND title = ? AND version = 1
       LIMIT 1`,
      [knowledge.domain, knowledge.title]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    return this.sqliteService.insert(
      `INSERT INTO ai_knowledge
       (domain, title, source_type, source_ref, content, tags, version, is_active)
       VALUES (?, ?, 'manual', '', ?, ?, 1, 1)`,
      [knowledge.domain, knowledge.title, knowledge.content, knowledge.tags]
    );
  }

  private async seedChunksForKnowledge(
    knowledgeId: number,
    content: string,
    tags: string
  ): Promise<void> {
    const existingCount = await this.sqliteService.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM ai_chunk WHERE knowledge_id = ?',
      [knowledgeId]
    );

    if (existingCount[0]?.count > 0) {
      return;
    }

    const chunks = this.chunkText(content, 320);

    for (let index = 0; index < chunks.length; index++) {
      const chunkText = chunks[index];
      const chunkId = await this.sqliteService.insert(
        `INSERT INTO ai_chunk
         (knowledge_id, chunk_text, chunk_index, token_count, embedding_json, tags)
         VALUES (?, ?, ?, ?, '', ?)`,
        [knowledgeId, chunkText, index, this.estimateTokenCount(chunkText), tags]
      );

      await this.insertChunkIntoFts(chunkId, chunkText, tags);
    }
  }

  private async insertChunkIntoFts(
    chunkId: number,
    chunkText: string,
    tags: string
  ): Promise<void> {
    try {
      await this.sqliteService.execute(
        'INSERT INTO ai_chunk_fts (chunk_id, chunk_text, tags) VALUES (?, ?, ?)',
        [chunkId, chunkText, tags]
      );
    } catch (error) {
      // FTS can be unavailable on some SQLite builds. Ignore and continue with LIKE fallback.
      console.warn('FTS insert skipped for chunk:', chunkId, error);
    }
  }

  private chunkText(content: string, maxLength: number): string[] {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return [normalized];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < normalized.length) {
      const end = Math.min(cursor + maxLength, normalized.length);
      chunks.push(normalized.slice(cursor, end).trim());
      cursor = end;
    }

    return chunks;
  }

  private estimateTokenCount(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }
}
