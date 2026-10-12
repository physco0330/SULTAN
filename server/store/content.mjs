import {
  allocIds,
  cached,
  cmpStr,
  col,
  countOf,
  db,
  deleteRefs,
  docKey,
  getOne,
  invalidate,
  listAll,
  listWhere,
  nowIso,
  readCounter,
  StoreError,
  writeCounter,
} from './core.mjs'
import { findProductRef, invalidateCatalog } from './products.mjs'

const maxSort = (rows) => rows.reduce((m, r) => Math.max(m, Number(r.sort) || 0), 0)
const bySortId = (a, b) => (a.sort - b.sort) || cmpStr(a.id, b.id)

/** Actualiza un documento existente. Devuelve el documento resultante o null. */
async function patchDoc(name, id, fields) {
  const key = docKey(id)
  if (!key) return null
  const ref = col(name).doc(key)
  const snap = await ref.get()
  if (!snap.exists) return null
  await ref.update(fields)
  return { ...snap.data(), ...fields }
}

async function deleteDoc(name, id) {
  const key = docKey(id)
  if (key) await col(name).doc(key).delete()
}

/** Pone sort = posición en la lista recibida. Solo toca documentos que existen. */
async function reorder(name, ids, extra = {}) {
  const pairs = ids.map((id, index) => ({ key: docKey(id), index })).filter((p) => p.key)
  if (pairs.length === 0) return
  await db().runTransaction(async (tx) => {
    const snaps = await tx.getAll(...pairs.map((p) => col(name).doc(p.key)))
    snaps.forEach((s, i) => {
      if (s.exists) tx.update(s.ref, { sort: pairs[i].index, ...extra })
    })
  })
}

/* ---------------- ajustes de la tienda ---------------- */

export function loadSettings() {
  return cached('settings', async () => Object.fromEntries((await listAll('settings')).map((r) => [r.key, r.value])))
}

export async function getSetting(key, fallback = '') {
  const map = await loadSettings()
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback
}

export async function saveSettings(entries) {
  const now = nowIso()
  const batch = db().batch()
  for (const [key, value] of Object.entries(entries)) {
    batch.set(col('settings').doc(key), { key, value: String(value), updated_at: now }, { merge: true })
  }
  await batch.commit()
  invalidate('settings')
}

/* ---------------- categorías ---------------- */

export function listCategories() {
  return cached('categories', async () => (await listAll('categories')).sort(bySortId))
}

export const getCategory = (id) => getOne('categories', id)

export async function createCategory({ id, labelEs, labelEn }) {
  if (await getOne('categories', id)) throw new StoreError(409, 'Ya existe una categoría con ese identificador')
  const doc = {
    id,
    label_en: labelEn.slice(0, 60),
    label_es: labelEs.slice(0, 60),
    label_tr: labelEs.slice(0, 60),
    sort: maxSort(await listAll('categories')) + 1,
  }
  await col('categories').doc(id).set(doc)
  invalidate('categories')
  return doc
}

export async function patchCategory(id, fields) {
  const doc = await patchDoc('categories', id, fields)
  invalidate('categories')
  return doc
}

export async function deleteCategory(id) {
  await deleteDoc('categories', id)
  invalidate('categories')
}

export const categoryInUse = (id) => countOf('products', 'category', id)

export async function reorderCategories(ids) {
  await reorder('categories', ids)
  invalidate('categories')
}

/* ---------------- colecciones ---------------- */

export function listCollections() {
  return cached('collections', async () => (await listAll('collections')).sort(bySortId))
}

export const getCollection = (id) => getOne('collections', id)

export async function createCollection({ id, labelEs, labelEn, active }) {
  if (await getOne('collections', id)) throw new StoreError(409, 'Ya existe una colección con ese identificador')
  const now = nowIso()
  const doc = {
    id,
    label_es: labelEs.slice(0, 80),
    label_en: labelEn.slice(0, 80),
    sort: maxSort(await listAll('collections')) + 1,
    active: active ? 1 : 0,
    created_at: now,
    updated_at: now,
  }
  await col('collections').doc(id).set(doc)
  invalidate('collections')
  return doc
}

