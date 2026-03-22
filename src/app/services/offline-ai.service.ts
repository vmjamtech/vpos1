import { Injectable } from '@angular/core';
import { AiSeedService } from './ai-seed.service';
import { SqliteService } from './sqlite.service';

interface AiIntentRow {
  intent_key: string;
  description: string;
  sql_template: string;
}

interface IntentMatch {
  intentKey: string;
  confidence: number;
}

interface QueryContext {
  today: string;
}

interface StaticAnswer {
  intentKey: string;
  confidence: number;
  html: string;
}

interface DynamicAnswer {
  intentKey: string;
  confidence: number;
  sqlUsed: string;
  params: unknown[];
  html: string;
}

type DateRange = { start: string; end: string; label: string };

@Injectable({
  providedIn: 'root',
})
export class PosAiRestService {
  constructor(
    private sqliteService: SqliteService,
    private aiSeedService: AiSeedService
  ) {}

  async ask(question: string): Promise<string> {
    const trimmedQuestion = question?.trim() ?? '';
    if (!trimmedQuestion) {
      return 'Please enter a question.';
    }

    const startedAt = Date.now();
    let intentKey = '';
    let sqlUsed = '';
    let confidence = 0.3;
    let answer = '';

    try {
      await this.aiSeedService.seedIfNeeded();

      const staticAnswer = this.tryStaticAnswer(trimmedQuestion);
      if (staticAnswer) {
        intentKey = staticAnswer.intentKey;
        confidence = staticAnswer.confidence;
        answer = staticAnswer.html;
      }

      const dynamicAnswer =
        answer === '' ? this.tryDynamicAnswer(trimmedQuestion) : null;
      if (dynamicAnswer) {
        intentKey = dynamicAnswer.intentKey;
        confidence = dynamicAnswer.confidence;
        sqlUsed = dynamicAnswer.sqlUsed;

        // Some dynamic answers are "clarify" responses and intentionally don't execute SQL.
        if ((dynamicAnswer.sqlUsed || '').trim() === '') {
          answer = dynamicAnswer.html;
        } else {
          await this.validateReadOnlySql(dynamicAnswer.sqlUsed);
          const rows = await this.sqliteService.query<Record<string, unknown>>(
            dynamicAnswer.sqlUsed,
            dynamicAnswer.params
          );
          answer = this.renderDynamicAnswer(
            dynamicAnswer.intentKey,
            rows,
            dynamicAnswer.html
          );
        }
      }

      const context = this.buildQueryContext();
      const intentMatch =
        answer === '' ? await this.detectIntent(trimmedQuestion.toLowerCase()) : null;

      if (intentMatch) {
        intentKey = intentMatch.intentKey;
        confidence = intentMatch.confidence;

        const intent = await this.getIntent(intentMatch.intentKey);
        if (intent) {
          await this.validateReadOnlySql(intent.sql_template);
          sqlUsed = intent.sql_template;
          const params = this.resolveIntentParams(intent.intent_key, context);
          const rows = await this.sqliteService.query<Record<string, unknown>>(
            intent.sql_template,
            params
          );
          // Friendly fallback: if no low-stock items exist, show the lowest-stock list instead.
          if (intent.intent_key === 'low_stock_items' && rows.length === 0) {
            const fallbackSql =
              'SELECT itemcode, itemname, fillqty, alertnum FROM inventorytbl ORDER BY IFNULL(fillqty, 0) ASC LIMIT 20';
            await this.validateReadOnlySql(fallbackSql);
            const fallbackRows = await this.sqliteService.query<Record<string, unknown>>(
              fallbackSql,
              []
            );

            if (fallbackRows.length > 0) {
              answer = this.withSuggestion(
                this.renderLowStockList('No Low-Stock Alerts Set Yet', fallbackRows),
                'Set Alert/Min per item to enable low-stock alerts (rule: fillqty <= alertnum and alertnum > 0).'
              );
            } else {
              answer = this.renderIntentAnswer(intent.intent_key, rows);
            }
          } else {
            answer = this.renderIntentAnswer(intent.intent_key, rows);
          }
        }
      }

      if (!answer) {
        answer = await this.fallbackKnowledgeAnswer(trimmedQuestion);
      }

      await this.logQuery({
        question: trimmedQuestion,
        intentKey,
        sqlUsed,
        answerPreview: this.stripHtml(answer).slice(0, 300),
        confidence,
        latencyMs: Date.now() - startedAt,
      });

      return answer;
    } catch (error) {
      console.error('AI pipeline error:', error);
      const fallback =
        "I can answer only from your V-POS project data and knowledge base. Try sales, inventory, transfers, customers, personnel, petty cash, printing, payments, cancellations, or lending.";

      await this.logQuery({
        question: trimmedQuestion,
        intentKey,
        sqlUsed,
        answerPreview: fallback,
        confidence: 0.1,
        latencyMs: Date.now() - startedAt,
      });

      return fallback;
    }
  }

  private buildQueryContext(): QueryContext {
    return {
      today: new Date().toISOString().split('T')[0],
    };
  }

  private async detectIntent(lowerQuestion: string): Promise<IntentMatch | null> {
    const rules: Array<{ key: string; regex: RegExp; confidence: number }> = [
      {
        key: 'low_stock_items',
        regex: /(low stock|critical stock|below.*(alert|min)|reorder|kulang\s+stock|paubos\s+na|ubos\s+na)/i,
        confidence: 0.96,
      },
      {
        key: 'sales_today_total',
        regex: /(sales.*today|today.*sales|total sales today|sales summary today|benta.*ngayon|ngayon.*benta|kita.*ngayon)/i,
        confidence: 0.95,
      },
      {
        key: 'unpaid_sales_today',
        regex: /(unpaid|outstanding|balance due|utang|kulang\s+bayad|may\s+kulang).*(today|ngayon)?/i,
        confidence: 0.94,
      },
      {
        key: 'customer_balance_top',
        regex: /(customer.*balance|customers with balance|top.*balance|may\s+balance\s+na\s+customer|may\s+utang\s+na\s+customer)/i,
        confidence: 0.92,
      },
      {
        key: 'petty_cash_total_today',
        regex: /(petty cash.*today|today.*petty cash|petty total|cash out.*today|gastos.*today|expense.*today)/i,
        confidence: 0.92,
      },
      {
        key: 'transfers_today',
        regex: /(transfer.*today|today.*transfer|restock.*today|pullout.*today)/i,
        confidence: 0.9,
      },
      {
        key: 'personnel_activity_today',
        regex: /(personnel.*today|delivery.*today|staff.*transaction.*today|delivery\s+ngayon|staff\s+ngayon)/i,
        confidence: 0.88,
      },
    ];

    for (const rule of rules) {
      if (rule.regex.test(lowerQuestion)) {
        return {
          intentKey: rule.key,
          confidence: rule.confidence,
        };
      }
    }

    return null;
  }

