/* eslint-disable no-console */
const fs = require('fs');
const initSqlJs = require('sql.js');

async function main() {
  const dbPath = process.argv[2] || 'vmjampos-device.db';
  const term = process.argv[3] || 'X-C';
  const start = process.argv[4] || '2026-01-01';
  const end = process.argv[5] || '2026-01-31';

  if (!fs.existsSync(dbPath)) {
    console.error(`DB file not found: ${dbPath}`);
    process.exit(2);
  }

  const buf = fs.readFileSync(dbPath);
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(buf));

  const hasSalescartRes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND lower(name)='salescart' LIMIT 1"
  );
  const hasSalescart = hasSalescartRes.length && hasSalescartRes[0].values.length;
  console.log('salescart table:', hasSalescart ? 'YES' : 'NO');

  const sql = `SELECT sc.scitemcode, sc.scitemdesc, IFNULL(SUM(sc.scqty), 0) AS quantity
    FROM salescart sc
    INNER JOIN salestbl st
      ON st.salesrefnum = sc.screfnum
     AND st.salestatus <> 'CANCELLED'
    WHERE (lower(sc.scitemcode) LIKE '%' || lower(?) || '%' OR lower(sc.scitemdesc) LIKE '%' || lower(?) || '%')
      AND DATE(sc.scdate) >= DATE(?)
      AND DATE(sc.scdate) <= DATE(?)
      AND upper(trim(IFNULL(sc.scstats, ''))) <> 'CANCELLED'
    GROUP BY sc.scitemcode, sc.scitemdesc
    ORDER BY IFNULL(SUM(sc.scqty), 0) DESC
    LIMIT 20`;

  const stmt = db.prepare(sql);
  stmt.bind([term, term, start, end]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  const maxDateRes = db.exec('SELECT MAX(scdate) AS max_scdate FROM salescart');
  const maxScDate = maxDateRes[0]?.values?.[0]?.[0] ?? null;

  console.log('db:', dbPath);
  console.log('term:', term);
  console.log('range:', `${start}..${end}`);
  console.log('rows:', rows.length);
  console.log('max scdate:', maxScDate);
  for (const r of rows.slice(0, 10)) console.log('  ', r);

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
