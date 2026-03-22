/* eslint-disable no-console */
const fs = require('fs');
const initSqlJs = require('sql.js');

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

  const scalar = (sql) => {
    const stmt = db.prepare(sql);
    let out = null;
    if (stmt.step()) out = stmt.get()[0];
    stmt.free();
    return out;
  };

  const requiredTables = ['inventorytbl', 'ai_intent', 'ai_sql_guardrail'];
  for (const t of requiredTables) {
    console.log(`table ${t}:`, hasTable(t) ? 'YES' : 'NO');
  }

  if (!hasTable('inventorytbl')) {
    console.log('inventorytbl is missing; cannot evaluate low-stock.');
    db.close();
    return;
  }

  const invCount = scalar('SELECT COUNT(*) FROM inventorytbl');
  const withAlert = scalar(
    'SELECT COUNT(*) FROM inventorytbl WHERE IFNULL(alertnum,0) > 0'
  );
  const lowCount = scalar(
    'SELECT COUNT(*) FROM inventorytbl WHERE IFNULL(alertnum,0) > 0 AND IFNULL(fillqty,0) <= IFNULL(alertnum,0)'
  );

  console.log('inventory rows:', invCount);
  console.log('items with alertnum>0:', withAlert);
  console.log('low stock rows (fillqty<=alertnum and alertnum>0):', lowCount);

  const lowSample = db.exec(
    `SELECT itemcode, itemname, IFNULL(fillqty,0) AS fillqty, IFNULL(alertnum,0) AS alertnum
     FROM inventorytbl
     WHERE IFNULL(alertnum,0) > 0 AND IFNULL(fillqty,0) <= IFNULL(alertnum,0)
     ORDER BY IFNULL(fillqty,0) ASC
     LIMIT 5`
  );
  const lowSampleCount = lowSample[0]?.values?.length ?? 0;
  console.log('low stock sample rows:', lowSampleCount);
  if (lowSampleCount > 0) {
    for (const row of lowSample[0].values) {
      console.log('  ', {
        itemcode: row[0],
        itemname: row[1],
        fillqty: row[2],
        alertnum: row[3],
      });
    }
  }

  if (hasTable('ai_intent')) {
    const intentRow = db.exec(
      "SELECT intent_key, sql_template, updated_at FROM ai_intent WHERE intent_key='low_stock_items' LIMIT 1"
    );
    if (intentRow.length && intentRow[0].values.length) {
      const [intentKey, sqlTemplate, updatedAt] = intentRow[0].values[0];
      console.log('ai_intent.low_stock_items.intent_key:', intentKey);
      console.log('ai_intent.low_stock_items.sql_template:', sqlTemplate);
      console.log('ai_intent.low_stock_items.updated_at:', updatedAt);
    } else {
      console.log('ai_intent.low_stock_items: missing');
    }
  }

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

