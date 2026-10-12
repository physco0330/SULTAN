import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { scryptSync, timingSafeEqual, randomUUID, randomBytes, createHmac } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, initDb, runMigrations, audit, nowIso, checkpoint, integrityCheck, DB_PATH } from './db.mjs'
import { registerProvider } from './payments/index.mjs'
import { demoProvider } from './payments/providers/demo.mjs'
import { paymentRoutes } from './payments/routes.mjs'
import { sendOrderConfirmation, notifyNewOrder, whatsappOrderLink, mailerConfig } from './mailer.mjs'
import {
  IS_PROD,
  PORT,
  UPLOADS_DIR,
  SULTAN_SECRET,
  allowedOrigins,
  describeConfig,
} from './config.mjs'
import { seedAll } from './seed.mjs'

process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning') return
  console.warn(w)
})

/* Se valida la configuracion ANTES de tocar nada: es preferible no arrancar.
   Se hace primero para poder reportar TODOS los problemas de una vez. */
const configReport = describeConfig()
if (!configReport.ok && IS_PROD) {
  console.error('[config] configuracion invalida: corrige lo anterior antes de desplegar.')
  process.exit(1)
}

/**
 * El secreto JWT nunca tiene un valor por defecto en el codigo.
 * - En produccion es obligatorio definir SULTAN_SECRET (32+ caracteres).
 * - En desarrollo se genera uno aleatorio por arranque, de modo que nadie
 *   pueda firmar tokens de admin con una clave publicada en el repositorio.
 */
const JWT_SECRET = (() => {
  if (SULTAN_SECRET.length >= 32) return SULTAN_SECRET
  console.warn('[config] AVISO: SULTAN_SECRET no definido. Se genero uno temporal; las sesiones admin se invalidaran al reiniciar.')
  return randomBytes(32).toString('hex')
})()
const JWT_ISSUER = 'sultan-black'
const JWT_AUDIENCE = 'sultan-black-admin'
const TOKEN_TTL = '12h'

/* Pasarela de pago: registra el adaptador según PAYMENT_PROVIDER (demo por defecto). */
registerProvider('demo', demoProvider)
if (!process.env.PAYMENT_PROVIDER) {
  process.env.PAYMENT_PROVIDER = 'demo'
  console.warn('[pago] PAYMENT_PROVIDER no definido: usando adaptador demo (sin cobro real).')
}

const integrity = integrityCheck()
if (!integrity.ok) {
  console.error(`[db] el archivo de base de datos esta danado (${integrity.error}). Restaura una copia ${DB_PATH}.bak-*`)
  process.exit(1)
}

initDb()
const migration = runMigrations()
if (migration.applied.length > 0) {
  console.log(`[migraciones] aplicadas: ${migration.applied.join(', ')}${migration.backup ? ` (backup: ${migration.backup})` : ''}`)
}
if (migration.failed) {
  console.error(`[migraciones] la migracion ${migration.failed.id} fallo: ${migration.failed.error}`)
  if (IS_PROD) process.exit(1)
}
seedAll()

if (IS_PROD && !process.env.SULTAN_DATA_DIR) {
  console.warn('[aviso] SULTAN_DATA_DIR no definido: la base de datos y las imagenes se perderan en el proximo despliegue.')
}

const app = express()
app.disable('x-powered-by')

/* ---------- encabezados de seguridad (equivalente Helmet) ---------- */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://wa.me",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  next()
})

/* ---------- CORS restringido ---------- */
const ALLOWED_ORIGINS = allowedOrigins()
app.use(
  cors({
    /* Sin lista configurada solo se acepta el mismo origen (navegador). */
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : (origin, cb) => {
      const sameOrigin = !origin || origin === `http://localhost:${PORT}` || origin === `https://localhost:${PORT}`
      cb(null, sameOrigin)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
)

/* ---------- rate limiting en memoria ---------- */
const rateBuckets = new Map()
const RATE_WINDOW_MS = 60_000
const rateLimit = (keyPrefix, max) => (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const key = `${keyPrefix}:${ip}`
  const now = Date.now()
  let bucket = rateBuckets.get(key)
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + RATE_WINDOW_MS }
    rateBuckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > max) {
    res.setHeader('Retry-After', Math.ceil((bucket.reset - now) / 1000))
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' })
  }
  next()
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateBuckets) if (now > v.reset) rateBuckets.delete(k)
}, RATE_WINDOW_MS).unref()

app.use('/api/admin/products/:id/images', express.json({ limit: '12mb' }))
app.use(express.json({ limit: '1mb' }))

/* ---------- utilidades de validación de imágenes ---------- */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', magic: Buffer.from([0xff, 0xd8, 0xff]) },
  { ext: 'png', mime: 'image/png', magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { ext: 'webp', mime: 'image/webp', magic: Buffer.from('RIFF', 'ascii'), extra: 'WEBP' },
]
const IMAGE_STATUSES = ['published', 'pending', 'disabled']

function sniffImage(buf) {
  for (const sig of IMAGE_SIGNATURES) {
    if (buf.length < sig.magic.length + 4) continue
    if (!buf.subarray(0, sig.magic.length).equals(sig.magic)) continue
    if (sig.extra && buf.subarray(8, 12).toString('ascii') !== sig.extra) continue
    return sig
  }
  return null
}

function imageDimensions(buf, sig) {
  try {
    if (sig.ext === 'png') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (sig.ext === 'jpg') {
      let offset = 2
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) { offset += 1; continue }
        const marker = buf[offset + 1]
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
        }
        offset += 2 + buf.readUInt16BE(offset + 2)
      }
    }
    if (sig.ext === 'webp' && buf.subarray(12, 16).toString('ascii') === 'VP8X') {
      return { width: (buf.readUIntLE(24, 3) + 1), height: (buf.readUIntLE(27, 3) + 1) }
    }
  } catch { /* dimensiones desconocidas no bloquean la subida */ }
  return null
}

function decodeBase64Image(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return null
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim())
  if (!match) return { error: 'Formato no permitido. Usa JPEG, PNG o WebP' }
  let buf
  try {
    buf = Buffer.from(match[2].replace(/\s+/g, ''), 'base64')
  } catch {
    return { error: 'Imagen corrupta' }
  }
  if (buf.length > MAX_IMAGE_BYTES) return { error: 'La imagen supera el tamaño máximo de 5 MB' }
  const sig = sniffImage(buf)
  if (!sig) return { error: 'El contenido del archivo no es una imagen válida' }
  return { buf, mime: sig.mime, ext: sig.ext, dimensions: imageDimensions(buf, sig) }
}

/* ---------------- utils ---------------- */

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true'
const cents = (n) => Math.round(n * 100) / 100

const asArray = (v) => {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.flatMap((x) => String(x).split(','))
  return String(v).split(',')
}

function productImagesOf(productId) {
  return db
    .prepare("SELECT path, alt FROM product_images WHERE product_id = ? AND status = 'published' ORDER BY is_primary DESC, position ASC, id ASC")
    .all(productId)
}

/**
 * Promedio y número de reseñas reales de varios productos en una sola pasada.
 * Nunca se usan las columnas products.rating / products.reviews: esas pueden
 * contener valores inventados. Solo cuentan las reseñas aprobadas y no-demo.
 *
 * @param {string[]} ids identificadores de producto
 */