export async function patchCollection(id, fields) {
  const doc = await patchDoc('collections', id, { ...fields, updated_at: nowIso() })
  invalidate('collections')
  return doc
}

export async function deleteCollection(id) {
  await deleteDoc('collections', id)
  invalidate('collections')
}

export const collectionInUse = (id) => countOf('products', 'collection', id)

export async function reorderCollections(ids) {
  await reorder('collections', ids, { updated_at: nowIso() })
  invalidate('collections')
}

/* ---------------- cupones ---------------- */

/** Motivo por el que un cupón no sirve para este subtotal (null = válido). */
export function couponReason(c, subtotal) {
  if (!Number(c.active)) return 'inactive'
  if (c.expires_at && Date.parse(`${c.expires_at}T23:59:59Z`) < Date.now()) return 'expired'
  if (c.max_uses != null && c.used_count >= c.max_uses) return 'max_uses'
  if (subtotal < c.min_subtotal) return 'min_subtotal'
  return null
}

export const getCoupon = (code) => getOne('coupons', code)

export async function listCoupons() {
  return (await listAll('coupons')).sort((a, b) => cmpStr(b.created_at, a.created_at))
}

export async function upsertCoupon({ code, percent, minSubtotal, active }) {
  const existing = await getOne('coupons', code)
  const doc = existing
    ? { ...existing, percent, min_subtotal: minSubtotal, active: active ? 1 : 0 }
    : {
        code,
        percent,
        min_subtotal: minSubtotal,
        active: active ? 1 : 0,
        created_at: nowIso(),
        expires_at: null,
        max_uses: null,
        used_count: 0,
        is_demo: 0,
      }
  await col('coupons').doc(code).set(doc)
  return doc
}

export const patchCoupon = (code, fields) => patchDoc('coupons', code, fields)
export const deleteCoupon = (code) => deleteDoc('coupons', code)

/* ---------------- reseñas ---------------- */

/** Reseñas publicadas (aprobadas y nunca de demostración) y promedio real. */
export async function listPublicReviews(productRef) {
  const reviews = await listAll('reviews')
  const pid = productRef ? (await findProductRef(productRef))?.id ?? productRef : ''
  const visible = reviews.filter((r) => r.status === 'approved' && !r.is_demo && (!pid || r.product_id === pid))
  const items = visible.sort((a, b) => cmpStr(b.created_at, a.created_at) || b.id - a.id).slice(0, pid ? 100 : 50)
  const avg = visible.length ? visible.reduce((s, r) => s + Number(r.rating), 0) / visible.length : 0
  return { items, summary: { count: visible.length, average: avg ? Math.round(avg * 10) / 10 : 0 } }
}

export async function createPublicReview({ name, city, rating, comment, productId }) {
  const [id] = await allocIds('reviews')
  await col('reviews').doc(String(id)).set({
    id,
    name,
    city: city || null,
    rating,
    comment,
    product_id: productId || null,
    status: 'approved',
    is_demo: 0,
    created_at: nowIso(),
    updated_at: null,
  })
  invalidateCatalog()
}

export async function listAdminReviews({ status, q }) {
  const [reviews, products] = await Promise.all([listAll('reviews'), listAll('products')])
  const byId = new Map(products.map((p) => [p.id, p]))
  const counts = {}
  let demoCount = 0
  for (const r of reviews) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
    if (r.is_demo) demoCount += 1
  }
  let rows = reviews.map((r) => {
    const p = r.product_id ? byId.get(r.product_id) : null
    return { ...r, product_name: p?.name ?? null, product_slug: p?.slug ?? null }
  })
  if (status) rows = rows.filter((r) => r.status === status)
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.comment ?? '').toLowerCase().includes(q) ||
        (r.product_name ?? '').toLowerCase().includes(q),
    )
  }
  rows.sort((a, b) => cmpStr(b.created_at, a.created_at) || b.id - a.id)
  return { items: rows.slice(0, 300), counts, demoCount }
}