  private tryStaticAnswer(question: string): StaticAnswer | null {
    const q = question.toLowerCase();

    if (/(what can this project do|project features|what is v-pos|overview)/i.test(q)) {
      return {
        intentKey: 'help_project_overview',
        confidence: 0.98,
        html: `
          <div>
            <strong>V-POS Capabilities</strong>
            <ul>
              <li>POS checkout (pickup/delivery), discounts, VAT totals</li>
              <li>Full payment and partial payment flows</li>
              <li>Sales management: unpaid balances, notes, reprint, cancel</li>
              <li>Inventory: categories, low-stock, history, warehouse support</li>
              <li>Transfers/restocking: convert + restock workflows</li>
              <li>Customers: balances, transactions, inactive customers</li>
              <li>Personnel: rates, transactions, salary history</li>
              <li>Petty cash logs and dashboard analytics</li>
              <li>iMin printer receipts and slips</li>
            </ul>
            <div style="margin-top:8px;font-size:12px;color:#4b5563;">
              <strong>Try:</strong> "How do I reprint a receipt?" or "Explain partial payment"
            </div>
          </div>
        `,
      };
    }

    if (/(payment methods|supported payment|how can i pay|gcash|bank transfer)/i.test(q)) {
      return {
        intentKey: 'help_payment_methods',
        confidence: 0.97,
        html: `
          <div>
            <strong>Supported Payments (POS)</strong><br/>
            Methods: <strong>Cash</strong>, <strong>GCash</strong>, <strong>Bank Transfer</strong><br/>
            Types: <strong>Full Payment</strong> and <strong>Partial Payment</strong>
            <div style="margin-top:8px;font-size:12px;color:#4b5563;">
              <strong>Tip:</strong> Use Partial Payment when tendered is less than total. The sale becomes <strong>UNPAID</strong> with a remaining balance.
            </div>
          </div>
        `,
      };
    }

    if (/(partial payment|installment|remaining balance|tender balance|due date)/i.test(q)) {
      return {
        intentKey: 'help_partial_payment',
        confidence: 0.97,
        html: `
          <div>
            <strong>Partial Payment (How It Works)</strong>
            <ul>
              <li>You enter a tendered amount that is less than the total.</li>
              <li>The sale is saved as <strong>UNPAID</strong> with a <strong>tender balance</strong> (remaining amount).</li>
              <li>The customer balance is updated to reflect the remaining balance.</li>
              <li>You can later open the sale details and process a balance payment.</li>
            </ul>
            <div style="margin-top:8px;font-size:12px;color:#4b5563;">
              <strong>Try:</strong> "Show unpaid sales today" to see pending balances.
            </div>
          </div>
        `,
      };
    }

    if (/(cancel.*order|cancel.*sale|void.*sale|cancellation note|cancel item)/i.test(q)) {
      return {
        intentKey: 'help_cancellation',
        confidence: 0.96,
        html: `
          <div>
            <strong>Cancel Sale / Cancel Item</strong>
            <ul>
              <li>Go to <strong>Sales</strong> and open the transaction details.</li>
              <li><strong>Cancel Order</strong>: requires a cancellation note and marks the sale as <strong>CANCELLED</strong>.</li>
              <li><strong>Cancel Item</strong>: choose quantity + note; updates totals and related balances.</li>
              <li>Inventory quantities are reversed accordingly.</li>
              <li>Personnel salary/transaction links are also adjusted.</li>
            </ul>
            <div style="margin-top:8px;font-size:12px;color:#4b5563;">
              <strong>Important:</strong> Notes are required so cancellations are auditable.
            </div>
          </div>
        `,
      };
    }

    if (/(reprint|print again|receipt again|reprint receipt)/i.test(q)) {
      return {
        intentKey: 'help_reprint_receipt',
        confidence: 0.97,
        html: `
          <div>
            <strong>Reprint Receipt</strong>
            <ul>
              <li>Go to <strong>Sales</strong>.</li>
              <li>Open the sale details.</li>
              <li>Tap <strong>Reprint Receipt</strong>.</li>
              <li>Make sure the iMin printer is connected and ready.</li>
            </ul>
          </div>
        `,
      };
    }

    if (/(lend items|lending|borrow|return.*lend)/i.test(q)) {
      return {
        intentKey: 'help_lending',
        confidence: 0.96,
        html: `
          <div>
            <strong>Lending Items (Rules)</strong>
            <ul>
              <li>Only <strong>REFILL</strong> items can be lent (NON-REFILL is blocked).</li>
              <li>The app checks <strong>empty quantity</strong> first; if empty is 0, lending is blocked.</li>
              <li>Max lendable is based on sold quantity minus already-lent quantity.</li>
              <li>Lending updates inventory + creates lend history and can print a lend slip.</li>
            </ul>
          </div>
        `,
      };
    }

    return null;
  }