function realRatingsFor(ids) {
  const out = {}
  const list = [...new Set(ids.filter(Boolean))]
  if (list.length === 0) return out
  const placeholders = list.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT product_id, COUNT(*) AS n, AVG(rating) AS avg
         FROM reviews
        WHERE status = 'approved' AND is_demo = 0 AND product_id IN (${placeholders})
        GROUP BY product_id`,
    )
    .all(...list)
  const byId = new Map(rows.map((r) => [r.product_id, r]))
  for (const id of list) {
    const row = byId.get(id)
    out[id] = row && row.n ? { rating: Math.round(row.avg * 10) / 10, count: row.n } : { rating: 0, count: 0 }
  }
  return out
}

/** Igual que realRatingsFor, pero para un solo producto. */
function realRating(productId) {
  return realRatingsFor([productId])[productId] ?? { rating: 0, count: 0 }
}

function toProduct(row, opts) {
  /* 'opts' solo cuenta si trae la clave: asi un .map(toProduct) (que pasa el
     indice) nunca filtra el SKU por accidente. */
  const admin = !!(opts && typeof opts === 'object' && opts.admin === true)
  if (!row) return null
  const images = productImagesOf(row.id)
  /* En listados se reutiliza el cálculo ya hecho para todos los productos. */
  const rr = (opts && opts.ratings && opts.ratings[row.id]) || realRating(row.id)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    gender: row.gender,
    collection: row.collection,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    currency: row.currency,
    stock: row.stock,
    rating: rr.rating,
    reviews: rr.count,
    featured: !!row.featured,
    isNew: !!row.is_new,
    isLimited: !!row.is_limited,
    isBestSeller: !!row.is_best_seller,
    isOnSale: !!row.is_on_sale,
    material: row.material,
    /* El SKU es un dato interno: solo lo ven los administradores. */
    ...(admin ? { sku: row.sku } : {}),
    description: row.description,
    quality: row.quality === 'original' ? 'original' : 'turkish',
    colors: JSON.parse(row.colors_json || '[]'),
    sizes: JSON.parse(row.sizes_json || '[]'),
    images: images.length > 0
      ? images.map((im) => ({ src: im.path, alt: im.alt || `${row.name} — imagen` }))
      : JSON.parse(row.images_json || '[]'),
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}

/** Módulo Mujer desactivado: la API nunca expone productos women. */
const WOMEN_ENABLED = getSetting('module_women', '0') === '1'

function publicConfig() {
  return {
    companyName: getSetting('company_name', 'SULTAN BLACK'),
    companyTagline: getSetting('company_tagline', 'Where Turkish Craft Meets Modern Luxury'),
    companyEmail: getSetting('company_email'),
    companyPhone: getSetting('company_phone'),
    companyWhatsapp: getSetting('company_whatsapp'),
    companyAddress: getSetting('company_address'),
    defaultCurrency: getSetting('default_currency', 'USD'),
    freeShippingThreshold: toNum(getSetting('free_shipping_threshold', '300')),
    flatShipping: toNum(getSetting('flat_shipping', '15')),
    expressShipping: toNum(getSetting('express_shipping', '45')),
    instagramUrl: getSetting('instagram_url'),
    announcements: getSetting('announcement_bar').split('|').map((s) => s.trim()).filter(Boolean),
  }
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password, salt, expected) {
  const hash = scryptSync(password, salt, 64)
  const buf = Buffer.from(expected, 'hex')
  return hash.length === buf.length && timingSafeEqual(hash, buf)
}

function signAuth(user) {
  return jwt.sign(
    {
      username: user.username,
      role: user.role,
      name: user.name,
      /* Mientras valga 1, el token solo habilita el cambio de contraseña. */
      pwd: user.must_change_password ? 1 : 0,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  )
}

/** Rutas abiertas aunque el administrador aún deba cambiar la contraseña. */
const PASSWORD_CHANGE_ALLOWED = new Set(['/api/admin/me', '/api/admin/auth/password'])

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' })
  try {
    req.auth = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
  /* Contraseña provisional (cuenta seed): no se permite tocar nada más. */
  if (req.auth.pwd === 1 && !PASSWORD_CHANGE_ALLOWED.has(req.path)) {
    return res.status(403).json({
      error: 'Debes cambiar la contraseña temporal antes de continuar',
      mustChangePassword: true,
    })
  }
  next()
}

function snakeRow(row) {
  const o = { ...row }
  for (const k of ['featured', 'is_new', 'is_limited', 'is_best_seller', 'is_on_sale', 'active']) {
    if (typeof o[k] === 'boolean') o[k] = o[k] ? 1 : 0
  }
  if (o.colors && typeof o.colors !== 'string') o.colors_json = undefined
  return o
}

function productBody(body) {
  return {
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? 'tshirts').trim(),
    gender: ['men', 'women', 'unisex'].includes(body.gender) ? body.gender : 'unisex',
    collection: String(body.collection ?? 'new').trim(),
    price: toNum(body.price),
    compareAtPrice: body.compareAtPrice === undefined || body.compareAtPrice === '' ? null : toNum(body.compareAtPrice),
    stock: Math.max(0, Math.floor(toNum(body.stock))),
    rating: body.rating === undefined ? null : toNum(body.rating),
    reviews: body.reviews === undefined ? null : Math.max(0, Math.floor(toNum(body.reviews))),
    featured: toBool(body.featured),
    isNew: toBool(body.isNew),
    isLimited: toBool(body.isLimited),
    isBestSeller: toBool(body.isBestSeller),
    isOnSale: toBool(body.isOnSale),
    material: String(body.material ?? '').trim() || 'Premium cotton blend',
    sku: String(body.sku ?? '').trim(),
    description: String(body.description ?? '').trim(),
    quality: body.quality === 'original' ? 'original' : 'turkish',
    colors: Array.isArray(body.colors) ? body.colors : [],
    sizes: Array.isArray(body.sizes) ? body.sizes : [],
    active: body.active === undefined ? true : toBool(body.active),
  }
}

function priceBounds() {
  const row = db.prepare('SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE active = 1').get()
  return { min: Math.floor(row.min ?? 0), max: Math.ceil(row.max ?? 1) }
}

/* ---------------- public: config & meta ---------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sultan-black-api', time: new Date().toISOString() }))

app.get('/api/config', (_req, res) => res.json(publicConfig()))

app.get('/api/categories', (_req, res) => {
  const rows = db.prepare('SELECT id, label_en, label_es, label_tr, sort FROM categories ORDER BY sort').all()
  res.json({ items: rows })
})

app.get('/api/coupons/validate', (req, res) => {
  const code = String(req.query.code ?? '').trim().toUpperCase().slice(0, 20)
  const subtotal = toNum(req.query.subtotal)
  if (!code) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'missing' })
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code)
  if (!row) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'invalid' })
  if (!row.active) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'inactive' })
  /* Cupón vencido: no puede aplicarse */
  if (row.expires_at && new Date(row.expires_at + 'T23:59:59Z').getTime() < Date.now())
    return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'expired' })
  /* Límite de usos alcanzado */
  if (row.max_uses != null && row.used_count >= row.max_uses)
    return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'max_uses' })
  if (subtotal < row.min_subtotal)
    return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'min_subtotal', minSubtotal: row.min_subtotal })
  const discount = cents((subtotal * row.percent) / 100)
  res.json({ valid: true, code, percent: row.percent, discount, minSubtotal: row.min_subtotal })
})

/* ---------------- public: products ---------------- */

app.get('/api/products', (req, res) => {
  const gender = asArray(req.query.gender)
  const category = asArray(req.query.category)
  const collection = asArray(req.query.collection)
  const size = asArray(req.query.size)
  const color = asArray(req.query.color)
  const availability = asArray(req.query.availability)
  const quality = asArray(req.query.quality)
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const min = req.query.min !== undefined ? toNum(req.query.min) : null
  const max = req.query.max !== undefined ? toNum(req.query.max) : null

  const where = ['active = 1']
  const params = []
  if (!WOMEN_ENABLED) where.push("gender != 'women'")
  if (gender.length) { where.push(`gender IN (${gender.map(() => '?').join(',')})`); params.push(...gender) }
  if (category.length) { where.push(`category IN (${category.map(() => '?').join(',')})`); params.push(...category) }
  if (collection.length) { where.push(`collection IN (${collection.map(() => '?').join(',')})`); params.push(...collection) }
  if (size.length) {
    where.push(`EXISTS (SELECT 1 FROM json_each(products.sizes_json) WHERE json_each.value IN (${size.map(() => '?').join(',')}))`)
    params.push(...size)
  }
  if (color.length) {
    where.push(`EXISTS (SELECT 1 FROM json_each(products.colors_json) WHERE json_extract(json_each.value, '$.id') IN (${color.map(() => '?').join(',')}))`)
    params.push(...color)
  }
  if (quality.length) {
    const valid = quality.filter((v) => v === 'original' || v === 'turkish')
    if (valid.length) {
      where.push('quality IN (' + valid.map(() => '?').join(',') + ')')
      params.push(...valid)
    }
  }
  if (q) {
    where.push('(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(material) LIKE ? OR category = ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, q)
  }
  if (min !== null) { where.push('price >= ?'); params.push(min) }
  if (max !== null) { where.push('price <= ?'); params.push(max) }

  let sql = `SELECT * FROM products WHERE ${where.join(' AND ')}`
  const sort = String(req.query.sort ?? 'featured')
  const byRated = sort === 'rated' || sort === 'featured'
  const orderBy =
    sort === 'price-asc' ? 'price ASC'
    : sort === 'price-desc' ? 'price DESC'
    : sort === 'newest' ? 'is_new DESC, created_at DESC'
    : sort === 'rated' ? 'rating DESC'
    : 'featured DESC, rating DESC'
  sql += ` ORDER BY ${orderBy}`

  const rows = db.prepare(sql).all(...params)
  const ratings = byRated ? realRatingsFor(rows.map((r) => r.id)) : null
  /* Ordenar por valoración usa el promedio real, no la columna inventada. */
  let items = rows.map((row) => toProduct(row, ratings ? { ratings } : undefined))
  if (sort === 'rated') {
    items.sort((a, b) => (b.reviews - a.reviews) || (b.rating - a.rating) || a.name.localeCompare(b.name))
  } else if (sort === 'featured') {
    items.sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating || b.reviews - a.reviews)
  }
  if (availability.length) {
    items = items.filter((p) => {
      const a = p.stock === 0 ? 'out-of-stock' : p.stock <= 8 ? 'low-stock' : 'in-stock'
      return availability.includes(a)
    })
  }

  res.json({ items, total: items.length, bounds: priceBounds() })
})

app.get('/api/products/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(req.params.slug)
    ?? db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.slug)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  res.json({ product: toProduct(row) })
})

/* ---------------- public: checkout ---------------- */

/* Resuelve o crea el cliente del pedido. Identificador fiable: email normalizado.
 * Devuelve el id del cliente. No depende únicamente del nombre. */
function resolveCustomer(info, { create = true } = {}) {
  const email = String(info.email ?? '').trim().toLowerCase()
  const name = String(info.name ?? '').trim()
  const existing = email ? db.prepare('SELECT * FROM customers WHERE email = ?').get(email) : null
  if (existing) {
    db.prepare(`UPDATE customers SET
      name = COALESCE(NULLIF(?, ''), name),
      phone = COALESCE(?, phone),
      city = COALESCE(?, city),
      country = COALESCE(?, country),
      address = COALESCE(?, address),
      document = COALESCE(?, document)
      WHERE id = ?`)
      .run(
        name,
        String(info.phone ?? '').trim() || null,
        String(info.city ?? '').trim() || null,
        String(info.country ?? '').trim() || null,
        String(info.address ?? '').trim() || null,
        String(info.document ?? '').trim().slice(0, 40) || null,
        existing.id,
      )
    return existing.id
  }
  if (!create) return null
  const result = db.prepare(
    'INSERT INTO customers (name, email, phone, city, country, address, document) VALUES (?,?,?,?,?,?,?)',
  ).run(
    name,
    email || null,
    String(info.phone ?? '').trim() || null,
    String(info.city ?? '').trim() || null,
    String(info.country ?? '').trim() || null,
    String(info.address ?? '').trim() || null,
    String(info.document ?? '').trim().slice(0, 40) || null,
  )
  return Number(result.lastInsertRowid)
}

/** Actualiza los contadores de historial del cliente tras un pedido. */
function touchCustomerAfterOrder(customerId, orderCreatedAt) {
  if (!customerId) return
  const row = db.prepare("SELECT COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at, COALESCE(SUM(total_usd),0) AS total FROM orders WHERE customer_id = ? AND status != 'cancelled'").get(customerId)
  const hasColumnFirst = db.prepare('PRAGMA table_info(customers)').all().some((c) => c.name === 'first_order_at')
  if (!hasColumnFirst) return
  db.prepare('UPDATE customers SET first_order_at = ?, last_order_at = ?, total_spent = ? WHERE id = ?')
    .run(row.first_at ?? orderCreatedAt, row.last_at ?? orderCreatedAt, Math.round(row.total), customerId)
}

app.post('/api/orders', rateLimit('orders', 20), (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const info = req.body.customer ?? {}
  if (items.length === 0) return res.status(422).json({ error: 'El carrito está vacío' })
  if (!String(info.email ?? '').trim() || !String(info.name ?? '').trim())
    return res.status(422).json({ error: 'Datos de contacto requeridos' })

  const prepared = []
  for (const it of items) {
    const qty = Math.max(1, Math.floor(toNum(it.quantity, 1)))
    if (qty > 50) return res.status(422).json({ error: 'Cantidad no permitida' })
    const row = db.prepare('SELECT * FROM products WHERE (slug = ? OR id = ?) AND active = 1').get(it.id, it.id)
    if (!row) return res.status(422).json({ error: `Producto no disponible: ${it.id}` })
    if (row.stock < qty) return res.status(409).json({ error: `Stock insuficiente para ${row.name}` })
    prepared.push({ row, qty, size: String(it.size ?? 'M').slice(0, 8), color: String(it.color ?? 'Black').slice(0, 40) })
  }

  const subtotal = prepared.reduce((s, p) => s + p.row.price * p.qty, 0)
  const threshold = toNum(getSetting('free_shipping_threshold', '300'))
  const flat = toNum(getSetting('flat_shipping', '15'))
  const shipping = subtotal >= threshold ? 0 : flat

  /* Un solo cupón por pedido: si el cliente envía una lista, se rechaza. */
  if (Array.isArray(req.body.promoCode) || Array.isArray(req.body.promoCodes))
    return res.status(422).json({ error: 'Solo se permite un cupón por pedido' })
  const code = String(req.body.promoCode ?? '').trim().toUpperCase().slice(0, 20)
  let discount = 0
  let couponCode = null
  if (code) {
    const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code)
    const vigente = c && (!c.expires_at || new Date(c.expires_at + 'T23:59:59Z').getTime() >= Date.now())
    const disponible = c && (c.max_uses == null || c.used_count < c.max_uses)
    if (c && vigente && disponible && subtotal >= c.min_subtotal) {
      discount = cents((subtotal * c.percent) / 100)
      couponCode = code
    }
  }
  const total = cents(subtotal + shipping - discount)

  db.exec('BEGIN')
  let customerId = null
  let number = ''
  let orderId = null
  try {
    customerId = resolveCustomer(info)
    do {
      number = `S-${String(Math.floor(100000 + Math.random() * 899999))}`
    } while (db.prepare('SELECT id FROM orders WHERE number = ?').get(number))

    const orderRes = db.prepare(`INSERT INTO orders (
      number, customer_id, customer_name, customer_email, customer_phone, ship_city, ship_country,
      ship_address, ship_zip, subtotal_usd, shipping_usd, discount_usd, total_usd, currency,
      coupon_code, status, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, customerId, String(info.name).trim(), String(info.email).trim().toLowerCase(),
      String(info.phone ?? '').trim(), String(info.city ?? '').trim(), String(info.country ?? '').trim(),
      String(info.address ?? '').trim(), String(info.zip ?? '').trim(),
      cents(subtotal), shipping, discount, total, 'USD', couponCode, 'pending', nowIso(),
    )
    orderId = Number(orderRes.lastInsertRowid)

    const itemIns = db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, size, color, quantity, price_usd, image) VALUES (?,?,?,?,?,?,?,?)',
    )
    const stockUpd = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?')
    for (const p of prepared) {
      itemIns.run(orderId, p.row.id, p.row.name, p.size, p.color, p.qty, p.row.price, null)
      stockUpd.run(p.qty, nowIso(), p.row.id)
    }
    touchCustomerAfterOrder(customerId, nowIso())
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignorar */ }
    console.error('[pedido] error de transacción:', err.message)
    return res.status(500).json({ error: 'No se pudo registrar el pedido' })
  }

