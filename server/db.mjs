import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR, IS_PROD, ensureDataDirs } from './config.mjs'

ensureDataDirs()
export { DATA_DIR }
export const DB_PATH = join(DATA_DIR, 'sultan.db')

export const db = new DatabaseSync(DB_PATH)
/* WAL + sincronización normal: aguanta reinicios sin corromper el archivo. */
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA synchronous = NORMAL;')
db.exec('PRAGMA busy_timeout = 5000;')

/** Verifica que el archivo no esté dañado antes de empezar a servir tráfico. */
export function integrityCheck() {
  const row = db.prepare('PRAGMA integrity_check').get()
  const result = row && Object.values(row)[0]
  return result === 'ok' ? { ok: true } : { ok: false, error: String(result ?? 'desconocido') }
}

/** Cierra el WAL dejando todo dentro del archivo .db (copias y despliegues). */
export function checkpoint() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
  } catch {
    /* si hay lectores activos se ignora: el WAL se fusiona al cerrar */
  }
}

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

export function appliedMigrations() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')) )')
  return new Set(db.prepare('SELECT id FROM schema_migrations').all().map((r) => r.id))
}

function hasTable(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)
}

const MAX_BACKUPS = Number(process.env.MAX_DB_BACKUPS || 5)

/**
 * Copia de seguridad antes de migrar. En producción se poda: un disco
 * persistente lleno por copias antiguas acaba tumbando la aplicación.
 */
function backupDatabase(tag) {
  if (!existsSync(DB_PATH)) return null
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const backupPath = `${DB_PATH}.bak-${stamp}-${tag}`
  try {
    checkpoint()
    copyFileSync(DB_PATH, backupPath)
    pruneBackups()
    return backupPath
  } catch (err) {
    console.warn('[db] no se pudo crear la copia de seguridad:', err.message)
    return null
  }
}

/** Conserva solo las MAX_BACKUPS copias más recientes. */
export function pruneBackups(keep = MAX_BACKUPS) {
  try {
    const files = readdirSync(DATA_DIR)
      .filter((f) => f.startsWith('sultan.db.bak-'))
      .sort()
    const excess = files.slice(0, Math.max(0, files.length - keep))
    for (const f of excess) {
      try { rmSync(join(DATA_DIR, f), { force: true }) } catch { /* ya no está */ }
    }
    return { removed: excess.length, kept: files.length - excess.length }
  } catch {
    return { removed: 0, kept: 0 }
  }
}

