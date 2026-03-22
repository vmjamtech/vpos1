CREATE TABLE IF NOT EXISTS ai_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT DEFAULT '',
  content TEXT NOT NULL,
  tags TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain, title, version)
);

CREATE TABLE IF NOT EXISTS ai_chunk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_id INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER DEFAULT 0,
  embedding_json TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (knowledge_id) REFERENCES ai_knowledge(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS ai_chunk_fts
USING fts5(chunk_id UNINDEXED, chunk_text, tags);

CREATE TABLE IF NOT EXISTS ai_intent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent_key TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  sql_template TEXT NOT NULL,
  allowed_roles TEXT DEFAULT 'ADMINISTRATOR',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_prompt_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  template TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_sql_guardrail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  can_read INTEGER DEFAULT 1,
  can_write INTEGER DEFAULT 0,
  UNIQUE(table_name, column_name)
);

CREATE TABLE IF NOT EXISTS ai_query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT DEFAULT '',
  question TEXT NOT NULL,
  intent_key TEXT DEFAULT '',
  sql_used TEXT DEFAULT '',
  answer_preview TEXT DEFAULT '',
  confidence REAL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  feedback_score INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