audit('cliente', 'order.create', 'orders', number, `Pedido ${number} por ${subtotal} USD`)
  if (customerId) audit('cliente', 'customer.auto', 'customers', String(customerId), `Cliente vinculado al pedido ${number}`)

  /* Notificaciones: email al cliente y aviso al negocio. */
  const orderRow = db.prepare('SELECT * FROM orders WHERE number = ?').get(number)
  const orderItems = db.prepare('SELECT name, quantity, price_usd FROM order_items WHERE order_id = ?').all(orderId)
  sendOrderConfirmation(orderRow, orderItems).catch((e) => console.warn('[correo] confirmación al cliente:', e.message))
  notifyNewOrder(orderRow, orderItems).catch((e) => console.warn('[correo] notificación al negocio:', e.message))

  res.status(201).json({
    ok: true,
    order: {
      number,
      status: 'pending',
      createdAt: nowIso(),
      customer: { name: String(info.name).trim() },
      trackingToken: trackingToken(number),
      totals: { subtotal, shipping, discount, total, currency: 'USD' },
    },
  })
})

/**
 * Token opaco de seguimiento. Solo quien lo recibe (quien creo el pedido)
 * puede consultarlo, y la respuesta nunca incluye datos personales.
 */
function trackingToken(number) {
  const secret = process.env.SULTAN_SECRET || JWT_SECRET
  return createHmac('sha256', secret).update(`order:${number}`).digest('base64url').slice(0, 24)
}

/** Comparacion en tiempo constante: no se filtra el token por temporizacion. */
function tokenMatches(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Consulta publica del estado de un pedido.
 * Exige el token entregado al crear el pedido: sin el no se revela nada, asi
 * los numeros de pedido no son enumerables ni exponen PII.
 */
app.get('/api/orders/:number', rateLimit('track', 30), (req, res) => {
  const number = String(req.params.number ?? '').trim().toUpperCase()
  const token = String(req.query.token ?? req.headers['x-order-token'] ?? '').trim()
  const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(number)
  /* Misma respuesta para "no existe" y "token incorrecto": no revelamos cuales hay. */
  if (!order || !token || !tokenMatches(token, trackingToken(order.number)))
    return res.status(404).json({ error: 'No se encontró un pedido con esos datos' })

  const rows = db.prepare('SELECT name, size, color, quantity, price_usd FROM order_items WHERE order_id = ?').all(order.id)
  const items = rows.map((r) => ({
    name: r.name, size: r.size, color: r.color, quantity: r.quantity, price: r.price_usd,
  }))
  res.json({
    order: {
      number: order.number,
      status: order.status,
      createdAt: order.created_at,
      shipCity: order.ship_city ? String(order.ship_city).slice(0, 60) : null,
      items,
      totals: {
        subtotal: order.subtotal_usd, shipping: order.shipping_usd,
        discount: order.discount_usd, total: order.total_usd, currency: order.currency,
      },
    },
  })
})

/* ---------------- public: contact & newsletter ---------------- */

app.post('/api/contact', rateLimit('contact', 10), (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const email = String(req.body.email ?? '').trim()
  const subject = String(req.body.subject ?? '').trim()
  const message = String(req.body.message ?? '').trim()
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(422).json({ error: 'Datos inválidos' })
  if (!message) return res.status(422).json({ error: 'Mensaje requerido' })
  db.prepare('INSERT INTO contacts (name, email, subject, message) VALUES (?,?,?,?)').run(name, email, subject || null, message)
  audit(null, 'contact.create', 'contacts', email, `${name} envió un mensaje`)
  res.status(201).json({ ok: true })
})

app.post('/api/newsletter', rateLimit('newsletter', 15), (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: 'Email inválido' })
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email)
  res.status(201).json({ ok: true })
})

/* ---------------- public: reviews ---------------- */