export async function createReview(r) {
  const [id] = await allocIds('reviews')
  const now = nowIso()
  const doc = {
    id,
    name: r.name,
    city: r.city,
    rating: r.rating,
    comment: r.comment,
    product_id: r.productId,
    status: r.status,
    is_demo: 0,
    created_at: now,
    updated_at: now,
  }
  await col('reviews').doc(String(id)).set(doc)
  invalidateCatalog()
  return doc
}

export async function updateReview(id, r) {
  const doc = await patchDoc('reviews', id, {
    name: r.name,
    city: r.city,
    rating: r.rating,
    comment: r.comment,
    product_id: r.productId,
    status: r.status,
    updated_at: nowIso(),
  })
  invalidateCatalog()
  return doc
}

export async function moderateReview(id, status) {
  const doc = await patchDoc('reviews', id, { status, updated_at: nowIso() })
  invalidateCatalog()
  return doc
}

export const getReview = (id) => getOne('reviews', id)

export async function deleteReview(id) {
  await deleteDoc('reviews', id)
  invalidateCatalog()
}

export const countRealReviews = () => countOf('reviews', 'is_demo', 0)

export async function purgeDemoReviews() {
  const demo = await listWhere('reviews', 'is_demo', 1)
  await deleteRefs(demo.map((r) => col('reviews').doc(String(r.id))))
  invalidateCatalog()
  return demo.length
}

/* ---------------- contactos y suscriptores ---------------- */

export async function createContact({ name, email, subject, message }) {
  const [id] = await allocIds('contacts')
  await col('contacts').doc(String(id)).set({
    id,
    name,
    email,
    subject: subject || null,
    message,
    created_at: nowIso(),
  })
}

export async function listContacts() {
  return (await listAll('contacts')).sort((a, b) => cmpStr(b.created_at, a.created_at) || b.id - a.id)
}

export const deleteContact = (id) => deleteDoc('contacts', id)

/** Alta de suscriptor sin duplicados (equivale a INSERT OR IGNORE). */
export async function addSubscriber(email) {
  await db().runTransaction(async (tx) => {
    const dup = await tx.get(col('subscribers').where('email', '==', email).limit(1))
    if (!dup.empty) return
    const last = await readCounter(tx, 'subscribers')
    tx.set(col('subscribers').doc(String(last + 1)), { id: last + 1, email, created_at: nowIso() })
    writeCounter(tx, 'subscribers', last + 1)
  })
}

export async function listSubscribers() {
  return (await listAll('subscribers')).sort((a, b) => cmpStr(b.created_at, a.created_at) || b.id - a.id)
}

export const deleteSubscriber = (id) => deleteDoc('subscribers', id)

/* ---------------- proveedores ---------------- */

export async function listSuppliers(q) {
  let rows = await listAll('suppliers')
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.company ?? '').toLowerCase().includes(q) ||
        (r.tax_id ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q),
    )
  }
  return rows.sort((a, b) => cmpStr(a.company, b.company))
}

export const getSupplier = (id) => getOne('suppliers', id)

export async function createSupplier(b) {
  const [id] = await allocIds('suppliers')
  const now = nowIso()
  const doc = { id, ...supplierFields(b), created_at: now, updated_at: now }
  await col('suppliers').doc(String(id)).set(doc)
  return doc
}

export const updateSupplier = (id, b) => patchDoc('suppliers', id, { ...supplierFields(b), updated_at: nowIso() })

export const patchSupplier = (id, active) => patchDoc('suppliers', id, { active: active ? 1 : 0, updated_at: nowIso() })

export const deleteSupplier = (id) => deleteDoc('suppliers', id)

function supplierFields(b) {
  return {
    company: b.company,
    tax_id: b.taxId,
    phone: b.phone,
    email: b.email,
    address: b.address,
    category: b.category,
    notes: b.notes,
    active: b.active ? 1 : 0,
  }
}

/* ---------------- cuentas de administración ---------------- */

export const getAdminUser = (username) => getOne('admin_users', username)

export async function setAdminPassword(username, hash, salt) {
  await col('admin_users').doc(docKey(username)).update({ password_hash: hash, salt, must_change_password: 0 })
}
