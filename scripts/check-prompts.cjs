/* eslint-disable no-console */
const fs = require('fs');
const initSqlJs = require('sql.js');

function isoDateFromAny(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  // Most tables store timestamps; use the first 10 chars when it looks like YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function toIso(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthRange(iso) {
  const [y, m] = iso.split('-').map((x) => Number(x));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: toIso(start), end: toIso(end) };
}

function prevMonthRange(iso) {
  const [y, m] = iso.split('-').map((x) => Number(x));
  const start = new Date(Date.UTC(y, m - 2, 1));
  const end = new Date(Date.UTC(y, m - 1, 0));
  return { start: toIso(start), end: toIso(end) };
}

function extractInventoryTerm(prompt) {
  const q = String(prompt || '').trim();
  if (!q) return null;

  if (/\blow\s+stock\b/i.test(q) || /\bcritical\s+stock\b/i.test(q) || /\breorder\b/i.test(q)) {
    return null;
  }

  const patterns = [
    /\b(?:stock|inventory|qty|quantity|on[\s-]?hand|available|availability)\s+(?:of|for|ng)?\s*([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
    /\b([a-z0-9][a-z0-9\s\-_/]{1,60})\s+(?:stock|inventory|qty|quantity|available|on[\s-]?hand)\b/i,
    /\b(?:do\s+we\s+have|check|find|search|may|meron(?:\s+bang)?|available\s+ba(?:\s+ang|\s+si|\s+yung)?)\s+(?:stock\s+(?:of|for|ng)\s+)?([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
    /\bitem(?:\s*code)?\s*[:\-]?\s*([a-z0-9][a-z0-9\s\-_/]{1,60})\b/i,
  ];

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

  for (const pattern of patterns) {
    const m = q.match(pattern);
    if (!m || !m[1]) continue;

    const term = m[1]
      .replace(/\b(please|pls|po|lang|naman|nga)\b/gi, '')
      .replace(/\b(today|this\s+month|last\s+month|this\s+year|last\s+year)\b/gi, '')
      .replace(/^(?:ba\s+)?(?:ng|ang|si|yung|yong)\s+/i, '')
      .replace(/^ba\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (term.length < 2) continue;
    if (genericTerms.has(term.toLowerCase())) continue;
    return term;
  }

  return null;
}

async function main() {
  const dbPath = process.argv[2] || 'vmjampos-device.db';
  if (!fs.existsSync(dbPath)) {
    console.error(`DB file not found: ${dbPath}`);
    process.exit(2);
  }

  const buf = fs.readFileSync(dbPath);
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(buf));

  const hasTable = (name) => {
    const res = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=lower('${name}') LIMIT 1`
    );
    return res.length > 0 && res[0].values.length > 0;
  };

  const scalar = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let out = null;
    if (stmt.step()) out = stmt.get()[0];
    stmt.free();
    return out;
  };

  const runCount = (sql, params = []) => {
    const q = `SELECT COUNT(*) AS c FROM (${sql}) x`;
    return Number(scalar(q, params) ?? 0);
  };

  // Pick a stable "today" for testing based on DB data.
  let todayIso = null;
  if (hasTable('salescart')) {
    const maxScDate = scalar('SELECT MAX(scdate) FROM salescart');
    todayIso = isoDateFromAny(maxScDate);
  }
  if (!todayIso && hasTable('salestbl')) {
    const maxSalesDate = scalar('SELECT MAX(salesdate) FROM salestbl');
    todayIso = isoDateFromAny(maxSalesDate);
  }
  if (!todayIso) {
    // Fallback: use a fixed date so ranges are defined.
    todayIso = '2026-01-01';
  }

  const thisMonth = monthRange(todayIso);
  const lastMonth = prevMonthRange(todayIso);

  const inventorySample = hasTable('inventorytbl')
    ? db.exec(
        `SELECT itemcode FROM inventorytbl ORDER BY IFNULL(fillqty,0) ASC, itemcode ASC LIMIT 5`
      )[0]?.values?.map((v) => String(v[0]))
    : [];
  const invCode = inventorySample?.[0] || 'A';

  const custNameSample = hasTable('custinfo')
    ? db.exec(
        `SELECT custname FROM custinfo WHERE length(trim(IFNULL(custname,''))) > 0 ORDER BY IFNULL(custbalance,0) DESC LIMIT 1`
      )[0]?.values?.[0]?.[0]
    : null;

  console.log('DB:', dbPath);
  console.log('Derived today:', todayIso);
  console.log('Derived this month:', `${thisMonth.start}..${thisMonth.end}`);
  console.log('Derived last month:', `${lastMonth.start}..${lastMonth.end}`);
  console.log('');

  const tests = [
    {
      group: 'Inventory',
      prompt: `low stock items`,
      requires: ['inventorytbl'],
      sql: `SELECT itemcode, itemname, fillqty, alertnum
            FROM inventorytbl
            WHERE alertnum > 0 AND fillqty <= alertnum
            ORDER BY fillqty ASC
            LIMIT 20`,
      params: [],
    },
    {
      group: 'Inventory',
      prompt: `stock of ${invCode}`,
      requires: ['inventorytbl'],
      sql: `SELECT itemcode, itemname, IFNULL(fillqty,0) AS fillqty, IFNULL(alertnum,0) AS alertnum
            FROM inventorytbl
            WHERE lower(itemcode) LIKE '%' || lower(?) || '%' OR lower(itemname) LIKE '%' || lower(?) || '%'
            LIMIT 20`,
      params: [invCode, invCode],
    },
    {
      group: 'Sales',
      prompt: `sales today`,
      requires: ['salestbl'],
      sql: `SELECT salesrefnum FROM salestbl WHERE DATE(salesdate) = DATE(?) LIMIT 200`,
      params: [todayIso],
    },
    {
      group: 'Sales',
      prompt: `total sales this month`,
      requires: ['salestbl'],
      sql: `SELECT salesrefnum FROM salestbl WHERE DATE(salesdate) >= DATE(?) AND DATE(salesdate) <= DATE(?) LIMIT 200`,
      params: [thisMonth.start, thisMonth.end],
    },
    {
      group: 'Sales',
      prompt: `unpaid sales this month`,
      requires: ['salestbl'],
      sql: `SELECT salesrefnum FROM salestbl WHERE salestatus = 'UNPAID' AND DATE(salesdate) >= DATE(?) AND DATE(salesdate) <= DATE(?) LIMIT 200`,
      params: [thisMonth.start, thisMonth.end],
    },
    {
      group: 'Sales',
      prompt: `items sold this month`,
      requires: ['salescart', 'salestbl'],
      sql: `SELECT sc.scid
            FROM salescart sc
            INNER JOIN salestbl st
              ON st.salesrefnum = sc.screfnum
             AND st.salestatus <> 'CANCELLED'
            WHERE substr(sc.scdate, 1, 10) >= ?
              AND substr(sc.scdate, 1, 10) <= ?
              AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
            LIMIT 500`,
      params: [thisMonth.start, thisMonth.end],
    },
    {
      group: 'Sales',
      prompt: `top items sold last month`,
      requires: ['salescart', 'salestbl'],
      sql: `SELECT sc.scitemcode
            FROM salescart sc
            INNER JOIN salestbl st
              ON st.salesrefnum = sc.screfnum
             AND st.salestatus <> 'CANCELLED'
            WHERE substr(sc.scdate, 1, 10) >= ?
              AND substr(sc.scdate, 1, 10) <= ?
              AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
            GROUP BY sc.scitemcode
            LIMIT 50`,
      params: [lastMonth.start, lastMonth.end],
    },
    {
      group: 'Sales',
      prompt: `sales of X-C January 2026`,
      requires: ['salescart', 'salestbl'],
      sql: `SELECT sc.scitemcode
            FROM salescart sc
            INNER JOIN salestbl st
              ON st.salesrefnum = sc.screfnum
             AND st.salestatus <> 'CANCELLED'
            WHERE (lower(sc.scitemcode) LIKE '%' || lower(?) || '%' OR lower(sc.scitemdesc) LIKE '%' || lower(?) || '%')
              AND substr(sc.scdate, 1, 10) >= ?
              AND substr(sc.scdate, 1, 10) <= ?
              AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
            GROUP BY sc.scitemcode
            LIMIT 20`,
      params: ['X-C', 'X-C', '2026-01-01', '2026-01-31'],
    },
    {
      group: 'Customers',
      prompt: `customers with balance`,
      requires: ['custinfo'],
      sql: `SELECT custname FROM custinfo WHERE IFNULL(custbalance,0) > 0 LIMIT 20`,
      params: [],
    },
    {
      group: 'Customers',
      prompt: custNameSample ? `balance of ${custNameSample}` : 'balance of Juan',
      requires: ['custinfo'],
      sql: `SELECT custname FROM custinfo WHERE lower(custname) LIKE '%' || lower(?) || '%' LIMIT 10`,
      params: [custNameSample ? String(custNameSample) : 'Juan'],
    },
    {
      group: 'Petty cash',
      prompt: `petty cash today`,
      requires: ['pettylogstbl'],
      sql: `SELECT pettylogdate FROM pettylogstbl WHERE DATE(pettylogdate) = DATE(?) LIMIT 50`,
      params: [todayIso],
    },
    {
      group: 'Transfers',
      prompt: `transfers today`,
      requires: ['pouttbl'],
      sql: `SELECT poutrefnum FROM pouttbl WHERE DATE(pulldate) = DATE(?) LIMIT 50`,
      params: [todayIso],
    },
    {
      group: 'Personnel',
      prompt: `personnel activity today`,
      requires: ['deltransacttbl'],
      sql: `SELECT dtdelby FROM deltransacttbl WHERE DATE(dtdate) = DATE(?) LIMIT 50`,
      params: [todayIso],
    },
    {
      group: 'Help',
      prompt: `how do I reprint a receipt`,
      requires: [],
      sql: null,
      params: [],
    },
    {
      group: 'Help',
      prompt: `what can this project do`,
      requires: [],
      sql: null,
      params: [],
    },
  ];

  let currentGroup = '';
  for (const t of tests) {
    if (t.group !== currentGroup) {
      currentGroup = t.group;
      console.log(`== ${currentGroup} ==`);
    }

    const missing = (t.requires || []).filter((name) => !hasTable(name));
    if (missing.length) {
      console.log(`- ${t.prompt}: SKIP (missing tables: ${missing.join(', ')})`);
      continue;
    }

    if (!t.sql) {
      console.log(`- ${t.prompt}: STATIC (no DB query)`);
      continue;
    }

    const c = runCount(t.sql, t.params);
    console.log(`- ${t.prompt}: ${c > 0 ? 'OK' : 'EMPTY'} (${c})`);
  }

  console.log('');
  console.log('== Inventory prompt parsing ==');
  const inventoryPrompts = [
    `stock of ${invCode}`,
    `${invCode} stock`,
    `check ${invCode}`,
    `do we have ${invCode}`,
    `may stock ba ng ${invCode}`,
    `available ba ${invCode}`,
    `item code ${invCode}`,
  ];
  for (const prompt of inventoryPrompts) {
    const term = extractInventoryTerm(prompt);
    if (!term) {
      console.log(`- ${prompt}: NO_MATCH`);
      continue;
    }
    const c = runCount(
      `SELECT itemcode
       FROM inventorytbl
       WHERE lower(itemcode) LIKE '%' || lower(?) || '%'
          OR lower(itemname) LIKE '%' || lower(?) || '%'
       LIMIT 20`,
      [term, term]
    );
    console.log(`- ${prompt}: term="${term}" ${c > 0 ? 'OK' : 'EMPTY'} (${c})`);
  }

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