app.get('/api/reviews', (req, res) => {
const productId = String(req.query.product ?? '').trim()
  /* Solo reseñas aprobadas y nunca de demostración: publicar testimonios
     inventados como si fueran de clientes reales es publicidad engañosa. */
  const rows = productId
    ? db.prepare("SELECT * FROM reviews WHERE status = 'approved' AND is_demo = 0 AND product_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").all(productId)
    : db.prepare("SELECT * FROM reviews WHERE status = 'approved' AND is_demo = 0 ORDER BY created_at DESC, id DESC LIMIT 50").all()
  const agg = productId
    ? db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status = 'approved' AND is_demo = 0 AND product_id = ?").get(productId)
    : db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status = 'approved' AND is_demo = 0").get()
  res.json({
    items: rows,
    summary: { count: agg.n, average: agg.avg ? Math.round(agg.avg * 10) / 10 : 0 },
  })
})

app.post('/api/reviews', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const city = String(req.body.city ?? '').trim()
  const rating = Math.round(toNum(req.body.rating, 5))
  const comment = String(req.body.comment ?? '').trim()
  const productId = String(req.body.productId ?? '').trim()
  if (!name || name.length > 60) return res.status(422).json({ error: 'Nombre requerido' })
  if (rating < 1 || rating > 5) return res.status(422).json({ error: 'Calificación inválida' })
  if (comment.length < 4 || comment.length > 800) return res.status(422).json({ error: 'El comentario debe tener al menos 4 caracteres' })
  if (productId && !db.prepare('SELECT id FROM products WHERE id = ? OR slug = ?').get(productId, productId))
    return res.status(422).json({ error: 'Producto no válido' })
  /* Se publican al instante; el admin puede eliminarlas desde el panel. */
  db.prepare("INSERT INTO reviews (name, city, rating, comment, product_id, status) VALUES (?,?,?,?,?,'approved')")
    .run(name, city || null, rating, comment, productId || null)
  audit(null, 'review.create', 'reviews', null, name + ' - publicada')
  res.status(201).json({ ok: true, status: 'approved' })
})

/* ---------------- admin: imágenes del catálogo ---------------- */

app.get('/api/admin/images', requireAuth, (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const rows = q
    ? db.prepare(`SELECT pi.*, p.name AS product_name FROM product_images pi JOIN products p ON p.id = pi.product_id
                  WHERE LOWER(p.name) LIKE ? ORDER BY pi.product_id, pi.is_primary DESC, pi.position ASC`).all(`%${q}%`)
    : db.prepare(`SELECT pi.*, p.name AS product_name FROM product_images pi JOIN products p ON p.id = pi.product_id
                  ORDER BY pi.product_id, pi.is_primary DESC, pi.position ASC`).all()
  res.json({ items: rows })
})

app.get('/api/admin/products/:id/images', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, position ASC, id ASC').all(req.params.id)
  res.json({ items: rows })
})

app.post('/api/admin/products/:id/images', requireAuth, rateLimit('upload', 60), (req, res) => {
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })

  const incoming = Array.isArray(req.body.images) ? req.body.images : [req.body]
  if (incoming.length === 0) return res.status(422).json({ error: 'No se recibieron imágenes' })
  if (incoming.length > 10) return res.status(422).json({ error: 'Máximo 10 imágenes por solicitud' })

  const dir = join(UPLOADS_DIR, 'products', product.id)
  mkdirSync(dir, { recursive: true })

  const countRow = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(product.id)
  let position = countRow.n
  let primaryTaken = !!db.prepare('SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1').get(product.id)
  const saved = []

  try {
    db.exec('BEGIN')
    for (const item of incoming) {
      const decoded = decodeBase64Image(item?.data)
      if (!decoded || decoded.error) {
        throw Object.assign(new Error(decoded?.error ?? 'Imagen inválida'), { status: 422 })
      }
      const filename = `${randomUUID()}.${decoded.ext}`
      const relPath = `/uploads/products/${product.id}/${filename}`
      writeFileSync(join(dir, filename), decoded.buf)

      const isPrimary = !primaryTaken
      primaryTaken = true
      const alt = String(item?.alt ?? '').trim().slice(0, 160)
      const status = IMAGE_STATUSES.includes(item?.status) ? item.status : 'published'

      const result = db.prepare(
        'INSERT INTO product_images (product_id, path, alt, position, is_primary, status) VALUES (?,?,?,?,?,?)',
      ).run(product.id, relPath, alt, position++, isPrimary ? 1 : 0, status)
      saved.push({
        id: Number(result.lastInsertRowid),
        productId: product.id,
        path: relPath,
        alt,
        position: position - 1,
        isPrimary,
        status,
      })
    }
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ya estaba en rollback */ }
    for (const im of saved) {
      const file = join(UPLOADS_DIR, im.path.replace('/uploads/', ''))
      try { if (existsSync(file)) unlinkSync(file) } catch { /* ignorar */ }
    }
    if (err.status === 422) return res.status(422).json({ error: err.message })
    console.error('[upload imagen]', err)
    return res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }

  audit(req.auth.username, 'image.upload', 'product_images', product.id, `Subió ${saved.length} imagen(es) para ${product.name}`)
  res.status(201).json({ items: saved })
})