/** Copia manual de la base (descarga de seguridad o antes de un cambio grande). */
export function manualBackup(tag = 'manual') {
  const backupPath = backupDatabase(tag)
  if (!backupPath) return null
  return { path: backupPath, size: statSync(backupPath).size }
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
    id: 'm011_real_ratings',
    run: () => {
      /* products.rating y products.reviews eran columnas fijas sembradas con
         valores inventados (5.4 estrellas, 67 reseñas) que no tenían nada que
         ver con la tabla reviews. Mostraban miles de testimonios inexistentes.
         Se ponen a cero y el promedio se calcula siempre desde las reseñas
         reales y aprobadas. */
      db.exec('UPDATE products SET rating = 0, reviews = 0')
      if (!hasColumn('products', 'is_demo')) db.exec('ALTER TABLE products ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')
      /* El catálogo entero viene del seed de demostración hasta que se cargue
         el catálogo real, así que se marca como tal. */
      db.exec('UPDATE products SET is_demo = 1')
    },
  },
  {
    id: 'm010_demo_content',
    run: () => {
      /* Distingue el contenido inventado del contenido real.
         Lo sembrado para probar la tienda no puede publicarse como si fueran
         clientes reales, pero tampoco se borra: queda ahi, identificado y
         listo para vaciarse cuando el negocio tenga datos de verdad. */
      if (!hasColumn('reviews', 'is_demo')) db.exec('ALTER TABLE reviews ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')
      if (!hasColumn('orders', 'is_demo')) db.exec('ALTER TABLE orders ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')
      if (!hasColumn('coupons', 'is_demo')) db.exec('ALTER TABLE coupons ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')

      /* Reseñas del catálogo de demostración: personas que no existen. */
      db.prepare(`
        UPDATE reviews SET is_demo = 1
        WHERE product_id IS NULL
          AND name IN (
            'Juan David Ospina', 'Santiago Herrera', 'Mariana Botero',
            'Daniela Vargas', 'Mateo Restrepo'
          )
      `).run()

      /* Pedidos de prueba: direcciones y correos @demo.co. */
      db.prepare(`
        UPDATE orders SET is_demo = 1
        WHERE customer_email LIKE '%@demo.co' OR ship_address = 'Calle de demostración 123'
      `).run()

      /* Cupones de ejemplo. */
      db.prepare("UPDATE coupons SET is_demo = 1 WHERE code IN ('SULTAN10', 'SULTAN20', 'LUXE')").run()

      /* Todo lo marcado como demo se despublica de inmediato. */
      db.exec("UPDATE reviews SET status = 'rejected' WHERE is_demo = 1 AND status = 'approved'")

      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_demo ON reviews(is_demo, status)')
    },
  },
  {
    id: 'm009_admin_password_policy',
    run: () => {
      if (!hasColumn('admin_users', 'must_change_password')) {
        db.exec('ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0')
      }
      /* Las cuentas creadas con la contraseña de ejemplo quedan marcadas
         para obligar a cambiarla en el primer inicio de sesión. */
      db.prepare('UPDATE admin_users SET must_change_password = 1 WHERE username = ?').run('admin')
    },
  },
  {
    id: 'm008_reviews_product_status',
    run: () => {
      if (!hasColumn('reviews', 'product_id')) db.exec('ALTER TABLE reviews ADD COLUMN product_id TEXT')
      if (!hasColumn('reviews', 'status')) db.exec("ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'")
      if (!hasColumn('reviews', 'updated_at')) db.exec('ALTER TABLE reviews ADD COLUMN updated_at TEXT')
      /* reseñas ya publicadas siguen publicadas */
      db.exec("UPDATE reviews SET status = 'approved' WHERE status IS NULL OR status = ''")
      db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status)')
    },
  },
  {
    id: 'm007_coupon_limits',
    run: () => {
      if (!hasColumn('coupons', 'expires_at')) db.exec('ALTER TABLE coupons ADD COLUMN expires_at TEXT')
      if (!hasColumn('coupons', 'max_uses')) db.exec('ALTER TABLE coupons ADD COLUMN max_uses INTEGER')
      if (!hasColumn('coupons', 'used_count')) db.exec('ALTER TABLE coupons ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0')
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

/**
 * Las migraciones se ejecutan ordenadas por su número (m001, m002, …),
 * no por la posición en el array: varias dependen de columnas que crea
 * otra anterior, así que el orden tiene que ser estable aunque alguien
 * añada una migración nueva al final de la lista.
 */
const ORDERED_MIGRATIONS = [...MIGRATIONS].sort((a, b) => {
  const n = (id) => Number(String(id).slice(1, 4))
  return n(a.id) - n(b.id) || String(a.id).localeCompare(String(b.id))
})

export function runMigrations() {
  const applied = appliedMigrations()
  const pending = ORDERED_MIGRATIONS.filter((m) => !applied.has(m.id))
  const done = []
  let backup = null
  let failed = null

  if (pending.length > 0) {
    backup = backupDatabase(pending[0].id)
    for (const m of pending) {
      try {
        db.exec('BEGIN')
        m.run()
        db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id)
        db.exec('COMMIT')
        done.push(m.id)
      } catch (err) {
        try { db.exec('ROLLBACK') } catch { /* ya estaba en rollback */ }
        console.error(`[migración ${m.id}] falló:`, err.message)
        failed = { id: m.id, error: err.message }
        break
      }
    }
  }
  /* No se announces como aplicadas las migraciones que fallaron. */
  return { applied: done, failed, backup, pendingAfter: failed ? [failed.id] : [] }
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