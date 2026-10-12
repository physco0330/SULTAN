import { getDb } from '../firebase.mjs'

/** Error con código HTTP: el manejador de Express lo convierte en la respuesta. */
export class StoreError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const db = () => getDb()
export const col = (name) => getDb().collection(name)

export const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

/** Milisegundos de una fecha "YYYY-MM-DD HH:MM:SS" (UTC) o ISO. NaN si no es válida. */
export function tsOf(value) {
  const s = String(value ?? '')
  if (!s) return NaN
  return Date.parse(/[TZ]/.test(s) ? s : `${s.replace(' ', 'T')}Z`)
}

export const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
export const descStr = (key) => (a, b) => cmpStr(b[key] ?? '', a[key] ?? '')

export const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
export const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true'
export const cents = (n) => Math.round(n * 100) / 100

/** Un ID de documento no puede contener "/" ni ser "." o "..". */
export function docKey(id) {
  const s = String(id ?? '').trim()
  if (!s || s.length > 500 || s.includes('/') || s === '.' || s === '..') return null
  return s
}

export async function getOne(name, id) {
  const key = docKey(id)
  if (!key) return null
  const snap = await col(name).doc(key).get()
  return snap.exists ? snap.data() : null
}

export async function listAll(name) {
  const snap = await col(name).get()
  return snap.docs.map((d) => d.data())
}

export async function listWhere(name, field, value) {
  const snap = await col(name).where(field, '==', value).get()
  return snap.docs.map((d) => d.data())
}

export async function findWhere(name, field, value) {
  const snap = await col(name).where(field, '==', value).limit(1).get()
  return snap.empty ? null : snap.docs[0].data()
}

export async function countOf(name, field, value) {
  const query = field === undefined ? col(name) : col(name).where(field, '==', value)
  const snap = await query.count().get()
  return snap.data().count
}

/** Borra documentos en lotes de 400 (límite de Firestore: 500 operaciones por lote). */
export async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db().batch()
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref)
    await batch.commit()
  }
}

const counterRef = (name) => col('counters').doc(name)

/* Firestore no tiene autoincremento: los IDs numéricos salen de un contador.
 * Dentro de una transacción todas las lecturas van antes que las escrituras. */
export async function readCounter(tx, name) {
  const snap = await tx.get(counterRef(name))
  return snap.exists ? Number(snap.get('value')) || 0 : 0
}

export function writeCounter(tx, name, value) {
  tx.set(counterRef(name), { value })
}

/** Reserva n IDs numéricos consecutivos para una colección. */
export async function allocIds(name, n = 1) {
  return getDb().runTransaction(async (tx) => {
    const last = await readCounter(tx, name)
    writeCounter(tx, name, last + n)
    return Array.from({ length: n }, (_, i) => last + i + 1)
  })
}

/* Caché en memoria para lecturas públicas frecuentes (ahorra lecturas de Firestore). */
const CACHE_TTL_MS = 60_000
const cache = new Map()

export async function cached(key, load) {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await load()
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
  return value
}

export function invalidate(...keys) {
  for (const key of keys) cache.delete(key)
}

export async function audit(username, action, entity, entityId, detail = '') {
  try {
    const [id] = await allocIds('audit_log')
    await col('audit_log').doc(String(id)).set({
      id,
      username: username ?? 'system',
      action,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      detail: detail ?? '',
      created_at: nowIso(),
    })
  } catch (err) {
    console.warn('[auditoría] no se pudo registrar:', err.message)
  }
}

export async function recentAudit(limit) {
  const snap = await col('audit_log').orderBy('id', 'desc').limit(limit).get()
  return snap.docs.map((d) => d.data())
}
