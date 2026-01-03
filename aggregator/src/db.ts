import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'aggregator.db');

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

export async function initDb(): Promise<Database> {
  if (db) return db;

  SQL = await initSqlJs();

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS hourly_buckets (
      ts_hour TEXT PRIMARY KEY,
      extrinsics_count INTEGER DEFAULT 0,
      transfers_count INTEGER DEFAULT 0,
      active_wallets INTEGER DEFAULT 0,
      new_wallets INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS growth_24h (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computed_at TEXT NOT NULL,
      extrinsics_last24h INTEGER,
      extrinsics_prev24h INTEGER,
      extrinsics_growth_pct REAL,
      active_wallets_last24h INTEGER,
      active_wallets_prev24h INTEGER,
      active_wallets_growth_pct REAL,
      graph_nodes INTEGER,
      graph_edges INTEGER,
      graph_e_over_n REAL,
      new_wallets_ratio REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS top_entities (
      account TEXT PRIMARY KEY,
      degree_in INTEGER DEFAULT 0,
      degree_out INTEGER DEFAULT 0,
      weight_sum REAL DEFAULT 0,
      pagerank REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_first_seen (
      account TEXT PRIMARY KEY,
      first_seen_at TEXT NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_hourly_ts ON hourly_buckets(ts_hour)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_growth_computed ON growth_24h(computed_at)`);

  // Daily buckets for monthly sparklines
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_buckets (
      ts_day TEXT PRIMARY KEY,
      extrinsics_count INTEGER DEFAULT 0,
      transfers_count INTEGER DEFAULT 0,
      active_wallets INTEGER DEFAULT 0,
      new_wallets INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_daily_ts ON daily_buckets(ts_day)`);
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