app.patch('/api/admin/images/:id', requireAuth, (req, res) => {
  const image = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id)
  if (!image) return res.status(404).json({ error: 'Imagen no encontrada' })
  const sets = []
  const params = []
  if (req.body.alt !== undefined) { sets.push('alt = ?'); params.push(String(req.body.alt).trim().slice(0, 160)) }
  if (req.body.status !== undefined) {
    if (!IMAGE_STATUSES.includes(req.body.status)) return res.status(422).json({ error: 'Estado no válido' })
    sets.push('status = ?'); params.push(req.body.status)
  }
  if (req.body.isPrimary === true) {
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').run(image.product_id)
      db.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ?').run(image.id)
      db.exec('COMMIT')
    } catch (err) {
      try { db.exec('ROLLBACK') } catch { /* ignorar */ }
      throw err
    }
    audit(req.auth.username, 'image.setPrimary', 'product_images', image.id)
    return res.json({ ok: true })
  }
  if (sets.length === 0) return res.json({ ok: true })
  sets.push('updated_at = ?')
  params.push(nowIso(), image.id)
  db.prepare(`UPDATE product_images SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  audit(req.auth.username, 'image.update', 'product_images', image.id)
  res.json({ ok: true })
})

app.post('/api/admin/images/reorder', requireAuth, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter((n) => Number.isFinite(n)) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista de imágenes vacía' })
  db.exec('BEGIN')
  try {
    ids.forEach((id, index) => {
      db.prepare('UPDATE product_images SET position = ?, updated_at = ? WHERE id = ?').run(index, nowIso(), id)
    })
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignorar */ }
    throw err
  }
  audit(req.auth.username, 'image.reorder', 'product_images', null, `${ids.length} imágenes reordenadas`)
  res.json({ ok: true })
})

app.delete('/api/admin/images/:id', requireAuth, (req, res) => {
  const image = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id)
  if (!image) return res.status(404).json({ error: 'Imagen no encontrada' })
  db.prepare('DELETE FROM product_images WHERE id = ?').run(image.id)
  if (image.is_primary) {
    const next = db.prepare("SELECT id FROM product_images WHERE product_id = ? AND status = 'published' ORDER BY position ASC, id ASC LIMIT 1").get(image.product_id)
    if (next) db.prepare('UPDATE product_images SET is_primary = 1 WHERE id = ?').run(next.id)
  }
  const file = join(UPLOADS_DIR, image.path.replace('/uploads/', ''))
  try { if (existsSync(file)) unlinkSync(file) } catch { /* ignorar */ }
  audit(req.auth.username, 'image.delete', 'product_images', image.id)
  res.json({ ok: true })
})

/* ---------------- admin: proveedores ---------------- */

function supplierBody(body) {
  return {
    company: String(body.company ?? '').trim().slice(0, 160),
    taxId: String(body.taxId ?? '').trim().slice(0, 40) || null,
    phone: String(body.phone ?? '').trim().slice(0, 40) || null,
    email: String(body.email ?? '').trim().slice(0, 160) || null,
    address: String(body.address ?? '').trim().slice(0, 300) || null,
    category: String(body.category ?? '').trim().slice(0, 80) || null,
    notes: String(body.notes ?? '').trim().slice(0, 2000) || null,
    active: body.active === undefined ? true : toBool(body.active),
  }
}

app.get('/api/admin/suppliers', requireAuth, (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const rows = q
    ? db.prepare(`SELECT * FROM suppliers WHERE LOWER(company) LIKE ? OR LOWER(COALESCE(tax_id,'')) LIKE ?
                  OR LOWER(COALESCE(email,'')) LIKE ? ORDER BY company ASC`).all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM suppliers ORDER BY company ASC').all()
  res.json({ items: rows })
})

app.post('/api/admin/suppliers', requireAuth, (req, res) => {
  const b = supplierBody(req.body)
  if (b.company.length < 2) return res.status(422).json({ error: 'El nombre de la empresa es obligatorio' })
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return res.status(422).json({ error: 'Correo no válido' })
  const result = db.prepare(
    'INSERT INTO suppliers (company, tax_id, phone, email, address, category, notes, active) VALUES (?,?,?,?,?,?,?,?)',
  ).run(b.company, b.taxId, b.phone, b.email, b.address, b.category, b.notes, b.active ? 1 : 0)
  audit(req.auth.username, 'supplier.create', 'suppliers', String(result.lastInsertRowid), `Creó proveedor ${b.company}`)
  res.status(201).json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid) })
})

app.put('/api/admin/suppliers/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  const b = supplierBody(req.body)
  if (b.company.length < 2) return res.status(422).json({ error: 'El nombre de la empresa es obligatorio' })
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return res.status(422).json({ error: 'Correo no válido' })
  db.prepare(`UPDATE suppliers SET company=?, tax_id=?, phone=?, email=?, address=?, category=?, notes=?, active=?, updated_at=?
              WHERE id=?`)
    .run(b.company, b.taxId, b.phone, b.email, b.address, b.category, b.notes, b.active ? 1 : 0, nowIso(), row.id)
  audit(req.auth.username, 'supplier.update', 'suppliers', row.id, `Actualizó proveedor ${b.company}`)
  res.json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(row.id) })
})

app.patch('/api/admin/suppliers/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  if (req.body.active !== undefined) {
    db.prepare('UPDATE suppliers SET active = ?, updated_at = ? WHERE id = ?').run(toBool(req.body.active) ? 1 : 0, nowIso(), row.id)
  }
  audit(req.auth.username, 'supplier.status', 'suppliers', row.id, `${row.company}: activo=${req.body.active}`)
  res.json({ ok: true })
})

app.delete('/api/admin/suppliers/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(row.id)
  audit(req.auth.username, 'supplier.delete', 'suppliers', row.id, `Eliminó proveedor ${row.company}`)
  res.json({ ok: true })
})

/* ---------------- taxonomía pública: categorías y colecciones ---------------- */

const slugId = (v) =>
  String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

app.get('/api/collections', (_req, res) => {
  const rows = db.prepare("SELECT id, label_es, label_en, sort FROM collections WHERE active = 1 ORDER BY sort ASC, id ASC").all()
  res.json({ items: rows })
})

/* ---------------- admin: colecciones ---------------- */

app.get('/api/admin/collections', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM collections ORDER BY sort ASC, id ASC').all() })
})

app.post('/api/admin/collections', requireAuth, (req, res) => {
  const labelEs = String(req.body.labelEs ?? '').trim()
  const labelEn = String(req.body.labelEn ?? '').trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la colección es obligatorio' })
  const id = req.body.id ? slugId(req.body.id) : slugId(labelEs)
  if (!id) return res.status(422).json({ error: 'Identificador no válido' })
  if (db.prepare('SELECT id FROM collections WHERE id = ?').get(id)) return res.status(409).json({ error: 'Ya existe una colección con ese identificador' })
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM collections').get().m
  db.prepare('INSERT INTO collections (id, label_es, label_en, sort, active) VALUES (?,?,?,?,?)')
    .run(id, labelEs.slice(0, 80), labelEn.slice(0, 80), maxSort + 1, req.body.active === false ? 0 : 1)
  audit(req.auth.username, 'collection.create', 'collections', id, `Creó colección ${labelEs}`)
  res.status(201).json({ collection: db.prepare('SELECT * FROM collections WHERE id = ?').get(id) })
})

app.put('/api/admin/collections/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Colección no encontrada' })
  const labelEs = String(req.body.labelEs ?? row.label_es).trim()
  const labelEn = String(req.body.labelEn ?? row.label_en).trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la colección es obligatorio' })
  db.prepare('UPDATE collections SET label_es = ?, label_en = ?, sort = ?, active = ?, updated_at = ? WHERE id = ?')
    .run(
      labelEs.slice(0, 80), labelEn.slice(0, 80),
      Number.isFinite(Number(req.body.sort)) ? Math.floor(Number(req.body.sort)) : row.sort,
      req.body.active === undefined ? row.active : (toBool(req.body.active) ? 1 : 0),
      nowIso(), row.id,
    )
  audit(req.auth.username, 'collection.update', 'collections', row.id, `Actualizó colección ${labelEs}`)
  res.json({ collection: db.prepare('SELECT * FROM collections WHERE id = ?').get(row.id) })
})

app.delete('/api/admin/collections/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Colección no encontrada' })
  const used = db.prepare('SELECT COUNT(*) AS n FROM products WHERE collection = ?').get(row.id).n
  if (used > 0) return res.status(409).json({ error: `No se puede eliminar: ${used} producto(s) usan esta colección` })
  db.prepare('DELETE FROM collections WHERE id = ?').run(row.id)
  audit(req.auth.username, 'collection.delete', 'collections', row.id, `Eliminó colección ${row.label_es}`)
  res.json({ ok: true })
})

/* ---------------- admin: categorías ---------------- */

app.get('/api/admin/categories', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM categories ORDER BY sort ASC, id ASC').all() })
})

app.post('/api/admin/categories', requireAuth, (req, res) => {
  const id = slugId(req.body.id ?? req.body.labelEs ?? '')
  const labelEs = String(req.body.labelEs ?? '').trim()
  const labelEn = String(req.body.labelEn ?? '').trim() || labelEs
  if (!id) return res.status(422).json({ error: 'Identificador no válido' })
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la categoría es obligatorio' })
  if (db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) return res.status(409).json({ error: 'Ya existe una categoría con ese identificador' })
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM categories').get().m
  db.prepare('INSERT INTO categories (id, label_en, label_es, label_tr, sort) VALUES (?,?,?,?,?)')
    .run(id, labelEn.slice(0, 60), labelEs.slice(0, 60), labelEs.slice(0, 60), maxSort + 1)
  audit(req.auth.username, 'category.create', 'categories', id, `Creó categoría ${labelEs}`)
  res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) })
})

app.put('/api/admin/categories/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
  const labelEs = String(req.body.labelEs ?? row.label_es).trim()
  const labelEn = String(req.body.labelEn ?? row.label_en).trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la categoría es obligatorio' })
  db.prepare('UPDATE categories SET label_es = ?, label_en = ?, label_tr = ?, sort = ? WHERE id = ?')
    .run(
      labelEs.slice(0, 60), labelEn.slice(0, 60), labelEs.slice(0, 60),
      Number.isFinite(Number(req.body.sort)) ? Math.floor(Number(req.body.sort)) : row.sort, row.id,
    )
  audit(req.auth.username, 'category.update', 'categories', row.id, `Actualizó categoría ${labelEs}`)
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(row.id) })
})

app.delete('/api/admin/categories/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
  const used = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category = ?').get(row.id).n
  if (used > 0) return res.status(409).json({ error: `No se puede eliminar: ${used} producto(s) usan esta categoría` })
  db.prepare('DELETE FROM categories WHERE id = ?').run(row.id)
  audit(req.auth.username, 'category.delete', 'categories', row.id, `Eliminó categoría ${row.label_es}`)
  res.json({ ok: true })
})

app.post('/api/admin/collections/reorder', requireAuth, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista vacía' })
  db.exec('BEGIN')
  try {
    ids.forEach((id, index) => {
      db.prepare('UPDATE collections SET sort = ?, updated_at = ? WHERE id = ?').run(index, nowIso(), id)
    })
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignorar */ }
    throw err
  }
  audit(req.auth.username, 'collection.reorder', 'collections', null, `${ids.length} colecciones reordenadas`)
  res.json({ ok: true })
})

app.post('/api/admin/categories/reorder', requireAuth, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista vacía' })
  db.exec('BEGIN')
  try {
    ids.forEach((id, index) => {
      db.prepare('UPDATE categories SET sort = ? WHERE id = ?').run(index, id)
    })
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch { /* ignorar */ }
    throw err
  }
  audit(req.auth.username, 'category.reorder', 'categories', null, `${ids.length} categorías reordenadas`)
  res.json({ ok: true })
})

/* ---------------- admin: auth ---------------- */

app.post('/api/admin/auth/login', rateLimit('login', 10), (req, res) => {
  const username = String(req.body.username ?? '').trim()
  const password = String(req.body.password ?? '')
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username)
  if (!user || !verifyPassword(password, user.salt, user.password_hash))
    return res.status(401).json({ error: 'Credenciales inválidas' })
  const token = signAuth(user)
  audit(user.username, 'auth.login', 'admin_users', user.username)
  res.json({
    token,
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    },
  })
})

app.get('/api/admin/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT must_change_password FROM admin_users WHERE username = ?').get(req.auth.username)
  res.json({
    user: {
      username: req.auth.username,
      name: req.auth.name,
      role: req.auth.role,
      mustChangePassword: !!row?.must_change_password,
    },
  })
})

function passwordStrength(pw) {
  if (pw.length < 10) return 'La contraseña debe tener al menos 10 caracteres'
  if (pw.length > 200) return 'La contraseña es demasiado larga'
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Debe combinar mayúsculas y minúsculas'
  if (!/\d/.test(pw)) return 'Debe incluir al menos un número'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Debe incluir al menos un símbolo'
  return null
}

app.post('/api/admin/auth/password', requireAuth, (req, res) => {
  const current = String(req.body.currentPassword ?? '')
  const nextPw = String(req.body.newPassword ?? '')
  const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.auth.username)
  if (!row || !verifyPassword(current, row.salt, row.password_hash))
    return res.status(401).json({ error: 'La contraseña actual no es correcta' })
  const weak = passwordStrength(nextPw)
  if (weak) return res.status(422).json({ error: weak })
  if (verifyPassword(nextPw, row.salt, row.password_hash))
    return res.status(422).json({ error: 'La nueva contraseña debe ser distinta de la actual' })

  const salt = randomBytes(16).toString('hex')
  db.prepare('UPDATE admin_users SET password_hash = ?, salt = ?, must_change_password = 0 WHERE username = ?')
    .run(hashPassword(nextPw, salt), salt, row.username)
  audit(req.auth.username, 'auth.password_changed', 'admin_users', row.username, 'Contraseña actualizada')
  /* Token nuevo: el resto de la sesión queda invalidado. */
  const fresh = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(row.username)
  res.json({ ok: true, token: signAuth(fresh) })
})

/* ---------------- admin: dashboard ---------------- */

/* ---------------- admin: stats ---------------- */

function periodRange(period, opts = {}) {
  const now = new Date()
  const startOfDay = () => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  /* Override por rango personalizado (calendario del dashboard) */
  if (opts.from) {
    const start = new Date(opts.from)
    if (Number.isNaN(start.getTime())) return { start: null, end: null, prevStart: null, label: 'Todo el historial' }
    const end = opts.to ? new Date(opts.to) : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999)
    const fmt = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    const label = opts.to && end.getTime() !== start.getTime() ? `${fmt(start)} — ${fmt(end)}` : fmt(start)
    return { start, end: Number.isNaN(end.getTime()) ? null : end, prevStart: null, label }
  }
  switch (period) {
    case 'week': {
      const start = startOfDay()
      start.setDate(start.getDate() - 6)
      const prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 7)
      return { start, end: null, prevStart, label: 'Últimos 7 días' }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start, end: null, prevStart, label: 'Mes actual' }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const prevStart = new Date(now.getFullYear() - 1, 0, 1)
      return { start, end: null, prevStart, label: 'Año actual' }
    }
    default:
      return { start: null, end: null, prevStart: null, label: 'Todo el historial' }
  }
}

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const period = String(req.query.period ?? 'all').trim()
  const { start, end, prevStart, label } = periodRange(period, {
    from: req.query.from ? String(req.query.from) : null,
    to: req.query.to ? String(req.query.to) : null,
  })
  /* is_demo = 0: los pedidos de prueba no cuentan como ingresos reales. */
  const base = start === null
    ? "SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND is_demo = 0"
    : end
      ? "SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND is_demo = 0 AND created_at >= ? AND created_at <= ?"
      : "SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND is_demo = 0 AND created_at >= ?"
  const revenue = start === null
    ? db.prepare(base).get()
    : end
      ? db.prepare(base).get(start.toISOString(), end.toISOString())
      : db.prepare(base).get(start.toISOString())
  const previousRevenue = prevStart === null || start === null
    ? null
    : db.prepare("SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND is_demo = 0 AND created_at >= ? AND created_at < ?")
        .get(prevStart.toISOString(), start.toISOString())
  const revenueDelta = previousRevenue && previousRevenue.total > 0
    ? Math.round(((revenue.total - previousRevenue.total) / previousRevenue.total) * 100)
    : previousRevenue === null ? undefined : 100
  const ordersDelta = previousRevenue && previousRevenue.n > 0
    ? Math.round(((revenue.n - previousRevenue.n) / previousRevenue.n) * 100)
    : previousRevenue === null ? undefined : 100
  const prod = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get()
  const low = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock > 0 AND stock <= 8').get()
  const out = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock = 0').get()
  const featured = db.prepare('SELECT COUNT(*) AS n FROM products WHERE featured = 1 AND active = 1').get()
  const subscribers = db.prepare('SELECT COUNT(*) AS n FROM subscribers').get()
  const contacts = db.prepare('SELECT COUNT(*) AS n FROM contacts').get()

  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = db.prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(total_usd),0) AS revenue
       FROM orders WHERE status != 'cancelled' AND is_demo = 0 AND strftime('%Y-%m', created_at) = ?`,
    ).get(month)
    months.push({ month, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), orders: row.orders, revenue: Math.round(row.revenue) })
  }

  const orderOffset = start === null ? '0' : '8'
  const recent = start === null
    ? db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8').all()
    : end
      ? db.prepare('SELECT * FROM orders WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 8').all(start.toISOString(), end.toISOString())
      : db.prepare('SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT 8').all(start.toISOString())
  const lowStockRows = db.prepare(
    'SELECT * FROM products WHERE active = 1 AND stock > 0 AND stock <= 8 ORDER BY stock ASC LIMIT 8',
  ).all()
  const lowStockRatings = realRatingsFor(lowStockRows.map((r) => r.id))
  const lowStock = lowStockRows.map((row) => toProduct(row, { ratings: lowStockRatings }))

  const top = db.prepare(`
    SELECT oi.product_id, oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price_usd) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.is_demo = 0
    GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 5
  `).all()

  res.json({
    period: { key: period, label },
    revenue: { total: Math.round(revenue.total), orders: revenue.n, delta: revenueDelta },
    ordersDelta,
    products: { total: prod.n, lowStock: low.n, outOfStock: out.n, featured: featured.n },
    social: { subscribers: subscribers.n, contacts: contacts.n },
    revenueByMonth: months,
    recentOrders: recent,
    lowStockProducts: lowStock,
    topSelling: top,
  })
})

