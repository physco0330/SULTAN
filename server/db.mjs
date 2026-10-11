import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })
export const DB_PATH = join(DATA_DIR, 'sultan.db')

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_es TEXT NOT NULL,
  label_tr TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  gender TEXT NOT NULL,
  collection TEXT NOT NULL,
  price REAL NOT NULL,
  compare_at_price REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  stock INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 4.5,
  reviews INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  is_limited INTEGER NOT NULL DEFAULT 0,
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  is_on_sale INTEGER NOT NULL DEFAULT 0,
  material TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  colors_json TEXT NOT NULL DEFAULT '[]',
  sizes_json TEXT NOT NULL DEFAULT '[]',
  images_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  ship_city TEXT,
  ship_country TEXT,
  ship_address TEXT,
  ship_zip TEXT,
  subtotal_usd REAL NOT NULL,
  shipping_usd REAL NOT NULL DEFAULT 0,
  discount_usd REAL NOT NULL DEFAULT 0,
  total_usd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  coupon_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_usd REAL NOT NULL,
  image TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  percent INTEGER NOT NULL,
  min_subtotal REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, position);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company);
`

export function initDb() {
  db.exec(SCHEMA)
}

/* ---------------- migraciones seguras ----------------
 * Cada migración es idempotente (se salta si ya se aplicó).
 * Antes de aplicar migraciones pendientes se crea una copia de
 * seguridad del archivo .db. No se eliminan datos ni columnas. */

function appliedMigrations() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')) )')
  return new Set(db.prepare('SELECT id FROM schema_migrations').all().map((r) => r.id))
}

function hasTable(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)
}

function backupDatabase(tag) {
  if (!existsSync(DB_PATH)) return null
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const backupPath = `${DB_PATH}.bak-${stamp}-${tag}`
  try {
    copyFileSync(DB_PATH, backupPath)
    return backupPath
  } catch {
    return null
  }
}

const MIGRATIONS = [
  {
    id: 'm001_orders_customer_id',
    run: () => {
      if (!hasColumn('orders', 'customer_id')) {
        db.exec('ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)')
      }
    },
  },
  {
    id: 'm002_customers_tracking',
    run: () => {
      if (!hasColumn('customers', 'document')) db.exec('ALTER TABLE customers ADD COLUMN document TEXT')
      if (!hasColumn('customers', 'address')) db.exec('ALTER TABLE customers ADD COLUMN address TEXT')
      if (!hasColumn('customers', 'first_order_at')) db.exec('ALTER TABLE customers ADD COLUMN first_order_at TEXT')
      if (!hasColumn('customers', 'last_order_at')) db.exec('ALTER TABLE customers ADD COLUMN last_order_at TEXT')
      if (!hasColumn('customers', 'total_spent')) db.exec('ALTER TABLE customers ADD COLUMN total_spent REAL NOT NULL DEFAULT 0')
    },
  },
  {
    id: 'm003_product_images',
    run: () => {
      db.exec(`CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        alt TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
      db.exec('CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, position)')
    },
  },
  {
    id: 'm006_product_quality',
    run: () => {
      if (!hasColumn('products', 'quality')) {
        db.exec("ALTER TABLE products ADD COLUMN quality TEXT NOT NULL DEFAULT 'turkish'")
      }
      db.exec("UPDATE products SET quality = 'turkish' WHERE quality IS NULL OR quality = ''")
      db.exec('CREATE INDEX IF NOT EXISTS idx_products_quality ON products(quality)')
    },
  },
  {
    id: 'm005_collections',
    run: () => {
      db.exec(`CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        label_es TEXT NOT NULL,
        label_en TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
    },
  },
  {
    id: 'm004_suppliers',
    run: () => {
      db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        tax_id TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        category TEXT,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
      db.exec('CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company)')
    },
  },
]

export function runMigrations() {
  const applied = appliedMigrations()
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id))
  let backup = null
  if (pending.length > 0) {
    backup = backupDatabase(pending[0].id)
    for (const m of pending) {
      try {
        db.exec('BEGIN')
        m.run()
        db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id)
        db.exec('COMMIT')
      } catch (err) {
        try { db.exec('ROLLBACK') } catch { /* ya estaba en rollback */ }
        console.error(`[migración ${m.id}] falló:`, err.message)
        break
      }
    }
  }
  return { applied: pending.map((m) => m.id), backup }
}

export function nowIso() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export function audit(username, action, entity, entityId, detail = '') {
  db.prepare('INSERT INTO audit_log (username, action, entity, entity_id, detail) VALUES (?,?,?,?,?)').run(
    username ?? 'system',
    action,
    entity,
    entityId ?? null,
    detail,
  )
}