  private tryDynamicAnswer(question: string): DynamicAnswer | null {
    const q = question.trim();

    const hasSalesKeyword = /\b(sales|total sales|revenue|income|benta|kita)\b/i.test(q);
    const hasUnpaidKeyword = /\b(unpaid|outstanding|balance due|utang|kulang\s+bayad|may\s+kulang)\b/i.test(q);
    const rangeFromQuestion = this.parseDateRangeFromQuestion(q);
    const defaultRange = this.parseDateRangeFromQuestion('today')!;
    const rangeOrToday = rangeFromQuestion ?? defaultRange;

    // 0) ITEM SALES: "top items", "items sold", "sales of <item>", "itemcode <x> sales"
    if (
      /\b(top|best)\s+(items|products)\b|\bmost\s+sold\b|\bitems?\s+sold\b|\bitemcode\b|\bproduct\b/i.test(q) ||
      /\bsales\s+(?:of|for)\b/i.test(q) ||
      /\bsold\s+(?:of|for)\b/i.test(q)
    ) {
      // If the user says "items sold" but doesn't provide a period, default to this month (more helpful than today).
      const rangeForItems = rangeFromQuestion ?? this.parseDateRangeFromQuestion('this month') ?? defaultRange;

      // Total items sold (quantity) for a period: "items sold this month", "total items sold January 2026"
      // Note: this must run before the item-term extraction to avoid interpreting "this month" as an item name.
        if (
          (/\bitems?\s+sold\b|\bquantity\s+sold\b|\btotal\s+items?\s+sold\b/i.test(q)) &&
          !/\b(top|best|most)\b/i.test(q)
        ) {
          const sql =
          `SELECT IFNULL(SUM(sc.scqty), 0) AS total_qty
           FROM salescart sc
           INNER JOIN salestbl st
             ON st.salesrefnum = sc.screfnum
            AND st.salestatus <> 'CANCELLED'
           WHERE substr(sc.scdate, 1, 10) >= ?
             AND substr(sc.scdate, 1, 10) <= ?
             AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'`;

        return {
          intentKey: 'items_sold_period_total',
          confidence: rangeFromQuestion ? 0.9 : 0.84,
          sqlUsed: sql,
          params: [rangeForItems.start, rangeForItems.end],
          html: `
            <div>
              <strong>Items Sold (Quantity)</strong><br/>
              Period: ${this.escapeHtml(rangeForItems.label)}<br/>
            </div>
          `,
        };
      }

      // Summary/top items
      if (/\b(top|best)\s+(items|products)\b|\bmost\s+sold\b/i.test(q)) {
        const sql =
          `SELECT sc.scitemcode, sc.scitemdesc, IFNULL(SUM(sc.scqty), 0) AS quantity
           FROM salescart sc
           INNER JOIN salestbl st
             ON st.salesrefnum = sc.screfnum
            AND st.salestatus <> 'CANCELLED'
           WHERE substr(sc.scdate, 1, 10) >= ?
             AND substr(sc.scdate, 1, 10) <= ?
             AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
           GROUP BY sc.scitemcode, sc.scitemdesc
           ORDER BY IFNULL(SUM(sc.scqty), 0) DESC
           LIMIT 10`;

        return {
          intentKey: 'sales_top_items_period',
          confidence: rangeFromQuestion ? 0.92 : 0.86,
          sqlUsed: sql,
          params: [rangeForItems.start, rangeForItems.end],
          html: `
            <div>
              <strong>Top Items Sold</strong><br/>
              Period: ${this.escapeHtml(rangeForItems.label)}<br/>
            </div>
          `,
        };
      }

      // Item lookup in sales: "sales of LPG11KG", "itemcode LPG11KG sales January 2026"
      const itemTermMatch = q.match(
        /\b(?:sales|sold|itemcode|product)\b.*?\b(?:of|for)?\s*([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i
      );
      if (itemTermMatch) {
        const rawTerm = itemTermMatch[1].trim();
        const termLower = rawTerm.toLowerCase();
        const rangeWords = new Set([
          'today',
          'yesterday',
          'this month',
          'last month',
          'this week',
          'last week',
          'this year',
          'last year',
        ]);

        // If the range is embedded in the captured term (example: "XTANK December 2026"),
        // strip date phrases so the remaining token can be treated as the item keyword.
        const cleanedTerm = rawTerm
          .replace(
            /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/gi,
            ''
          )
          .replace(/\b20\d{2}-\d{2}-\d{2}\b/gi, '')
          .replace(/\b(20\d{2})-(0[1-9]|1[0-2])\b/gi, '')
          .replace(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/gi, '')
          .replace(/\b(this|last)\s+month\b/gi, '')
          .replace(/\b(today|yesterday)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        const finalTerm = cleanedTerm || rawTerm;
        const finalTermLower = finalTerm.toLowerCase();

        // If term looks like a date-range phrase, don't treat it as an item name.
        if (
          finalTerm.length >= 2 &&
          !rangeWords.has(finalTermLower) &&
          !this.containsMonthToken(finalTerm) &&
          !/\b20\d{2}\b/.test(finalTerm)
        ) {
          const sql =
            `SELECT sc.scitemcode, sc.scitemdesc, IFNULL(SUM(sc.scqty), 0) AS quantity
             FROM salescart sc
             INNER JOIN salestbl st
               ON st.salesrefnum = sc.screfnum
              AND st.salestatus <> 'CANCELLED'
             WHERE (lower(sc.scitemcode) LIKE '%' || lower(?) || '%' OR lower(sc.scitemdesc) LIKE '%' || lower(?) || '%')
               AND substr(sc.scdate, 1, 10) >= ?
               AND substr(sc.scdate, 1, 10) <= ?
               AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
             GROUP BY sc.scitemcode, sc.scitemdesc
             ORDER BY IFNULL(SUM(sc.scqty), 0) DESC
             LIMIT 20`;

          return {
            intentKey: 'sales_item_qty_period',
            confidence: 0.88,
            sqlUsed: sql,
            params: [finalTerm, finalTerm, rangeForItems.start, rangeForItems.end],
            html: `
              <div>
                <strong>Item Sales (Quantity)</strong><br/>
                Match: ${this.escapeHtml(finalTerm)}<br/>
                Period: ${this.escapeHtml(rangeForItems.label)}<br/>
              </div>
            `,
          };
        }
      }
    }

    // 1) SALES: totals for a period (user-friendly ranges + month/year + explicit dates)
    if (hasSalesKeyword || hasUnpaidKeyword) {
      const range = this.parseDateRangeFromQuestion(q);

      // If the user mentions a month but no year, avoid guessing.
      if (!range && this.containsMonthToken(q) && !/\b20\d{2}\b/.test(q)) {
        return {
          intentKey: 'clarify_sales_month_year',
          confidence: 0.65,
          sqlUsed: '',
          params: [],
          html: this.withSuggestion(
            `
              <div>
                <strong>Which year?</strong><br/>
                I can calculate total sales for a month, but I need the year too.<br/>
                Example: <strong>"total sales of January 2026"</strong>
              </div>
            `,
            'You can also say: "sales this month", "sales last month", or "from 2026-01-01 to 2026-01-31".'
          ),
        };
      }

      // If question mentions sales but doesn't specify any period, default to today.
      const finalRange = range ?? defaultRange;

      // Unpaid sales variant
      if (hasUnpaidKeyword) {
        const sql =
          "SELECT COUNT(*) AS sales_count, IFNULL(SUM(tenderbalance), 0) AS total_balance FROM salestbl WHERE salestatus = 'UNPAID' AND DATE(salesdate) >= DATE(?) AND DATE(salesdate) <= DATE(?)";

        return {
          intentKey: 'sales_unpaid_period_total',
          confidence: range ? 0.93 : 0.88,
          sqlUsed: sql,
          params: [finalRange.start, finalRange.end],
          html: `
            <div>
              <strong>Unpaid Sales Summary</strong><br/>
              Period: ${this.escapeHtml(finalRange.label)}<br/>
            </div>
          `,
        };
      }

      const sql =
        'SELECT COUNT(*) AS sales_count, IFNULL(SUM(salestotalamount), 0) AS total_amount FROM salestbl WHERE DATE(salesdate) >= DATE(?) AND DATE(salesdate) <= DATE(?)';

      return {
        intentKey: 'sales_period_total',
        confidence: range ? 0.95 : 0.9,
        sqlUsed: sql,
        params: [finalRange.start, finalRange.end],
        html: `
          <div>
            <strong>Total Sales</strong><br/>
            Period: ${this.escapeHtml(finalRange.label)}<br/>
          </div>
        `,
      };
    }

    // 1b) TRANSFERS: list/summary for a period
    if (/\btransfer(s)?\b|\bpullout\b|\brestock\b/i.test(q)) {
      const range = rangeOrToday;

      if (/\b(total|summary|count)\b/i.test(q)) {
        const sql =
          `SELECT COUNT(*) AS transfer_count, IFNULL(SUM(pouttotalqty), 0) AS total_qty
           FROM pouttbl
           WHERE DATE(pulldate) >= DATE(?)
             AND DATE(pulldate) <= DATE(?)`;

        return {
          intentKey: 'transfers_period_summary',
          confidence: rangeFromQuestion ? 0.9 : 0.84,
          sqlUsed: sql,
          params: [range.start, range.end],
          html: `
            <div>
              <strong>Transfers Summary</strong><br/>
              Period: ${this.escapeHtml(range.label)}<br/>
            </div>
          `,
        };
      }

      const sql =
        `SELECT poutrefnum, pullsupplier, pouttype, IFNULL(pouttotalqty, 0) AS pouttotalqty, IFNULL(pulloutremarks, '') AS pulloutremarks, pulldate
         FROM pouttbl
         WHERE DATE(pulldate) >= DATE(?)
           AND DATE(pulldate) <= DATE(?)
         ORDER BY pulldate DESC
         LIMIT 50`;

      return {
        intentKey: 'transfers_period_list',
        confidence: rangeFromQuestion ? 0.9 : 0.84,
        sqlUsed: sql,
        params: [range.start, range.end],
        html: `
          <div>
            <strong>Transfers</strong><br/>
            Period: ${this.escapeHtml(range.label)}<br/>
          </div>
        `,
      };
    }

    // 1c) PETTY CASH: totals / entries for a period
    if (/\bpetty\b|\bcash\s+out\b|\bexpense\b/i.test(q)) {
      const range = rangeOrToday;

      if (/\b(list|entries|show)\b/i.test(q)) {
        const sql =
          `SELECT pettylogdate, IFNULL(pettylogamount, 0) AS pettylogamount
           FROM pettylogstbl
           WHERE DATE(pettylogdate) >= DATE(?)
             AND DATE(pettylogdate) <= DATE(?)
           ORDER BY pettylogdate DESC
           LIMIT 50`;

        return {
          intentKey: 'petty_cash_period_entries',
          confidence: rangeFromQuestion ? 0.88 : 0.82,
          sqlUsed: sql,
          params: [range.start, range.end],
          html: `
            <div>
              <strong>Petty Cash Entries</strong><br/>
              Period: ${this.escapeHtml(range.label)}<br/>
            </div>
          `,
        };
      }

      const sql =
        `SELECT COUNT(*) AS entries_count, IFNULL(SUM(pettylogamount), 0) AS total_amount
         FROM pettylogstbl
         WHERE DATE(pettylogdate) >= DATE(?)
           AND DATE(pettylogdate) <= DATE(?)`;

      return {
        intentKey: 'petty_cash_period_total',
        confidence: rangeFromQuestion ? 0.9 : 0.84,
        sqlUsed: sql,
        params: [range.start, range.end],
        html: `
          <div>
            <strong>Petty Cash Summary</strong><br/>
            Period: ${this.escapeHtml(range.label)}<br/>
          </div>
        `,
      };
    }

    // 1d) PERSONNEL: activity for a period
    if (/\bpersonnel\b|\bstaff\b|\bdelivery\b/i.test(q)) {
      const range = rangeOrToday;
      const sql =
        `SELECT IFNULL(dtdelby, 'UNASSIGNED') AS personnel, COUNT(*) AS transaction_count, IFNULL(SUM(dsalary), 0) AS salary_total
         FROM deltransacttbl
         WHERE DATE(dtdate) >= DATE(?)
           AND DATE(dtdate) <= DATE(?)
         GROUP BY dtdelby
         ORDER BY transaction_count DESC
         LIMIT 20`;

      return {
        intentKey: 'personnel_period_activity',
        confidence: rangeFromQuestion ? 0.9 : 0.84,
        sqlUsed: sql,
        params: [range.start, range.end],
        html: `
          <div>
            <strong>Personnel Activity</strong><br/>
            Period: ${this.escapeHtml(range.label)}<br/>
          </div>
        `,
      };
    }

    // 2) CUSTOMER: balance lookup by name (for users who type "balance of Juan")
    const customerName = this.extractCustomerNameFromBalanceQuestion(q);
    if (customerName && customerName.length >= 2) {
      const sql =
        "SELECT custname, IFNULL(custbalance, 0) AS custbalance FROM custinfo WHERE lower(custname) LIKE '%' || lower(?) || '%' ORDER BY custbalance DESC LIMIT 10";

      return {
        intentKey: 'customer_balance_by_name',
        confidence: 0.9,
        sqlUsed: sql,
        params: [customerName],
        html: `
          <div>
            <strong>Customer Balance</strong><br/>
            Match: ${this.escapeHtml(customerName)}<br/>
          </div>
        `,
      };
    }

    if (/\b(customer\s+balance|balance)\b/i.test(q)) {
      return {
        intentKey: 'clarify_customer_balance_name',
        confidence: 0.62,
        sqlUsed: '',
        params: [],
        html: this.withSuggestion(
          `
            <div>
              <strong>Which customer?</strong><br/>
              Example: <strong>"balance of Juan"</strong> or <strong>"customer balance for Maria"</strong>
            </div>
          `,
          'You can also ask: "customers with balance" to see the top list.'
        ),
      };
    }

    // 3) INVENTORY: item lookup ("stock of LPG11KG", "inventory item ABC")
    // Guard: don't let "low stock items" accidentally route to inventory lookup.
    if (/\blow\s+stock\b/i.test(q) || /\bcritical\s+stock\b/i.test(q) || /\breorder\b/i.test(q)) {
      return null;
    }

    const stockOnly =
      /^\s*(stock|inventory|qty|quantity|available|availability|on[\s-]?hand)\s*$/i.test(q) ||
      /^\s*(stock|inventory|qty|quantity|available|availability|on[\s-]?hand)\s+(?:of|for|ng)\s*$/i.test(q);
    if (stockOnly) {
      return {
        intentKey: 'clarify_inventory_lookup_term',
        confidence: 0.66,
        sqlUsed: '',
        params: [],
        html: this.withSuggestion(
          `
            <div>
              <strong>Which item?</strong><br/>
              Ask using an item code or item name.<br/>
              Example: <strong>"stock of A"</strong> or <strong>"stock of regulator"</strong>
            </div>
          `,
          'You can also ask: "low stock items" for the alert list.'
        ),
      };
    }

    const inventoryPatterns: RegExp[] = [
      /\b(?:stock|inventory|qty|quantity|on[\s-]?hand|available|availability)\s+(?:of|for|ng)?\s*([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
      /\b([a-z0-9][a-z0-9\s\-_/]{1,60})\s+(?:stock|inventory|qty|quantity|available|on[\s-]?hand)\b/i,
      /\b(?:do\s+we\s+have|check|find|search|may|meron(?:\s+bang)?|available\s+ba(?:\s+ang|\s+si|\s+yung)?)\s+(?:stock\s+(?:of|for|ng)\s+)?([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
      /\bitem(?:\s*code)?\s*[:\-]?\s*([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
    ];

    const invMatch = inventoryPatterns
      .map((pattern) => q.match(pattern))
      .find((match) => !!match);

    if (invMatch) {
      const term = (invMatch[1] ?? '').trim();
      const normalizedTerm = term.toLowerCase();
      const genericTerms = new Set([
        'item',
        'items',
        'product',
        'products',
        'stock',
        'inventory',
        'qty',
        'quantity',
        'available',
        'availability',
        'on hand',
        'onhand',
      ]);

      const cleanedTerm = term
        .replace(/\b(please|pls|po|lang|naman|nga)\b/gi, '')
        .replace(/\b(today|this\s+month|last\s+month|this\s+year|last\s+year)\b/gi, '')
        .replace(/^(?:ba\s+)?(?:ng|ang|si|yung|yong)\s+/i, '')
        .replace(/^ba\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      const cleanedNormalizedTerm = cleanedTerm.toLowerCase();

      if (cleanedTerm.length >= 2 && !genericTerms.has(cleanedNormalizedTerm)) {
        const sql =
          "SELECT itemcode, itemname, IFNULL(fillqty, 0) AS fillqty, IFNULL(alertnum, 0) AS alertnum FROM inventorytbl WHERE lower(itemcode) LIKE '%' || lower(?) || '%' OR lower(itemname) LIKE '%' || lower(?) || '%' ORDER BY itemname ASC LIMIT 20";

        return {
          intentKey: 'inventory_item_lookup',
          confidence: 0.88,
          sqlUsed: sql,
          params: [cleanedTerm, cleanedTerm],
          html: `
            <div>
              <strong>Inventory Lookup</strong><br/>
              Match: ${this.escapeHtml(cleanedTerm)}<br/>
            </div>
          `,
        };
      }

      // Term is too generic; ask user for a specific item.
      return {
        intentKey: 'clarify_inventory_lookup_term',
        confidence: 0.62,
        sqlUsed: '',
        params: [],
        html: this.withSuggestion(
          `
            <div>
              <strong>Which item?</strong><br/>
              Please include an item code or item name.<br/>
              Example: <strong>"stock of A"</strong> or <strong>"inventory of BGAS"</strong>
            </div>
          `,
          'Try: "stock of <item code>" or "stock of <item name>".'
        ),
      };
    }

    return null;
  }

  private renderDynamicAnswer(
    intentKey: string,
    rows: Record<string, unknown>[],
    headerHtml: string
  ): string {
    if (intentKey === 'sales_period_total') {
      const row = rows[0] ?? {};
      const salesCount = Number(row['sales_count'] ?? 0);
      const totalAmount = Number(row['total_amount'] ?? 0);

      return this.withSuggestion(
        `
          ${headerHtml}
          <div>
            Transactions: ${salesCount}<br/>
            Total Amount: ${this.formatCurrency(totalAmount)}
          </div>
        `,
        'Try: "unpaid sales this month" or "customer balance for Juan".'
      );
    }

    if (intentKey === 'sales_unpaid_period_total') {
      const row = rows[0] ?? {};
      const salesCount = Number(row['sales_count'] ?? 0);
      const totalBalance = Number(row['total_balance'] ?? 0);

      return this.withSuggestion(
        `
          ${headerHtml}
          <div>
            Unpaid Transactions: ${salesCount}<br/>
            Total Outstanding: ${this.formatCurrency(totalBalance)}
          </div>
        `,
        'Open Sales details to collect payment or reprint receipt.'
      );
    }

    if (intentKey === 'items_sold_period_total') {
      const row = rows[0] ?? {};
      const totalQty = Number(row['total_qty'] ?? 0);

      return this.withSuggestion(
        `
          ${headerHtml}
          <div>
            Total Quantity Sold: ${this.escapeHtml(String(totalQty))}
          </div>
        `,
        'Try: "top items sold this month" or "items sold from 2026-01-01 to 2026-01-31".'
      );
    }

    if (intentKey === 'customer_balance_by_name') {
      return this.withSuggestion(
        this.renderCustomerBalanceList(rows),
        'If the name is wrong, try a shorter keyword (example: "balance of juan").'
      );
    }

    if (intentKey === 'inventory_item_lookup') {
      if (!rows.length) {
        return this.withSuggestion(
          `
            ${headerHtml}
            <div>
              No items matched that keyword.
            </div>
          `,
          'Try using an item code (example: "stock of A") or a shorter name keyword.'
        );
      }

      return this.withSuggestion(
        this.renderInventoryLookupList(rows),
        'Try: "low stock items" or "stock of <item code>".'
      );
    }

    if (intentKey === 'sales_top_items_period') {
      if (!rows.length) {
        return this.withSuggestion(
          `
            ${headerHtml}
            <div>No items found for that period.</div>
          `,
          'Try: "top items sold last month" or "top items sold January 2026".'
        );
      }

      return this.withSuggestion(
        this.renderTableAnswer(
          'Top Items Sold',
          rows,
          ['scitemcode', 'scitemdesc', 'quantity'],
          ['Item Code', 'Item Name', 'Qty']
        ),
        'Try: "sales of LPG11KG this month" or "items sold January 2026".'
      );
    }

    if (intentKey === 'sales_item_qty_period') {
      if (!rows.length) {
        return this.withSuggestion(
          `
            ${headerHtml}
            <div>No item sales matched for that period.</div>
          `,
          'Try a shorter item keyword or a different date range.'
        );
      }

      return this.withSuggestion(
        this.renderTableAnswer(
          'Item Sales (Quantity)',
          rows,
          ['scitemcode', 'scitemdesc', 'quantity'],
          ['Item Code', 'Item Name', 'Qty']
        ),
        'Tip: add a date range (example: "from 2026-01-01 to 2026-01-31").'
      );
    }

    if (intentKey === 'transfers_period_summary') {
      const row = rows[0] ?? {};
      const transferCount = Number(row['transfer_count'] ?? 0);
      const totalQty = Number(row['total_qty'] ?? 0);

      return this.withSuggestion(
        `
          ${headerHtml}
          <div>
            Transfers: ${transferCount}<br/>
            Total Qty: ${totalQty}
          </div>
        `,
        'Try: "transfers this month" or "transfer summary January 2026".'
      );
    }

    if (intentKey === 'transfers_period_list') {
      return this.withSuggestion(
        this.renderTableAnswer(
          'Transfers',
          rows,
          ['poutrefnum', 'pullsupplier', 'pouttype', 'pouttotalqty', 'pulloutremarks', 'pulldate'],
          ['Reference', 'Transfer To', 'Type', 'Qty', 'Status', 'Date']
        ),
        'Say "transfer summary" if you only want totals.'
      );
    }

    if (intentKey === 'petty_cash_period_total') {
      const row = rows[0] ?? {};
      const entriesCount = Number(row['entries_count'] ?? 0);
      const totalAmount = Number(row['total_amount'] ?? 0);

      return this.withSuggestion(
        `
          ${headerHtml}
          <div>
            Entries: ${entriesCount}<br/>
            Total Amount: ${this.formatCurrency(totalAmount)}
          </div>
        `,
        'Try: "list petty cash entries this month".'
      );
    }

    if (intentKey === 'petty_cash_period_entries') {
      return this.withSuggestion(
        this.renderTableAnswer(
          'Petty Cash Entries',
          rows,
          ['pettylogdate', 'pettylogamount'],
          ['Date', 'Amount']
        ),
        'Try: "petty cash this month" for totals.'
      );
    }

    if (intentKey === 'personnel_period_activity') {
      return this.withSuggestion(
        this.renderTableAnswer(
          'Personnel Activity',
          rows,
          ['personnel', 'transaction_count', 'salary_total'],
          ['Personnel', 'Transactions', 'Salary Total']
        ),
        'Try: "personnel activity this month" or "delivery today".'
      );
    }

    return headerHtml;
  }

  private renderCustomerBalanceList(rows: Record<string, unknown>[]): string {
    if (!rows.length) {
      return `<div><strong>Customer Balance Results</strong><br/>No data found.</div>`;
    }

    const items = rows
      .map((row) => {
        const name = String(row['custname'] ?? '').trim();
        const balance = Number(row['custbalance'] ?? 0);
        const balanceText = this.formatCurrency(balance);

        return `
          <div class="ai-kv-row">
            <div class="ai-kv-key">${this.escapeHtml(name || 'Unknown')}</div>
            <div class="ai-kv-val">${this.escapeHtml(balanceText)}</div>
          </div>
        `;
      })
      .join('');

    return `
      <div>
        <strong>Customer Balance Results</strong>
        <div class="ai-kv-list">${items}</div>
      </div>
    `;
  }

  private parseMonthYearToRange(monthToken: string, year: number): DateRange | null {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return null;
    }

    const monthIndex = this.monthTokenToIndex(monthToken);
    if (monthIndex === null) {
      return null;
    }

    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0));

    const startStr = this.toIsoDate(start);
    const endStr = this.toIsoDate(end);

    const label = `${this.monthIndexToName(monthIndex)} ${year} (${startStr} to ${endStr})`;

    return { start: startStr, end: endStr, label };
  }

  private parseDateRangeFromQuestion(question: string): DateRange | null {
    const q = question.toLowerCase();
    const today = new Date();

    // Support "2026-01" and "01/2026" for month-level queries.
    const yyyyMm = q.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
    if (yyyyMm) {
      const year = Number(yyyyMm[1]);
      const monthIndex = Number(yyyyMm[2]) - 1;
      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0));
      const startStr = this.toIsoDate(start);
      const endStr = this.toIsoDate(end);
      return {
        start: startStr,
        end: endStr,
        label: `${this.monthIndexToName(monthIndex)} ${year} (${startStr} to ${endStr})`,
      };
    }

    const mmYyyy = q.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/);
    if (mmYyyy) {
      const monthIndex = Number(mmYyyy[1]) - 1;
      const year = Number(mmYyyy[2]);
      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0));
      const startStr = this.toIsoDate(start);
      const endStr = this.toIsoDate(end);
      return {
        start: startStr,
        end: endStr,
        label: `${this.monthIndexToName(monthIndex)} ${year} (${startStr} to ${endStr})`,
      };
    }

    const isoRange = q.match(
      /\b(?:from|between)\s+(20\d{2}-\d{2}-\d{2})\s+(?:to|and)\s+(20\d{2}-\d{2}-\d{2})\b/
    );
    if (isoRange) {
      const start = isoRange[1];
      const end = isoRange[2];
      return { start, end, label: `${start} to ${end}` };
    }

    const singleIso = q.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (singleIso) {
      const d = singleIso[1];
      return { start: d, end: d, label: d };
    }

    if (/\btoday\b/.test(q)) {
      const d = this.toIsoDate(today);
      return { start: d, end: d, label: `Today (${d})` };
    }

    if (/\byesterday\b/.test(q)) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      const iso = this.toIsoDate(d);
      return { start: iso, end: iso, label: `Yesterday (${iso})` };
    }

    if (/\bthis\s+month\b/.test(q)) {
      const year = today.getFullYear();
      const month = today.getMonth();
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0));
      const startStr = this.toIsoDate(start);
      const endStr = this.toIsoDate(end);
      return {
        start: startStr,
        end: endStr,
        label: `${this.monthIndexToName(month)} ${year} (${startStr} to ${endStr})`,
      };
    }