/* ---------------- admin: products CRUD ---------------- */

app.get('/api/admin/products', requireAuth, (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const rows = q
    ? db.prepare('SELECT * FROM products WHERE LOWER(name) LIKE ? OR LOWER(sku) LIKE ? ORDER BY created_at DESC')
        .all(`%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
  const adminRatings = realRatingsFor(rows.map((r) => r.id))
  res.json({ items: rows.map((row) => toProduct(row, { admin: true, ratings: adminRatings })) })
})

function nextProductId() {
  const row = db.prepare("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) AS m FROM products").get()
  return `SB-${String((row.m ?? 0) + 1).padStart(3, '0')}`
}

function uniqueSlug(name, id) {
  const base = slugify(name) || 'producto'
  let slug = base
  let n = 2
  while (db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, id)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

app.post('/api/admin/products', requireAuth, (req, res) => {
  const body = productBody(req.body)
  if (!body.name) return res.status(422).json({ error: 'El nombre es obligatorio' })
  const id = nextProductId()
  const slug = uniqueSlug(body.name, id)
  const sku = body.sku || `${slug}-${id}`
  db.prepare(`INSERT INTO products (
    id, name, slug, category, gender, collection, price, compare_at_price, currency, stock,
    rating, reviews, featured, is_new, is_limited, is_best_seller, is_on_sale, material, sku,
    description, quality, colors_json, sizes_json, images_json, active, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, body.name, slug, body.category, body.gender, body.collection, body.price,
    body.compareAtPrice, 'USD', body.stock,
    body.rating ?? 4.5, body.reviews ?? 0,
    body.featured ? 1 : 0, body.isNew ? 1 : 0, body.isLimited ? 1 : 0,
    body.isBestSeller ? 1 : 0, body.isOnSale ? 1 : 0, body.material, sku, body.description, body.quality,
    JSON.stringify(body.colors), JSON.stringify(body.sizes), JSON.stringify([]),
    body.active ? 1 : 0, nowIso(), nowIso(),
  )
  audit(req.auth.username, 'product.create', 'products', id, `Creó ${body.name}`)
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.status(201).json({ product: toProduct(row, { admin: true }) })
})

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  const body = productBody(req.body)
  if (!body.name) return res.status(422).json({ error: 'El nombre es obligatorio' })
  const slug = uniqueSlug(body.name, row.id)
  const sku = body.sku || `${slug}-${row.id}`
  db.prepare(`UPDATE products SET
    name = ?, slug = ?, category = ?, gender = ?, collection = ?, price = ?, compare_at_price = ?,
    stock = ?, rating = ?, reviews = ?, featured = ?, is_new = ?, is_limited = ?, is_best_seller = ?,
    is_on_sale = ?, material = ?, sku = ?, description = ?, quality = ?, colors_json = ?, sizes_json = ?, active = ?, updated_at = ?
    WHERE id = ?`).run(
    body.name, slug, body.category, body.gender, body.collection, body.price,
    body.compareAtPrice, body.stock, body.rating ?? row.rating, body.reviews ?? row.reviews,
    body.featured ? 1 : 0, body.isNew ? 1 : 0, body.isLimited ? 1 : 0,
    body.isBestSeller ? 1 : 0, body.isOnSale ? 1 : 0, body.material, sku, body.description, body.quality,
    JSON.stringify(body.colors), JSON.stringify(body.sizes), body.active ? 1 : 0, nowIso(), row.id,
  )
  audit(req.auth.username, 'product.update', 'products', row.id, `Actualizó ${body.name}`)
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(row.id)
  res.json({ product: toProduct(updated, { admin: true }) })
})

