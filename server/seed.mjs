import { scryptSync, randomBytes } from 'node:crypto'
import { allocIds, col, db, nowIso } from './store/core.mjs'

process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning') return
  console.warn(w)
})

/* Solo configuración: sin productos, pedidos, reseñas ni clientes de prueba. */

const CATEGORIES = [
  ['shirts', 'Shirts', 'Camisas', 'Gömlekler'],
  ['tshirts', 'T-Shirts', 'Camisetas', 'Tişörtler'],
  ['trousers', 'Trousers', 'Pantalones', 'Pantolonlar'],
  ['jeans', 'Jeans', 'Jeans', 'Kot'],
  ['jackets', 'Jackets', 'Chaquetas', 'Ceketler'],
  ['coats', 'Coats', 'Abrigos', 'Montlar'],
  ['hoodies', 'Hoodies', 'Sudaderas', 'Kapüşonlular'],
  ['dresses', 'Dresses', 'Vestidos', 'Elbiseler'],
  ['skirts', 'Skirts', 'Faldas', 'Etekler'],
  ['sets', 'Sets', 'Conjuntos', 'Takımlar'],
  ['accessories', 'Accessories', 'Accesorios', 'Aksesuarlar'],
]

const COLLECTIONS = [
  ['new', 'Nueva colección', 'New collection'],
  ['premium', 'Premium', 'Premium'],
  ['limited', 'Edición limitada', 'Limited edition'],
  ['bestsellers', 'Más vendidos', 'Best sellers'],
  ['offers', 'Ofertas', 'Offers'],
]

const SETTINGS = {
  company_name: 'SULTAN BLACK',
  company_tagline: 'Where Turkish Craft Meets Modern Luxury',
  company_email: 'sales@sultanblack.com',
  company_phone: '+57 311 7317614',
  company_whatsapp: '+57 311 7317614',
  company_address: 'Bello Antioquia, Colombia',
  default_currency: 'COP',
  free_shipping_threshold: '300',
  flat_shipping: '15',
  express_shipping: '45',
  instagram_url: 'https://www.instagram.com/sultanblack_store',
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

/** Crea solo los documentos que falten; no pisa lo que ya haya configurado. */
async function seedMissing(name, rows, keyOf) {
  const refs = rows.map((r) => col(name).doc(keyOf(r)))
  const snaps = await db().getAll(...refs)
  const batch = db().batch()
  let created = 0
  snaps.forEach((s, i) => {
    if (s.exists) return
    batch.set(refs[i], rows[i])
    created += 1
  })
  if (created > 0) await batch.commit()
  return created
}

async function seedDefaults() {
  const now = nowIso()
  const counts = {
    categories: await seedMissing(
      'categories',
      CATEGORIES.map(([id, en, es, tr], i) => ({ id, label_en: en, label_es: es, label_tr: tr, sort: i })),
      (r) => r.id,
    ),
    collections: await seedMissing(
      'collections',
      COLLECTIONS.map(([id, es, en], i) => ({ id, label_es: es, label_en: en, sort: i, active: 1, created_at: now, updated_at: now })),
      (r) => r.id,
    ),
    settings: await seedMissing(
      'settings',
      Object.entries(SETTINGS).map(([key, value]) => ({ key, value, updated_at: now })),
      (r) => r.key,
    ),
  }
  console.log(`seed: valores por defecto (nuevos) · categorías ${counts.categories} · colecciones ${counts.collections} · ajustes ${counts.settings}`)
}

/**
 * Cuenta de arranque: solo si no existe NINGÚN administrador.
 * - Si se define SULTAN_ADMIN_PASSWORD se usa esa; si no, se genera una temporal
 *   que se muestra una vez por consola. Nace con must_change_password = 1.
 */
async function seedAdmin() {
  const any = await col('admin_users').limit(1).get()
  if (!any.empty) return

  const fromEnv = String(process.env.SULTAN_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '').trim()
  const generated = !fromEnv
  const password = fromEnv || randomBytes(12).toString('base64url')
  const salt = randomBytes(16).toString('hex')
  const [id] = await allocIds('admin_users')

  await col('admin_users').doc('admin').set({
    id,
    username: 'admin',
    name: 'Administrador',
    role: 'ADMIN',
    password_hash: hashPassword(password, salt),
    salt,
    created_at: nowIso(),
    must_change_password: 1,
  })

  if (generated) {
    console.log('seed: usuario admin creado.')
    console.log(`seed: CONTRASENA TEMPORAL (solo se muestra ahora): ${password}`)
    console.log('seed: cambiala al entrar al panel; no se guarda en ningún archivo.')
  } else {
    console.log('seed: usuario admin creado con SULTAN_ADMIN_PASSWORD (debe cambiarse al entrar).')
  }
}

export async function seedAll() {
  await seedDefaults()
  await seedAdmin()
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  await seedAll()
  console.log('seed: listo.')
  process.exit(0)
}