    if (/\blast\s+month\b/.test(q)) {
      const year = today.getFullYear();
      const month = today.getMonth() - 1;
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0));
      const startStr = this.toIsoDate(start);
      const endStr = this.toIsoDate(end);
      const labelMonth = start.getUTCMonth();
      const labelYear = start.getUTCFullYear();
      return {
        start: startStr,
        end: endStr,
        label: `${this.monthIndexToName(labelMonth)} ${labelYear} (${startStr} to ${endStr})`,
      };
    }

    // Month + year anywhere in question
    const monthYear = q.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d{2})\b/);
    if (monthYear) {
      return this.parseMonthYearToRange(monthYear[1], Number(monthYear[2]));
    }

    return null;
  }

  private containsMonthToken(question: string): boolean {
    return /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(
      question
    );
  }

  private extractCustomerNameFromBalanceQuestion(question: string): string | null {
    const q = question.trim();

    // "balance of Juan", "customer balance for Maria"
    const m1 = q.match(/\b(?:customer\s+balance|balance)\s+(?:of|for)\s+(.+)\b/i);
    if (m1) {
      return m1[1].trim();
    }

    // "Juan balance", "Maria customer balance"
    const m2 = q.match(/\b(.+?)\s+(?:customer\s+balance|balance)\b/i);
    if (m2) {
      const candidate = m2[1].trim();
      if (candidate.length >= 2 && !/\b(total|show|list|top)\b/i.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private monthTokenToIndex(token: string): number | null {
    const normalized = token.toLowerCase().slice(0, 3);
    const map: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    return Object.prototype.hasOwnProperty.call(map, normalized)
      ? map[normalized]
      : null;
  }

  private monthIndexToName(index: number): string {
    const names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return names[index] ?? 'Unknown';
  }

  private toIsoDate(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private async getIntent(intentKey: string): Promise<AiIntentRow | null> {
    const rows = await this.sqliteService.query<AiIntentRow>(
      `SELECT intent_key, description, sql_template
       FROM ai_intent
       WHERE intent_key = ? AND is_active = 1
       LIMIT 1`,
      [intentKey]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  private resolveIntentParams(intentKey: string, context: QueryContext): unknown[] {
    const todayParamIntents = new Set([
      'sales_today_total',
      'unpaid_sales_today',
      'petty_cash_total_today',
      'transfers_today',
      'personnel_activity_today',
    ]);

    if (todayParamIntents.has(intentKey)) {
      return [context.today];
    }

    return [];
  }

  private async validateReadOnlySql(sql: string): Promise<void> {
    const normalized = sql.trim().toLowerCase();
    const denied = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create'];
    if (!normalized.startsWith('select')) {
      throw new Error('Only SELECT statements are allowed for AI queries.');
    }

    for (const keyword of denied) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)) {
        throw new Error(`Unsafe SQL keyword detected: ${keyword}`);
      }
    }

    const tableMatches = [
      ...normalized.matchAll(/\bfrom\s+([a-zA-Z0-9_]+)/gi),
      ...normalized.matchAll(/\bjoin\s+([a-zA-Z0-9_]+)/gi),
    ];
    const tables = Array.from(
      new Set(tableMatches.map((match) => match[1]).filter(Boolean))
    );

    for (const tableName of tables) {
      const allowed = await this.sqliteService.query<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM ai_sql_guardrail
         WHERE lower(table_name) = lower(?) AND can_read = 1`,
        [tableName]
      );

      if ((allowed[0]?.count ?? 0) === 0) {
        throw new Error(`Table not allowed by AI guardrail: ${tableName}`);
      }
    }
  }

  private renderIntentAnswer(intentKey: string, rows: Record<string, unknown>[]): string {
    switch (intentKey) {
      case 'sales_today_total':
        return this.withSuggestion(
          this.renderSalesToday(rows),
          'Try: "Show unpaid sales today" for pending collections.'
        );
      case 'petty_cash_total_today':
        return this.withSuggestion(
          this.renderPettyCashToday(rows),
          'Try: "Show petty cash entries today" if you need line-by-line details.'
        );
      case 'low_stock_items':
        if (!rows.length) {
          return this.withSuggestion(
            `
              <div>
                <strong>Low Stock Items</strong><br/>
                No items matched the low-stock rule.<br/>
                <div style="margin-top:6px;">
                  Low stock is detected when <strong>fillqty &lt;= alertnum</strong> and <strong>alertnum &gt; 0</strong>.
                </div>
              </div>
            `,
            'Set an alert threshold in Inventory (Alert/Min) then try again.'
          );
        }

        return this.withSuggestion(
          this.renderLowStockList('Low Stock Items', rows),
          'Tap an item in Dashboard low-stock list to create a transfer/restock action.'
        );
      case 'unpaid_sales_today':
        return this.withSuggestion(
          this.renderTableAnswer(
            'Unpaid Sales Today',
            rows,
            ['salesrefnum', 'salescust', 'tenderbalance', 'salesdate'],
            ['Reference', 'Customer', 'Balance', 'Date']
          ),
          'Open Sales details to receive balance payment or reprint receipt.'
        );
      case 'customer_balance_top':
        return this.withSuggestion(
          this.renderTableAnswer(
            'Top Customers With Balance',
            rows,
            ['custname', 'custbalance'],
            ['Customer', 'Balance']
          ),
          'Try: "Show unpaid sales today" to see which references are still open.'
        );
      case 'transfers_today':
        return this.withSuggestion(
          this.renderTableAnswer(
            'Transfers Today',
            rows,
            ['poutrefnum', 'pullsupplier', 'pouttype', 'pouttotalqty', 'pulloutremarks', 'pulldate'],
            ['Reference', 'Transfer To', 'Type', 'Qty', 'Status', 'Date']
          ),
          'Open Transfers module to confirm, review details, or cancel a transfer.'
        );
      case 'personnel_activity_today':
        return this.withSuggestion(
          this.renderTableAnswer(
            'Personnel Activity Today',
            rows,
            ['personnel', 'transaction_count', 'salary_total'],
            ['Personnel', 'Transactions', 'Salary Total']
          ),
          'Open Personnel > Transactions for detailed entries and salary history.'
        );
      default:
        return this.renderTableAnswer('Query Result', rows);
    }
  }

  private renderLowStockList(title: string, rows: Record<string, unknown>[]): string {
    if (!rows.length) {
      return `<div><strong>${this.escapeHtml(title)}</strong><br/>No data found.</div>`;
    }

    const items = rows
      .map((row) => {
        const itemCode = String(row['itemcode'] ?? '').trim();
        const itemName = String(row['itemname'] ?? '').trim();
        const fillQty = Number(row['fillqty'] ?? 0);
        const alertNum = Number(row['alertnum'] ?? 0);

        let severityClass = '';
        if (alertNum > 0 && fillQty <= 0) {
          severityClass = 'is-critical';
        } else if (alertNum > 0 && fillQty <= alertNum) {
          severityClass = 'is-low';
        }

        return `
          <div class="ai-lowstock-row ${severityClass}">
            <div class="ai-lowstock-main">
              <div class="ai-lowstock-name">${this.escapeHtml(itemCode)} - ${this.escapeHtml(itemName || 'Unknown item')}</div>
            </div>
            <div class="ai-lowstock-metrics">
              <span class="ai-pill ai-pill-stock">Stock ${this.escapeHtml(String(fillQty))}</span>
              <span class="ai-pill ai-pill-alert">Alert ${this.escapeHtml(String(alertNum))}</span>
            </div> 
              <div class="ai-lowstock-code">================</div>
          </div>
        `;
      })
      .join('');

    return `
      <div>
        <strong>${this.escapeHtml(title)}</strong>
        <div class="ai-lowstock-list">${items}</div>
      </div>
    `;
  }

  private renderInventoryLookupList(rows: Record<string, unknown>[]): string {
    if (!rows.length) {
      return `<div><strong>Inventory Results</strong><br/>No data found.</div>`;
    }

    const items = rows
      .map((row) => {
        const itemCode = String(row['itemcode'] ?? '').trim();
        const itemName = String(row['itemname'] ?? '').trim();
        const fillQty = Number(row['fillqty'] ?? 0);
        const alertNum = Number(row['alertnum'] ?? 0);
        const isLow = alertNum > 0 && fillQty <= alertNum;
        const statusLabel = isLow ? 'Low' : 'OK';
        const statusClass = isLow ? 'is-low' : 'is-ok';

        return `
          <div class="ai-inv-row ${statusClass}">
            <div class="ai-inv-main">
              <div class="ai-inv-code">${this.escapeHtml(itemCode || 'N/A')} - ${this.escapeHtml(itemName || 'Unknown item')}</div> 
            </div>
            <div class="ai-inv-metrics">
              <span class="ai-pill ai-pill-stock">Stock ${this.escapeHtml(String(fillQty))}</span>
              <span class="ai-pill ai-pill-alert">Alert ${this.escapeHtml(String(alertNum))}</span>
              <span class="ai-pill ai-pill-status">${this.escapeHtml(statusLabel)}</span>
            </div>
            <div class="ai-inv-name">==========</div>
          </div>
        `;
      })
      .join('');

    return `
      <div>
        <strong>Inventory Results</strong>
        <div class="ai-inv-list">${items}</div>
      </div>
    `;
  }

  private renderSalesToday(rows: Record<string, unknown>[]): string {
    const row = rows[0] ?? {};
    const salesCount = Number(row['sales_count'] ?? 0);
    const totalAmount = Number(row['total_amount'] ?? 0);

    return `
      <div>
        <strong>Sales Today</strong><br/>
        Transactions: ${salesCount}<br/>
        Total Amount: ${this.formatCurrency(totalAmount)}
      </div>
    `;
  }

  private renderPettyCashToday(rows: Record<string, unknown>[]): string {
    const row = rows[0] ?? {};
    const entriesCount = Number(row['entries_count'] ?? 0);
    const totalAmount = Number(row['total_amount'] ?? 0);

    return `
      <div>
        <strong>Petty Cash Today</strong><br/>
        Entries: ${entriesCount}<br/>
        Total Amount: ${this.formatCurrency(totalAmount)}
      </div>
    `;
  }

  private renderTableAnswer(
    title: string,
    rows: Record<string, unknown>[],
    columns?: string[],
    labels?: string[]
  ): string {
    if (!rows.length) {
      return `<div><strong>${this.escapeHtml(title)}</strong><br/>No data found.</div>`;
    }

    const tableColumns = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
    const tableLabels =
      labels && labels.length === tableColumns.length ? labels : tableColumns;

    const header = tableLabels
      .map((label) => `<th>${this.escapeHtml(label)}</th>`)
      .join('');

    const body = rows
      .map((row) => {
        const cells = tableColumns
          .map((column) => `<td>${this.escapeHtml(String(row[column] ?? ''))}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `
      <div>
        <strong>${this.escapeHtml(title)}</strong>
        <table class="ai-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  private async fallbackKnowledgeAnswer(question: string): Promise<string> {
    const likeQuery = `%${question.toLowerCase()}%`;

    try {
      const ftsRows = await this.sqliteService.query<{
        chunk_text: string;
      }>(
        `SELECT chunk_text
         FROM ai_chunk_fts
         WHERE ai_chunk_fts MATCH ?
         LIMIT 3`,
        [question]
      );

      if (ftsRows.length > 0) {
        return this.renderKnowledgeResponse(ftsRows.map((row) => row.chunk_text));
      }
    } catch (error) {
      // FTS may not be available; fallback below will cover retrieval.
      console.warn('FTS retrieval failed, using LIKE fallback.', error);
    }

    const rows = await this.sqliteService.query<{ chunk_text: string }>(
      `SELECT chunk_text
       FROM ai_chunk
       WHERE lower(chunk_text) LIKE ?
       ORDER BY token_count DESC
       LIMIT 3`,
      [likeQuery]
    );

    if (rows.length > 0) {
      return this.renderKnowledgeResponse(rows.map((row) => row.chunk_text));
    }

    return `
      <div>
        <strong>I could not match that request.</strong>
        <div style="margin-top:6px;">
          You can still ask anything, but I only answer from your local POS data and project rules.
        </div>
        <div style="margin-top:8px;font-size:12px;color:#4b5563;">
          <strong>Examples:</strong> "sales this month", "top items sold this month", "sales of LPG11KG January 2026", "petty cash this month", "transfer summary today", "balance of Juan"
        </div>
      </div>
    `;
  }

  private renderKnowledgeResponse(chunks: string[]): string {
    const list = chunks
      .map((chunk) => `<li>${this.escapeHtml(chunk)}</li>`)
      .join('');

    return `
      <div>
        <strong>Project Knowledge</strong>
        <ul>${list}</ul>
        <small>Ask a specific metric like "sales today" or "low stock items".</small>
      </div>
    `;
  }

  private withSuggestion(content: string, suggestion: string): string {
    return `
      ${content}
      <div style="margin-top:8px;font-size:12px;color:#4b5563;">
        <strong>Next:</strong> ${this.escapeHtml(suggestion)}
      </div>
    `;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async logQuery(log: {
    question: string;
    intentKey: string;
    sqlUsed: string;
    answerPreview: string;
    confidence: number;
    latencyMs: number;
  }): Promise<void> {
    try {
      await this.sqliteService.execute(
        `INSERT INTO ai_query_log
         (question, intent_key, sql_used, answer_preview, confidence, latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          log.question,
          log.intentKey,
          log.sqlUsed,
          log.answerPreview,
          log.confidence,
          log.latencyMs,
        ]
      );
    } catch (error) {
      console.warn('Failed to write ai_query_log:', error);
    }
  }
}