app.patch('/api/admin/products/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  const fields = []
  const params = []
  if (req.body.active !== undefined) { fields.push('active = ?'); params.push(toBool(req.body.active) ? 1 : 0) }
  if (req.body.stock !== undefined) { fields.push('stock = ?'); params.push(Math.max(0, Math.floor(toNum(req.body.stock)))) }
  if (req.body.price !== undefined) { fields.push('price = ?'); params.push(toNum(req.body.price)) }
  if (req.body.compareAtPrice !== undefined) { fields.push('compare_at_price = ?'); params.push(req.body.compareAtPrice === '' ? null : toNum(req.body.compareAtPrice)) }
  if (req.body.featured !== undefined) { fields.push('featured = ?'); params.push(toBool(req.body.featured) ? 1 : 0) }
  if (req.body.quality !== undefined) {
    if (!['original', 'turkish'].includes(req.body.quality)) return res.status(422).json({ error: 'Calidad no válida' })
    fields.push('quality = ?'); params.push(req.body.quality)
  }
  if (fields.length === 0) return res.status(422).json({ error: 'Sin cambios' })
  fields.push('updated_at = ?')
  params.push(nowIso(), row.id)
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  audit(req.auth.username, 'product.update', 'products', row.id, req.body.active !== undefined ? 'Cambió disponibilidad' : 'Actualizó precio/stock')
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(row.id)
  res.json({ product: toProduct(updated, { admin: true }) })
})

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  /* borrar también los archivos físicos de sus imágenes */
  const imgs = db.prepare('SELECT path FROM product_images WHERE product_id = ?').all(row.id)
  db.prepare('DELETE FROM products WHERE id = ?').run(row.id)
  for (const im of imgs) {
    const file = join(UPLOADS_DIR, im.path.replace('/uploads/', ''))
    try { if (existsSync(file)) unlinkSync(file) } catch { /* ignorar */ }
  }
  audit(req.auth.username, 'product.delete', 'products', row.id, `Eliminó ${row.name}`)
  res.json({ ok: true })
})

/* ---------------- admin: orders ---------------- */

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

app.get('/api/admin/orders', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim()
  const period = String(req.query.period ?? '').trim()
  const { start } = periodRange(period)
  let rows
  const demo = String(req.query.demo ?? '')
  const demoClause = demo === 'exclude' ? ' AND is_demo = 0' : demo === 'only' ? ' AND is_demo = 1' : ''
  if (status && start) {
    rows = db.prepare(`SELECT * FROM orders WHERE status = ?${demoClause} AND created_at >= ? ORDER BY created_at DESC`).all(status, start.toISOString())
  } else if (status) {
    rows = db.prepare(`SELECT * FROM orders WHERE status = ?${demoClause} ORDER BY created_at DESC`).all(status)
  } else if (start) {
    rows = db.prepare(`SELECT * FROM orders WHERE${demoClause} created_at >= ? ORDER BY created_at DESC`).all(start.toISOString())
  } else {
    rows = db.prepare(`SELECT * FROM orders WHERE 1 = 1${demoClause} ORDER BY created_at DESC`).all()
  }
  const orderItemCount = db.prepare('SELECT order_id, COUNT(*) AS n, SUM(quantity) AS qty FROM order_items GROUP BY order_id')
  const counts = Object.fromEntries(orderItemCount.all().map((r) => [r.order_id, { n: r.n, qty: r.qty }]))
  res.json({
    items: rows.map((o) => ({ ...o, itemCount: counts[o.id]?.n ?? 0, quantity: counts[o.id]?.qty ?? 0 })),
  })
})

app.get('/api/admin/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  res.json({ order: { ...order, items } })
})

app.patch('/api/admin/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  const status = String(req.body.status ?? '')
  if (!ORDER_STATUSES.includes(status)) return res.status(422).json({ error: 'Estado inválido' })
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id)
  audit(req.auth.username, 'order.status', 'orders', order.number, `${order.status} → ${status}`)
  res.json({ ok: true, status })
})

app.post('/api/admin/orders', requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const info = req.body.customer ?? {}
  if (items.length === 0) return res.status(422).json({ error: 'El pedido debe tener al menos un artículo' })
  if (!String(info.name ?? '').trim()) return res.status(422).json({ error: 'El nombre del cliente es obligatorio' })

  const method = String(req.body.shipping ?? 'standard')
  const threshold = toNum(getSetting('free_shipping_threshold', '300'))
  const flat = toNum(getSetting('flat_shipping', '15'))
  const express = toNum(getSetting('express_shipping', '30'))

  const prepared = []
  for (const it of items) {
    const qty = Math.max(1, Math.floor(toNum(it.quantity, 1)))
    const row = db.prepare('SELECT * FROM products WHERE (slug = ? OR id = ?)').get(it.id, it.id)
    if (!row) return res.status(422).json({ error: `Producto no encontrado: ${it.id}` })
    if (row.stock < qty) return res.status(409).json({ error: `Stock insuficiente para ${row.name} (hay ${row.stock})` })
    prepared.push({ row, qty, size: String(it.size ?? 'M'), color: String(it.color ?? 'Black') })
  }

  const subtotal = prepared.reduce((s, p) => s + p.row.price * p.qty, 0)
  let shipping = 0
  if (method === 'express') shipping = express
  else if (method === 'standard') shipping = subtotal >= threshold ? 0 : flat
  else shipping = 0

  const code = String(req.body.promoCode ?? '').trim().toUpperCase()
  let discount = 0
  let couponCode = null
  if (code) {
    const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code)
    const vigente = c && (!c.expires_at || new Date(c.expires_at + 'T23:59:59Z').getTime() >= Date.now())
    const disponible = c && (c.max_uses == null || c.used_count < c.max_uses)
    if (c && vigente && disponible && subtotal >= c.min_subtotal) {
      discount = cents((subtotal * c.percent) / 100)
      couponCode = code
    }
  }
  const total = cents(subtotal + shipping - discount)

  if (String(info.email ?? '').trim()) {
    db.prepare(`
      INSERT INTO customers (name, email, phone, city, country)
      VALUES (?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name, phone = excluded.phone, city = excluded.city, country = excluded.country
    `).run(
      String(info.name).trim(), String(info.email ?? '').trim().toLowerCase(),
      String(info.phone ?? '').trim(), String(info.city ?? '').trim(), String(info.country ?? '').trim(),
    )
  }

  let number = ''
  do {
    number = `S-${String(Math.floor(100000 + Math.random() * 899999))}`
  } while (db.prepare('SELECT id FROM orders WHERE number = ?').get(number))

  const orderRes = db.prepare(`INSERT INTO orders (
    number, customer_name, customer_email, customer_phone, ship_city, ship_country,
    ship_address, ship_zip, subtotal_usd, shipping_usd, discount_usd, total_usd, currency,
    coupon_code, status, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    number, String(info.name).trim(), String(info.email ?? '').trim().toLowerCase(),
    String(info.phone ?? '').trim(), String(info.city ?? '').trim(), String(info.country ?? '').trim(),
    String(info.address ?? '').trim(), String(info.zip ?? '').trim(),
    cents(subtotal), shipping, discount, total, 'USD', couponCode, 'pending', nowIso(),
  )
  const orderId = Number(orderRes.lastInsertRowid)
  const adminCustomerId = resolveCustomer(info)
  db.prepare('UPDATE orders SET customer_id = ? WHERE id = ?').run(adminCustomerId, orderId)
  touchCustomerAfterOrder(adminCustomerId, nowIso())

  const itemIns = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, size, color, quantity, price_usd, image) VALUES (?,?,?,?,?,?,?,?)',
  )
  const stockUpd = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?')
  for (const p of prepared) {
    itemIns.run(orderId, p.row.id, p.row.name, p.size, p.color, p.qty, p.row.price, null)
    stockUpd.run(p.qty, nowIso(), p.row.id)
  }

  audit(req.auth.username, 'order.create', 'orders', number, `Creó pedido ${number} por ${total} USD`)

  const order = {
    id: orderId,
    number,
    status: 'pending',
    total,
    customer_name: String(info.name).trim(),
    customer_email: String(info.email ?? '').trim().toLowerCase(),
    customer_phone: String(info.phone ?? '').trim() || null,
    ship_city: String(info.city ?? '').trim() || null,
    ship_country: String(info.country ?? '').trim() || null,
    ship_address: String(info.address ?? '').trim() || null,
    ship_zip: String(info.zip ?? '').trim() || null,
    subtotal_usd: cents(subtotal),
    shipping_usd: shipping,
    discount_usd: discount,
    total_usd: total,
    currency: 'USD',
    coupon_code: couponCode,
    created_at: nowIso(),
    itemCount: prepared.length,
    quantity: prepared.reduce((s, p) => s + p.qty, 0),
  }
  res.status(201).json({ ok: true, order })
})

app.delete('/api/admin/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  const stockUpd = db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?')
  db.exec('BEGIN')
  try {
    for (const it of items) {
      if (it.product_id) stockUpd.run(it.quantity, nowIso(), it.product_id)
    }
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id)
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  audit(req.auth.username, 'order.delete', 'orders', order.number, `Eliminó pedido ${order.number}`)
  res.json({ ok: true })
})

/* ---------------- admin: settings, coupons, social, customers, audit ---------------- */

app.get('/api/admin/settings', requireAuth, (_req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings ORDER BY key').all()
  res.json({ settings: Object.fromEntries(settings.map((r) => [r.key, r.value])), coupons: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() })
})

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const body = req.body ?? {}
  const allowed = [
    'company_name', 'company_tagline', 'company_email', 'company_phone',
    'company_whatsapp', 'company_address', 'default_currency', 'free_shipping_threshold',
    'flat_shipping', 'express_shipping', 'instagram_url', 'announcement_bar',
  ]
  const upd = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')')
  for (const k of allowed) {
    if (body[k] !== undefined) upd.run(k, String(body[k]))
  }
  audit(req.auth.username, 'settings.update', 'settings', null, 'Actualizó configuración')
  res.json({ ok: true })
})

app.post('/api/admin/coupons', requireAuth, (req, res) => {
  const code = String(req.body.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return res.status(422).json({ error: 'Código inválido' })
  const percent = Math.min(100, Math.max(0, Math.floor(toNum(req.body.percent))))
  if (!percent) return res.status(422).json({ error: 'Porcentaje inválido' })
  const min = toNum(req.body.minSubtotal, 0)
  db.prepare('INSERT OR REPLACE INTO coupons (code, percent, min_subtotal, active, created_at) VALUES (?,?,?,?, COALESCE((SELECT created_at FROM coupons WHERE code = ?), datetime(\'now\')))')
    .run(code, percent, min, toBool(req.body.active ?? true) ? 1 : 0, code)
  audit(req.auth.username, 'coupon.create', 'coupons', code, `${code} ${percent}%`)
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code)
  res.status(201).json({ coupon: row })
})

app.patch('/api/admin/coupons/:code', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(req.params.code)
  if (!row) return res.status(404).json({ error: 'Cupón no encontrado' })
  const fields = []
  const params = []
  if (req.body.percent !== undefined) { fields.push('percent = ?'); params.push(Math.min(100, Math.max(0, Math.floor(toNum(req.body.percent))))) }
  if (req.body.minSubtotal !== undefined) { fields.push('min_subtotal = ?'); params.push(toNum(req.body.minSubtotal)) }
  if (req.body.active !== undefined) { fields.push('active = ?'); params.push(toBool(req.body.active) ? 1 : 0) }
  if (fields.length === 0) return res.status(422).json({ error: 'Sin cambios' })
  params.push(row.code)
  db.prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE code = ?`).run(...params)
  audit(req.auth.username, 'coupon.update', 'coupons', row.code)
  res.json({ coupon: db.prepare('SELECT * FROM coupons WHERE code = ?').get(row.code) })
})

