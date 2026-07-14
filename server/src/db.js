import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'qc.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS specifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  parameter TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  min_value REAL,
  max_value REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (parameter, product_id)
);

CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  container TEXT NOT NULL DEFAULT '',
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch TEXT NOT NULL DEFAULT '',
  expiry_date TEXT NOT NULL DEFAULT '',
  line TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_analysis | approved | rejected
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  specification_id INTEGER NOT NULL REFERENCES specifications(id) ON DELETE CASCADE,
  value REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok', -- ok | out_of_spec
  notes TEXT NOT NULL DEFAULT '',
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  analyzed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER REFERENCES results(id) ON DELETE CASCADE,
  sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high', -- low | medium | high
  status TEXT NOT NULL DEFAULT 'open',   -- open | resolved
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS day_locks (
  day TEXT PRIMARY KEY,
  locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  locked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migration: add products.code to databases created before it existed
if (!db.prepare('PRAGMA table_info(products)').all().some((c) => c.name === 'code')) {
  db.exec("ALTER TABLE products ADD COLUMN code TEXT NOT NULL DEFAULT ''");
}
// Product code must be unique when set (empty = no code yet)
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code) WHERE code != ''");

// Migrations: add samples.container (container / package number) and expiry date
const sampleCols = db.prepare('PRAGMA table_info(samples)').all();
if (!sampleCols.some((c) => c.name === 'container')) {
  db.exec("ALTER TABLE samples ADD COLUMN container TEXT NOT NULL DEFAULT ''");
}
if (!sampleCols.some((c) => c.name === 'expiry_date')) {
  db.exec("ALTER TABLE samples ADD COLUMN expiry_date TEXT NOT NULL DEFAULT ''");
}
if (!sampleCols.some((c) => c.name === 'line')) {
  db.exec("ALTER TABLE samples ADD COLUMN line TEXT NOT NULL DEFAULT ''");
}

// Migration: corrective-action note on resolved alerts
if (!db.prepare('PRAGMA table_info(alerts)').all().some((c) => c.name === 'resolution_note')) {
  db.exec("ALTER TABLE alerts ADD COLUMN resolution_note TEXT NOT NULL DEFAULT ''");
}

// Seed an admin user on first run. Credentials come from ADMIN_USER /
// ADMIN_PASSWORD; without them a random password is generated and printed
// once to the console.
const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
if (!hasUsers) {
  const username = (process.env.ADMIN_USER || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(8).toString('base64url');
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    username,
    bcrypt.hashSync(password, 10),
    'admin'
  );
  console.log(`Usuario inicial creado -> ${username} / ${password}`);
  console.log('(apunta la contraseña o cámbiala desde la app tras entrar)');
}

export default db;
