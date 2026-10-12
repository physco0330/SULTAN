/**
 * Utilidades de operacion de la base de datos.
 *
 *   node scripts/db.mjs backup     copia manual con marca de tiempo
 *   node scripts/db.mjs check      integridad + estado del esquema
 *   node scripts/db.mjs prune      deja solo las MAX_DB_BACKUPS copias
 *   node scripts/db.mjs migrate    aplica migraciones pendientes
 */
import { join } from 'node:path'
import { DATA_DIR } from '../server/config.mjs'
import {
  db,
  DB_PATH,
  initDb,
  runMigrations,
  appliedMigrations,
  checkpoint,
  integrityCheck,
  manualBackup,
  pruneBackups,
} from '../server/db.mjs'

const fmtBytes = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`

function cmdCheck() {
  const integrity = integrityCheck()
  console.log(`archivo : ${DB_PATH}`)
  console.log(`integridad: ${integrity.ok ? 'OK' : `DANADO (${integrity.error})`}`)

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name)
  console.log(`tablas (${tables.length}): ${tables.join(', ')}`)

  const counts = {}
  for (const t of ['products', 'orders', 'order_items', 'customers', 'product_images', 'coupons', 'reviews', 'subscribers']) {
    if (tables.includes(t)) counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  }
  console.log('filas  :', JSON.stringify(counts))

  const applied = appliedMigrations()
  console.log(`migraciones aplicadas (${applied.size}): ${[...applied].join(', ')}`)

  const admins = db.prepare('SELECT username, must_change_password FROM admin_users').all()
  console.log('admins :', admins.map((a) => `${a.username}${a.must_change_password ? ' ( temporal )' : ''}`).join(', '))

  const free = db.prepare('PRAGMA page_count').get()
  const size = db.prepare('PRAGMA page_size').get()
  console.log(`tamaño aprox: ${fmtBytes(free.page_count * size.page_size)}`)
  console.log(`carpeta de datos: ${DATA_DIR}`)
  return integrity.ok ? 0 : 1
}

function cmdBackup() {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const info = manualBackup(`manual-${stamp}`)
  if (!info) {
    console.error('No se pudo crear la copia de seguridad.')
    return 1
  }
  console.log(`copia creada: ${info.path} (${fmtBytes(info.size)})`)
  return 0
}

function cmdPrune() {
  const r = pruneBackups()
  console.log(`copias eliminadas: ${r.removed} · conservadas: ${r.kept}`)
  return 0
}

function cmdMigrate() {
  initDb()
  const r = runMigrations()
  if (r.applied.length) console.log(`aplicadas: ${r.applied.join(', ')}`)
  else console.log('no hay migraciones pendientes')
  if (r.backup) console.log(`copia previa: ${r.backup}`)
  if (r.failed) {
    console.error(`fallo: ${r.failed.id} — ${r.failed.error}`)
    return 1
  }
  checkpoint()
  return 0
}

const cmd = process.argv[2] || 'check'
const handlers = { check: cmdCheck, backup: cmdBackup, prune: cmdPrune, migrate: cmdMigrate }
const fn = handlers[cmd]

if (!fn) {
  console.error(`Comando desconocido: ${cmd}`)
  console.error('Usos: check | backup | prune | migrate')
  process.exit(1)
}
process.exitCode = fn()