app.delete('/api/admin/coupons/:code', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM coupons WHERE code = ?').get(req.params.code)
  if (!row) return res.status(404).json({ error: 'Cupón no encontrado' })
  db.prepare('DELETE FROM coupons WHERE code = ?').run(row.code)
  audit(req.auth.username, 'coupon.delete', 'coupons', row.code)
  res.json({ ok: true })
})

app.get('/api/admin/subscribers', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all() })
})

app.delete('/api/admin/subscribers/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id)
  audit(req.auth.username, 'subscriber.delete', 'subscribers', req.params.id)
  res.json({ ok: true })
})

app.get('/api/admin/contacts', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all() })
})

app.delete('/api/admin/contacts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id)
  audit(req.auth.username, 'contact.delete', 'contacts', req.params.id)
  res.json({ ok: true })
})

app.get('/api/admin/customers', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (
        SELECT COUNT(DISTINCT o.id) FROM orders o
        WHERE o.customer_id = c.id OR (o.customer_id IS NULL AND o.customer_email = c.email)
      ) AS order_count,
      (
        SELECT COALESCE(SUM(o.total_usd), 0) FROM orders o
        WHERE (o.customer_id = c.id OR (o.customer_id IS NULL AND o.customer_email = c.email))
          AND o.status != 'cancelled'
      ) AS total_spent_calc
    FROM customers c ORDER BY total_spent_calc DESC
  `).all()
  const items = rows.map((r) => ({ ...r, total_spent: r.total_spent_calc }))
  res.json({ items })
})

app.get('/api/admin/reviews', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim()
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const where = []
  const params = []
  if (status) { where.push('r.status = ?'); params.push(status) }
  if (q) {
    where.push("(LOWER(r.name) LIKE ? OR LOWER(r.comment) LIKE ? OR LOWER(COALESCE(p.name,'')) LIKE ?)")
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const sql = `SELECT r.*, p.name AS product_name, p.slug AS product_slug
    FROM reviews r LEFT JOIN products p ON p.id = r.product_id${where.length ? ' WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC, r.id DESC LIMIT 300`
const items = db.prepare(sql).all(...params)
  const counts = db.prepare('SELECT status, COUNT(*) AS n FROM reviews GROUP BY status').all()
  const demo = db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE is_demo = 1').get().n
  res.json({
    items,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    demoCount: demo,
  })
})

/* Vacía el contenido de demostración (reseñas, pedidos y cupones inventados).
   Solo se permite si no hay pedidos ni reseñas reales: es una operación de
   limpieza, no un borrado rutinario. */
app.post('/api/admin/demo/purge', requireAuth, (req, res) => {
  const scope = String(req.body.scope ?? 'reviews')
  const realOrders = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE is_demo = 0').get().n
  const realReviews = db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE is_demo = 0').get().n

  if (scope === 'reviews') {
    if (realReviews > 0) {
      return res.status(409).json({
        error: 'Hay reseñas reales en la base. Revísalas y bórralas una a una si no las necesitas.',
        realReviews,
      })
    }
    const n = db.prepare('DELETE FROM reviews WHERE is_demo = 1').run().changes
    audit(req.auth.username, 'demo.purge', 'reviews', null, `Eliminó ${n} reseñas de demostración`)
    return res.json({ ok: true, removed: { reviews: n } })
  }

  if (scope === 'orders') {
    if (realOrders > 0) {
      return res.status(409).json({
        error: 'Hay pedidos reales en la base. La limpieza de pedidos demo se hace cuando no quede ninguno real.',
        realOrders,
      })
    }
    const delItems = db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)').run().changes
    const n = db.prepare('DELETE FROM orders WHERE is_demo = 1').run().changes
    db.prepare('DELETE FROM customers WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)').run()
    audit(req.auth.username, 'demo.purge', 'orders', null, `Eliminó ${n} pedidos de demostración`)
    return res.json({ ok: true, removed: { orders: n, orderItems: delItems } })
  }

  return res.status(422).json({ error: 'Ámbito no válido' })
})

function reviewBody(body) {
  const rating = Math.round(toNum(body.rating, 5))
  return {
    name: String(body.name ?? '').trim().slice(0, 60),
    city: String(body.city ?? '').trim().slice(0, 60) || null,
    rating,
    comment: String(body.comment ?? '').trim().slice(0, 800),
    productId: String(body.productId ?? '').trim() || null,
    status: ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'approved',
  }
}

function validateReview(r) {
  if (r.name.length < 2) return 'El nombre es obligatorio'
  if (r.rating < 1 || r.rating > 5) return 'Calificación inválida'
  if (r.comment.length < 4) return 'El comentario debe tener al menos 4 caracteres'
  if (r.productId && !db.prepare('SELECT id FROM products WHERE id = ? OR slug = ?').get(r.productId, r.productId))
    return 'Producto no válido'
  return null
}

app.post('/api/admin/reviews', requireAuth, (req, res) => {
  const r = reviewBody(req.body)
  const err = validateReview(r)
  if (err) return res.status(422).json({ error: err })
  const result = db.prepare("INSERT INTO reviews (name, city, rating, comment, product_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))")
    .run(r.name, r.city, r.rating, r.comment, r.productId, r.status)
  audit(req.auth.username, 'review.create', 'reviews', String(result.lastInsertRowid), `${r.name} · ${r.rating} · ${r.status}`)
  res.status(201).json({ review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid) })
})

app.put('/api/admin/reviews/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  const r = reviewBody(req.body)
  const err = validateReview(r)
  if (err) return res.status(422).json({ error: err })
  db.prepare("UPDATE reviews SET name=?, city=?, rating=?, comment=?, product_id=?, status=?, updated_at=datetime('now') WHERE id=?")
    .run(r.name, r.city, r.rating, r.comment, r.productId, r.status, row.id)
  audit(req.auth.username, 'review.update', 'reviews', row.id, `${r.name} · ${r.status}`)
  res.json({ review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(row.id) })
})

app.patch('/api/admin/reviews/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  if (!['pending', 'approved', 'rejected'].includes(req.body.status))
    return res.status(422).json({ error: 'Estado no válido' })
  db.prepare("UPDATE reviews SET status=?, updated_at=datetime('now') WHERE id=?").run(req.body.status, row.id)
  audit(req.auth.username, 'review.moderate', 'reviews', row.id, `${row.name} → ${req.body.status}`)
  res.json({ ok: true })
})

app.delete('/api/admin/reviews/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  db.prepare('DELETE FROM reviews WHERE id = ?').run(row.id)
  audit(req.auth.username, 'review.delete', 'reviews', row.id, `Eliminó reseña de ${row.name}`)
  res.json({ ok: true })
})

app.get('/api/admin/audit', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 60').all() })
})

/* ---------------- misc ---------------- */

/* Pasarela de pago: sesión, webhook y estado. */
app.use('/api/payments', paymentRoutes({ db, audit, getSetting, nowIso, rateLimit, toNum }))

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La foto es demasiado grande (máx. 5 MB por imagen)' })
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

/* ---------------- static frontend + uploads (production) ---------------- */

mkdirSync(UPLOADS_DIR, { recursive: true })
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', index: false, fallthrough: false }))

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => res.json({ ok: true, service: 'sultan-black-api' }))
}

/* Cierre limpio: el WAL se fusiona para que el archivo .db quede completo. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[servidor] ${signal} recibido, cerrando...`)
    checkpoint()
    process.exit(0)
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SULTAN BLACK API escuchando en http://0.0.0.0:${PORT}`)
  console.log('Admin: /admin')
})
