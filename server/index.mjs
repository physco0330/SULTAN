import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { scryptSync, timingSafeEqual, randomBytes, createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { audit, cents, cmpStr, recentAudit, StoreError, toBool, toNum } from './store/core.mjs'
import * as products from './store/products.mjs'
import * as orders from './store/orders.mjs'
import * as content from './store/content.mjs'
import { destroyImage, uploadProductImage, uploadSiteImage } from './cloudinary.mjs'
import { registerProvider } from './payments/index.mjs'
import { demoProvider } from './payments/providers/demo.mjs'
import { paymentRoutes } from './payments/routes.mjs'
import { sendOrderConfirmation, notifyNewOrder } from './mailer.mjs'
import { PORT, SULTAN_SECRET, allowedOrigins, describeConfig } from './config.mjs'
import { seedAll } from './seed.mjs'

process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning') return
  console.warn(w)
})

/* Se valida la configuracion ANTES de tocar nada: es preferible no arrancar.
   Se hace primero para poder reportar TODOS los problemas de una vez. */
const configReport = describeConfig()
if (!configReport.ok) {
  console.error('[config] configuracion invalida: corrige lo anterior antes de arrancar.')
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

/* Conexión a Firestore y valores por defecto (categorías, colecciones, ajustes). */
try {
  await seedAll()
} catch (err) {
  console.error(`[firestore] no se pudo conectar o inicializar la base: ${err.message}`)
  process.exit(1)
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
app.use('/api/admin/settings/philosophy-image', express.json({ limit: '12mb' }))
app.use('/api/admin/settings/category-image', express.json({ limit: '12mb' }))
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
  return { buf, mime: sig.mime, ext: sig.ext }
}

/* ---------------- utils ---------------- */

const slugId = (v) =>
  String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const asArray = (v) => {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.flatMap((x) => String(x).split(','))
  return String(v).split(',')
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

/**
 * Normaliza el cuerpo de un producto.
 * - `partial: false` (crear): todas las claves, con valores por defecto.
 * - `partial: true` (actualizar): SOLO las claves enviadas; el resto se conserva
 *   en la base de datos. Así un PUT parcial nunca pone en 0 el precio ni borra
 *   la descripción o el material.
 */
function productBody(body, { partial = false } = {}) {
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(body, k)
  const out = {}
  if (has('name')) out.name = String(body.name ?? '').trim()
  if (has('category')) out.category = String(body.category ?? 'tshirts').trim()
  if (has('gender')) out.gender = ['men', 'women', 'unisex'].includes(body.gender) ? body.gender : 'unisex'
  if (has('collection')) out.collection = String(body.collection ?? 'new').trim()
  if (has('price')) out.price = toNum(body.price)
  if (has('compareAtPrice')) {
    const raw = body.compareAtPrice
    const n = raw === undefined || raw === null || raw === '' ? 0 : toNum(raw)
    out.compareAtPrice = n > 0 ? n : null
  }
  if (has('stock')) out.stock = Math.max(0, Math.floor(toNum(body.stock)))
  if (has('featured')) out.featured = toBool(body.featured)
  if (has('isNew')) out.isNew = toBool(body.isNew)
  if (has('isLimited')) out.isLimited = toBool(body.isLimited)
  if (has('isBestSeller')) out.isBestSeller = toBool(body.isBestSeller)
  if (has('isOnSale')) out.isOnSale = toBool(body.isOnSale)
  if (has('isCombo')) out.isCombo = toBool(body.isCombo)
  if (has('comboItems')) {
    out.comboItems = Array.isArray(body.comboItems)
      ? body.comboItems
          .map((it) => ({
            productId: String(it?.productId ?? '').trim(),
            name: String(it?.name ?? '').trim(),
            qty: Math.max(1, Math.floor(toNum(it?.qty) || 1)),
          }))
          .filter((it) => it.productId || it.name)
          .slice(0, 20)
      : []
  }
  if (has('material')) out.material = String(body.material ?? '').trim() || 'Premium cotton blend'
  if (has('sku')) out.sku = String(body.sku ?? '').trim()
  if (has('description')) out.description = String(body.description ?? '').trim()
  if (has('quality')) out.quality = body.quality === 'original' ? 'original' : 'turkish'
  if (has('colors')) out.colors = Array.isArray(body.colors) ? body.colors : []
  if (has('sizes')) out.sizes = Array.isArray(body.sizes) ? body.sizes : []
  if (has('active')) out.active = body.active === undefined ? true : toBool(body.active)
  return out
}

/* Mismo cálculo que el tracking público: solo quien recibe el token puede consultar. */
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

/** Respuesta uniforme para errores de la capa de datos o de negocio. */
function storeFailure(res, err, what, fallback) {
  if (err instanceof StoreError) return res.status(err.status).json({ error: err.message })
  console.error(`[${what}] error:`, err)
  return res.status(500).json({ error: fallback })
}

/* ---------------- public: config & meta ---------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sultan-black-api', time: new Date().toISOString() }))

app.get('/api/config', async (_req, res) => {
  const s = await content.loadSettings()
  const get = (key, fallback = '') => (Object.prototype.hasOwnProperty.call(s, key) ? s[key] : fallback)
  res.json({
    companyName: get('company_name', 'SULTAN BLACK'),
    companyTagline: get('company_tagline', 'Where Turkish Craft Meets Modern Luxury'),
    companyEmail: get('company_email'),
    companyPhone: get('company_phone'),
    companyWhatsapp: get('company_whatsapp'),
    companyAddress: get('company_address'),
    defaultCurrency: get('default_currency', 'USD'),
    freeShippingThreshold: toNum(get('free_shipping_threshold', '300')),
    flatShipping: toNum(get('flat_shipping', '15')),
    expressShipping: toNum(get('express_shipping', '45')),
    instagramUrl: get('instagram_url'),
    announcements: get('announcement_bar').split('|').map((x) => x.trim()).filter(Boolean),
    philosophyTitle: get('philosophy_title'),
    philosophyText: get('philosophy_text'),
    philosophyImage1: get('philosophy_image_1'),
    philosophyImage2: get('philosophy_image_2'),
    categoryImages: ['1', '2', '3', '4'].map((n) => get(`category_image_${n}`)),
    philosophyItems: (() => {
      try {
        const arr = JSON.parse(get('philosophy_items') || '[]')
        if (!Array.isArray(arr)) return []
        return arr
          .map((x) => ({ icon: String(x?.icon ?? ''), title: String(x?.title ?? ''), desc: String(x?.desc ?? '') }))
          .filter((x) => x.title || x.desc)
      } catch {
        return []
      }
    })(),
  })
})

app.get('/api/categories', async (_req, res) => {
  res.json({ items: await content.listCategories() })
})

app.get('/api/coupons/validate', async (req, res) => {
  const code = String(req.query.code ?? '').trim().toUpperCase().slice(0, 20)
  const subtotal = toNum(req.query.subtotal)
  if (!code) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'missing' })
  const row = await content.getCoupon(code)
  if (!row) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'invalid' })
  const reason = content.couponReason(row, subtotal)
  if (reason === 'min_subtotal') {
    return res.json({ valid: false, code, percent: 0, discount: 0, reason, minSubtotal: row.min_subtotal })
  }
  if (reason) return res.json({ valid: false, code, percent: 0, discount: 0, reason })
  const discount = cents((subtotal * row.percent) / 100)
  res.json({ valid: true, code, percent: row.percent, discount, minSubtotal: row.min_subtotal })
})

/* ---------------- public: products ---------------- */

app.get('/api/products', async (req, res) => {
  const filters = {
    gender: asArray(req.query.gender),
    category: asArray(req.query.category),
    collection: asArray(req.query.collection),
    size: asArray(req.query.size),
    color: asArray(req.query.color),
    availability: asArray(req.query.availability),
    quality: asArray(req.query.quality),
    q: String(req.query.q ?? '').trim().toLowerCase(),
    min: req.query.min !== undefined ? toNum(req.query.min) : null,
    max: req.query.max !== undefined ? toNum(req.query.max) : null,
    sort: String(req.query.sort ?? 'featured'),
  }
  const womenEnabled = (await content.getSetting('module_women', '0')) === '1'
  res.json(await products.listPublic(filters, womenEnabled))
})

app.get('/api/products/:slug', async (req, res) => {
  const product = await products.getPublicProduct(req.params.slug)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })
  res.json({ product })
})

/* ---------------- public: checkout ---------------- */

app.post('/api/orders', rateLimit('orders', 20), async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const info = req.body.customer ?? {}
  if (items.length === 0) return res.status(422).json({ error: 'El carrito está vacío' })
  if (!String(info.email ?? '').trim() || !String(info.name ?? '').trim())
    return res.status(422).json({ error: 'Datos de contacto requeridos' })

  const lines = []
  for (const it of items) {
    const qty = Math.max(1, Math.floor(toNum(it.quantity, 1)))
    if (qty > 50) return res.status(422).json({ error: 'Cantidad no permitida' })
    const row = await products.findProductRef(it.id)
    if (!row || !row.active) return res.status(422).json({ error: `Producto no disponible: ${it.id}` })
    if (row.stock < qty) return res.status(409).json({ error: `Stock insuficiente para ${row.name}` })
    lines.push({ product: row, qty, size: String(it.size ?? 'M').slice(0, 8), color: String(it.color ?? 'Black').slice(0, 40) })
  }

  /* Un solo cupón por pedido: si el cliente envía una lista, se rechaza. */
  if (Array.isArray(req.body.promoCode) || Array.isArray(req.body.promoCodes))
    return res.status(422).json({ error: 'Solo se permite un cupón por pedido' })
  const promo = String(req.body.promoCode ?? '').trim().toUpperCase().slice(0, 20)
  const threshold = toNum(await content.getSetting('free_shipping_threshold', '300'))
  const flat = toNum(await content.getSetting('flat_shipping', '15'))

  let placed
  try {
    placed = await orders.placeOrder({
      lines,
      info,
      promoCode: promo || null,
      requireActive: true,
      shippingFor: (subtotal) => (subtotal >= threshold ? 0 : flat),
    })
  } catch (err) {
    return storeFailure(res, err, 'pedido', 'No se pudo registrar el pedido')
  }

  const { order, items: orderItems, customerId, totals } = placed
  await audit('cliente', 'order.create', 'orders', order.number, `Pedido ${order.number} por ${totals.subtotal} USD`)
  if (customerId) await audit('cliente', 'customer.auto', 'customers', String(customerId), `Cliente vinculado al pedido ${order.number}`)

  /* Notificaciones: email al cliente y aviso al negocio. */
  sendOrderConfirmation(order, orderItems).catch((e) => console.warn('[correo] confirmación al cliente:', e.message))
  notifyNewOrder(order, orderItems).catch((e) => console.warn('[correo] notificación al negocio:', e.message))

  res.status(201).json({
    ok: true,
    order: {
      number: order.number,
      status: 'pending',
      createdAt: order.created_at,
      customer: { name: order.customer_name },
      trackingToken: trackingToken(order.number),
      totals: { subtotal: totals.subtotal, shipping: totals.shipping, discount: totals.discount, total: totals.total, currency: 'USD' },
    },
  })
})

/**
 * Consulta publica del estado de un pedido.
 * Exige el token entregado al crear el pedido: sin el no se revela nada, asi
 * los numeros de pedido no son enumerables ni exponen PII.
 */
app.get('/api/orders/:number', rateLimit('track', 30), async (req, res) => {
  const number = String(req.params.number ?? '').trim().toUpperCase()
  const token = String(req.query.token ?? req.headers['x-order-token'] ?? '').trim()
  const order = await orders.findByNumber(number)
  /* Misma respuesta para "no existe" y "token incorrecto": no revelamos cuales hay. */
  if (!order || !token || !tokenMatches(token, trackingToken(order.number)))
    return res.status(404).json({ error: 'No se encontró un pedido con esos datos' })

  const rows = await orders.itemsOf(order.id)
  res.json({
    order: {
      number: order.number,
      status: order.status,
      createdAt: order.created_at,
      shipCity: order.ship_city ? String(order.ship_city).slice(0, 60) : null,
      items: rows.map((r) => ({ name: r.name, size: r.size, color: r.color, quantity: r.quantity, price: r.price_usd })),
      totals: {
        subtotal: order.subtotal_usd, shipping: order.shipping_usd,
        discount: order.discount_usd, total: order.total_usd, currency: order.currency,
      },
    },
  })
})

/* ---------------- public: contact & newsletter ---------------- */

app.post('/api/contact', rateLimit('contact', 10), async (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const email = String(req.body.email ?? '').trim()
  const subject = String(req.body.subject ?? '').trim()
  const message = String(req.body.message ?? '').trim()
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(422).json({ error: 'Datos inválidos' })
  if (!message) return res.status(422).json({ error: 'Mensaje requerido' })
  await content.createContact({ name, email, subject, message })
  await audit(null, 'contact.create', 'contacts', email, `${name} envió un mensaje`)
  res.status(201).json({ ok: true })
})

app.post('/api/newsletter', rateLimit('newsletter', 15), async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: 'Email inválido' })
  await content.addSubscriber(email)
  res.status(201).json({ ok: true })
})

/* ---------------- public: reviews ---------------- */

app.get('/api/reviews', async (req, res) => {
  res.json(await content.listPublicReviews(String(req.query.product ?? '').trim()))
})

app.post('/api/reviews', async (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const city = String(req.body.city ?? '').trim()
  const rating = Math.round(toNum(req.body.rating, 5))
  const comment = String(req.body.comment ?? '').trim()
  const productId = String(req.body.productId ?? '').trim()
  if (!name || name.length > 60) return res.status(422).json({ error: 'Nombre requerido' })
  if (rating < 1 || rating > 5) return res.status(422).json({ error: 'Calificación inválida' })
  if (comment.length < 4 || comment.length > 800) return res.status(422).json({ error: 'El comentario debe tener al menos 4 caracteres' })
  const product = productId ? await products.findProductRef(productId) : null
  if (productId && !product) return res.status(422).json({ error: 'Producto no válido' })
  /* Se publican al instante; el admin puede eliminarlas desde el panel. */
  await content.createPublicReview({ name, city, rating, comment, productId: product?.id ?? null })
  await audit(null, 'review.create', 'reviews', null, name + ' - publicada')
  res.status(201).json({ ok: true, status: 'approved' })
})

/* ---------------- admin: imágenes del catálogo ---------------- */

app.get('/api/admin/images', requireAuth, async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  res.json({ items: await products.listAdminImages(q) })
})

app.get('/api/admin/products/:id/images', requireAuth, async (req, res) => {
  res.json({ items: await products.listProductImages(req.params.id) })
})

app.post('/api/admin/products/:id/images', requireAuth, rateLimit('upload', 60), async (req, res) => {
  const product = await products.getProductRow(req.params.id)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })

  const incoming = Array.isArray(req.body.images) ? req.body.images : [req.body]
  if (incoming.length === 0) return res.status(422).json({ error: 'No se recibieron imágenes' })
  if (incoming.length > 10) return res.status(422).json({ error: 'Máximo 10 imágenes por solicitud' })

  const decoded = []
  for (const item of incoming) {
    const d = decodeBase64Image(item?.data)
    if (!d || d.error) return res.status(422).json({ error: d?.error ?? 'Imagen inválida' })
    decoded.push({
      ...d,
      alt: String(item?.alt ?? '').trim().slice(0, 160),
      status: IMAGE_STATUSES.includes(item?.status) ? item.status : 'published',
    })
  }

  const uploaded = []
  let saved
  try {
    for (const d of decoded) uploaded.push(await uploadProductImage(d.buf, product.id))
    saved = await products.addProductImages(
      product.id,
      decoded.map((d, i) => ({ path: uploaded[i].url, publicId: uploaded[i].publicId, alt: d.alt, status: d.status })),
    )
  } catch (err) {
    await Promise.all(uploaded.map((u) => destroyImage(u.publicId)))
    if (err instanceof StoreError) return res.status(err.status).json({ error: err.message })
    console.error('[upload imagen]', err)
    return res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }

  await audit(req.auth.username, 'image.upload', 'product_images', product.id, `Subió ${saved.length} imagen(es) para ${product.name}`)
  res.status(201).json({ items: saved })
})

/* Copia las fotos de las prendas de un combo (sube copias propias a Cloudinary
 * para que borrar el combo nunca borre las fotos de las prendas originales). */
app.post('/api/admin/products/:id/combo-images', requireAuth, rateLimit('upload', 60), async (req, res) => {
  const product = await products.getProductRow(req.params.id)
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' })

  const sourceIds = Array.isArray(req.body.productIds)
    ? [...new Set(req.body.productIds.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, 12)
    : []
  if (sourceIds.length === 0) return res.status(422).json({ error: 'Elige al menos una prenda para el combo' })

  const sources = await products.publishedImagesForProducts(sourceIds)
  if (sources.length === 0) return res.status(422).json({ error: 'Las prendas elegidas no tienen fotos publicadas' })

  const existing = await products.listProductImages(product.id)
  const existingUrls = new Set(existing.map((im) => im.path))

  const perProduct = new Map()
  const selected = []
  for (const im of sources) {
    const used = perProduct.get(im.product_id) ?? 0
    if (used >= 4) continue
    perProduct.set(im.product_id, used + 1)
    if (existingUrls.has(im.path)) continue
    selected.push(im)
    if (selected.length >= 12) break
  }
  if (selected.length === 0) return res.status(422).json({ error: 'Las fotos de esas prendas ya están en el combo' })

  const uploaded = []
  try {
    for (const im of selected) {
      const r = await fetch(im.path)
      if (!r.ok) throw new Error(`No se pudo descargar la foto ${im.path}`)
      const buf = Buffer.from(await r.arrayBuffer())
      uploaded.push(await uploadProductImage(buf, product.id))
    }
    const saved = await products.addProductImages(
      product.id,
      selected.map((im, i) => ({
        path: uploaded[i].url,
        publicId: uploaded[i].publicId,
        alt: im.alt || product.name,
        status: 'published',
      })),
    )
    await audit(req.auth.username, 'image.upload', 'product_images', product.id, `Combinó ${saved.length} foto(s) en ${product.name}`)
    res.status(201).json({ items: saved })
  } catch (err) {
    await Promise.all(uploaded.map((u) => destroyImage(u.publicId)))
    if (err instanceof StoreError) return res.status(err.status).json({ error: err.message })
    console.error('[combo imágenes]', err)
    return res.status(500).json({ error: 'No se pudieron combinar las fotos' })
  }
})

app.patch('/api/admin/images/:id', requireAuth, async (req, res) => {
  const image = await products.getImage(req.params.id)
  if (!image) return res.status(404).json({ error: 'Imagen no encontrada' })
  const fields = {}
  if (req.body.alt !== undefined) fields.alt = String(req.body.alt).trim().slice(0, 160)
  if (req.body.status !== undefined) {
    if (!IMAGE_STATUSES.includes(req.body.status)) return res.status(422).json({ error: 'Estado no válido' })
    fields.status = req.body.status
  }
  if (req.body.isPrimary === true) {
    await products.setPrimaryImage(image.id)
    await audit(req.auth.username, 'image.setPrimary', 'product_images', image.id)
    return res.json({ ok: true })
  }
  if (Object.keys(fields).length === 0) return res.json({ ok: true })
  await products.updateImage(image.id, fields)
  await audit(req.auth.username, 'image.update', 'product_images', image.id)
  res.json({ ok: true })
})

app.post('/api/admin/images/reorder', requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter((n) => Number.isFinite(n)) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista de imágenes vacía' })
  await products.reorderImages(ids)
  await audit(req.auth.username, 'image.reorder', 'product_images', null, `${ids.length} imágenes reordenadas`)
  res.json({ ok: true })
})

app.delete('/api/admin/images/:id', requireAuth, async (req, res) => {
  const image = await products.deleteImage(req.params.id)
  if (!image) return res.status(404).json({ error: 'Imagen no encontrada' })
  await destroyImage(image.public_id)
  await audit(req.auth.username, 'image.delete', 'product_images', image.id)
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

app.get('/api/admin/suppliers', requireAuth, async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  res.json({ items: await content.listSuppliers(q) })
})

app.post('/api/admin/suppliers', requireAuth, async (req, res) => {
  const b = supplierBody(req.body)
  if (b.company.length < 2) return res.status(422).json({ error: 'El nombre de la empresa es obligatorio' })
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return res.status(422).json({ error: 'Correo no válido' })
  const supplier = await content.createSupplier(b)
  await audit(req.auth.username, 'supplier.create', 'suppliers', String(supplier.id), `Creó proveedor ${b.company}`)
  res.status(201).json({ supplier })
})

app.put('/api/admin/suppliers/:id', requireAuth, async (req, res) => {
  const row = await content.getSupplier(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  const b = supplierBody(req.body)
  if (b.company.length < 2) return res.status(422).json({ error: 'El nombre de la empresa es obligatorio' })
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return res.status(422).json({ error: 'Correo no válido' })
  const supplier = await content.updateSupplier(row.id, b)
  await audit(req.auth.username, 'supplier.update', 'suppliers', row.id, `Actualizó proveedor ${b.company}`)
  res.json({ supplier })
})

app.patch('/api/admin/suppliers/:id', requireAuth, async (req, res) => {
  const row = await content.getSupplier(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  if (req.body.active !== undefined) await content.patchSupplier(row.id, toBool(req.body.active))
  await audit(req.auth.username, 'supplier.status', 'suppliers', row.id, `${row.company}: activo=${req.body.active}`)
  res.json({ ok: true })
})

app.delete('/api/admin/suppliers/:id', requireAuth, async (req, res) => {
  const row = await content.getSupplier(req.params.id)
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' })
  await content.deleteSupplier(row.id)
  await audit(req.auth.username, 'supplier.delete', 'suppliers', row.id, `Eliminó proveedor ${row.company}`)
  res.json({ ok: true })
})

/* ---------------- taxonomía pública: categorías y colecciones ---------------- */

app.get('/api/collections', async (_req, res) => {
  const rows = (await content.listCollections()).filter((c) => Number(c.active) === 1)
  res.json({ items: rows.map(({ id, label_es, label_en, sort }) => ({ id, label_es, label_en, sort })) })
})

/* ---------------- admin: colecciones ---------------- */

app.get('/api/admin/collections', requireAuth, async (_req, res) => {
  res.json({ items: await content.listCollections() })
})

app.post('/api/admin/collections', requireAuth, async (req, res) => {
  const labelEs = String(req.body.labelEs ?? '').trim()
  const labelEn = String(req.body.labelEn ?? '').trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la colección es obligatorio' })
  const id = req.body.id ? slugId(req.body.id) : slugId(labelEs)
  if (!id) return res.status(422).json({ error: 'Identificador no válido' })
  const collection = await content.createCollection({ id, labelEs, labelEn, active: req.body.active !== false })
  await audit(req.auth.username, 'collection.create', 'collections', id, `Creó colección ${labelEs}`)
  res.status(201).json({ collection })
})

app.put('/api/admin/collections/:id', requireAuth, async (req, res) => {
  const row = await content.getCollection(req.params.id)
  if (!row) return res.status(404).json({ error: 'Colección no encontrada' })
  const labelEs = String(req.body.labelEs ?? row.label_es).trim()
  const labelEn = String(req.body.labelEn ?? row.label_en).trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la colección es obligatorio' })
  const collection = await content.patchCollection(row.id, {
    label_es: labelEs.slice(0, 80),
    label_en: labelEn.slice(0, 80),
    sort: Number.isFinite(Number(req.body.sort)) ? Math.floor(Number(req.body.sort)) : row.sort,
    active: req.body.active === undefined ? row.active : (toBool(req.body.active) ? 1 : 0),
  })
  await audit(req.auth.username, 'collection.update', 'collections', row.id, `Actualizó colección ${labelEs}`)
  res.json({ collection })
})

app.delete('/api/admin/collections/:id', requireAuth, async (req, res) => {
  const row = await content.getCollection(req.params.id)
  if (!row) return res.status(404).json({ error: 'Colección no encontrada' })
  const used = await content.collectionInUse(row.id)
  if (used > 0) return res.status(409).json({ error: `No se puede eliminar: ${used} producto(s) usan esta colección` })
  await content.deleteCollection(row.id)
  await audit(req.auth.username, 'collection.delete', 'collections', row.id, `Eliminó colección ${row.label_es}`)
  res.json({ ok: true })
})

/* ---------------- admin: categorías ---------------- */

app.get('/api/admin/categories', requireAuth, async (_req, res) => {
  res.json({ items: await content.listCategories() })
})

app.post('/api/admin/categories', requireAuth, async (req, res) => {
  const id = slugId(req.body.id ?? req.body.labelEs ?? '')
  const labelEs = String(req.body.labelEs ?? '').trim()
  const labelEn = String(req.body.labelEn ?? '').trim() || labelEs
  if (!id) return res.status(422).json({ error: 'Identificador no válido' })
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la categoría es obligatorio' })
  const category = await content.createCategory({ id, labelEs, labelEn })
  await audit(req.auth.username, 'category.create', 'categories', id, `Creó categoría ${labelEs}`)
  res.status(201).json({ category })
})

app.put('/api/admin/categories/:id', requireAuth, async (req, res) => {
  const row = await content.getCategory(req.params.id)
  if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
  const labelEs = String(req.body.labelEs ?? row.label_es).trim()
  const labelEn = String(req.body.labelEn ?? row.label_en).trim() || labelEs
  if (labelEs.length < 2) return res.status(422).json({ error: 'El nombre de la categoría es obligatorio' })
  const category = await content.patchCategory(row.id, {
    label_es: labelEs.slice(0, 60),
    label_en: labelEn.slice(0, 60),
    label_tr: labelEs.slice(0, 60),
    sort: Number.isFinite(Number(req.body.sort)) ? Math.floor(Number(req.body.sort)) : row.sort,
  })
  await audit(req.auth.username, 'category.update', 'categories', row.id, `Actualizó categoría ${labelEs}`)
  res.json({ category })
})

app.delete('/api/admin/categories/:id', requireAuth, async (req, res) => {
  const row = await content.getCategory(req.params.id)
  if (!row) return res.status(404).json({ error: 'Categoría no encontrada' })
  const used = await content.categoryInUse(row.id)
  if (used > 0) return res.status(409).json({ error: `No se puede eliminar: ${used} producto(s) usan esta categoría` })
  await content.deleteCategory(row.id)
  await audit(req.auth.username, 'category.delete', 'categories', row.id, `Eliminó categoría ${row.label_es}`)
  res.json({ ok: true })
})

app.post('/api/admin/collections/reorder', requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista vacía' })
  await content.reorderCollections(ids)
  await audit(req.auth.username, 'collection.reorder', 'collections', null, `${ids.length} colecciones reordenadas`)
  res.json({ ok: true })
})

app.post('/api/admin/categories/reorder', requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : []
  if (ids.length === 0) return res.status(422).json({ error: 'Lista vacía' })
  await content.reorderCategories(ids)
  await audit(req.auth.username, 'category.reorder', 'categories', null, `${ids.length} categorías reordenadas`)
  res.json({ ok: true })
})

/* ---------------- admin: auth ---------------- */

app.post('/api/admin/auth/login', rateLimit('login', 10), async (req, res) => {
  const username = String(req.body.username ?? '').trim()
  const password = String(req.body.password ?? '')
  const user = await content.getAdminUser(username)
  if (!user || !verifyPassword(password, user.salt, user.password_hash))
    return res.status(401).json({ error: 'Credenciales inválidas' })
  const token = signAuth(user)
  await audit(user.username, 'auth.login', 'admin_users', user.username)
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

app.get('/api/admin/me', requireAuth, async (req, res) => {
  const row = await content.getAdminUser(req.auth.username)
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

app.post('/api/admin/auth/password', requireAuth, async (req, res) => {
  const current = String(req.body.currentPassword ?? '')
  const nextPw = String(req.body.newPassword ?? '')
  const row = await content.getAdminUser(req.auth.username)
  if (!row || !verifyPassword(current, row.salt, row.password_hash))
    return res.status(401).json({ error: 'La contraseña actual no es correcta' })
  const weak = passwordStrength(nextPw)
  if (weak) return res.status(422).json({ error: weak })
  if (verifyPassword(nextPw, row.salt, row.password_hash))
    return res.status(422).json({ error: 'La nueva contraseña debe ser distinta de la actual' })

  const salt = randomBytes(16).toString('hex')
  await content.setAdminPassword(row.username, hashPassword(nextPw, salt), salt)
  await audit(req.auth.username, 'auth.password_changed', 'admin_users', row.username, 'Contraseña actualizada')
  /* Token nuevo: el resto de la sesión queda invalidado. */
  const fresh = await content.getAdminUser(row.username)
  res.json({ ok: true, token: signAuth(fresh) })
})

/* ---------------- admin: stats ---------------- */

app.get('/api/admin/stats', requireAuth, async (req, res) => {
  const period = String(req.query.period ?? 'all').trim()
  res.json(
    await orders.computeStats({
      period,
      from: req.query.from ? String(req.query.from) : null,
      to: req.query.to ? String(req.query.to) : null,
    }),
  )
})

/* ---------------- admin: products CRUD ---------------- */

app.get('/api/admin/products', requireAuth, async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  res.json({ items: await products.listAdmin(q) })
})

app.post('/api/admin/products', requireAuth, async (req, res) => {
  const body = productBody(req.body)
  if (!body.name) return res.status(422).json({ error: 'El nombre es obligatorio' })
  const row = await products.createProduct(body)
  await audit(req.auth.username, 'product.create', 'products', row.id, `Creó ${body.name}`)
  res.status(201).json({ product: await products.shapeProduct(row, { admin: true }) })
})

app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
  const existing = await products.getProductRow(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' })
  const body = productBody(req.body, { partial: true })
  if (body.name !== undefined && !body.name) return res.status(422).json({ error: 'El nombre es obligatorio' })
  const row = await products.updateProduct(existing.id, body)
  await audit(req.auth.username, 'product.update', 'products', row.id, `Actualizó ${row.name}`)
  res.json({ product: await products.shapeProduct(row, { admin: true }) })
})

app.patch('/api/admin/products/:id', requireAuth, async (req, res) => {
  const existing = await products.getProductRow(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' })
  const row = await products.patchProduct(existing.id, req.body)
  await audit(req.auth.username, 'product.update', 'products', row.id, req.body.active !== undefined ? 'Cambió disponibilidad' : 'Actualizó precio/stock')
  res.json({ product: await products.shapeProduct(row, { admin: true }) })
})

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  const removed = await products.deleteProduct(req.params.id)
  if (!removed) return res.status(404).json({ error: 'Producto no encontrado' })
  await Promise.all(removed.images.map((im) => destroyImage(im.public_id)))
  await audit(req.auth.username, 'product.delete', 'products', removed.product.id, `Eliminó ${removed.product.name}`)
  res.json({ ok: true })
})

/* ---------------- admin: orders ---------------- */

app.get('/api/admin/orders', requireAuth, async (req, res) => {
  res.json({
    items: await orders.listAdminOrders({
      status: String(req.query.status ?? '').trim(),
      period: String(req.query.period ?? '').trim(),
      demo: String(req.query.demo ?? ''),
    }),
  })
})

app.get('/api/admin/orders/:id', requireAuth, async (req, res) => {
  const order = await orders.getOrderWithItems(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  res.json({ order })
})

app.patch('/api/admin/orders/:id', requireAuth, async (req, res) => {
  const current = await orders.getOrder(req.params.id)
  if (!current) return res.status(404).json({ error: 'Orden no encontrada' })
  const status = String(req.body.status ?? '')
  if (!orders.ORDER_STATUSES.includes(status)) return res.status(422).json({ error: 'Estado inválido' })
  const result = await orders.changeStatus(current.id, status)
  await audit(req.auth.username, 'order.status', 'orders', current.number, `${result.previous} → ${status}`)
  res.json({ ok: true, status })
})

app.post('/api/admin/orders', requireAuth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const info = req.body.customer ?? {}
  if (items.length === 0) return res.status(422).json({ error: 'El pedido debe tener al menos un artículo' })
  if (!String(info.name ?? '').trim()) return res.status(422).json({ error: 'El nombre del cliente es obligatorio' })

  const method = String(req.body.shipping ?? 'standard')
  const threshold = toNum(await content.getSetting('free_shipping_threshold', '300'))
  const flat = toNum(await content.getSetting('flat_shipping', '15'))
  const express = toNum(await content.getSetting('express_shipping', '30'))

  const lines = []
  for (const it of items) {
    const qty = Math.max(1, Math.floor(toNum(it.quantity, 1)))
    const row = await products.findProductRef(it.id)
    if (!row) return res.status(422).json({ error: `Producto no encontrado: ${it.id}` })
    if (row.stock < qty) return res.status(409).json({ error: `Stock insuficiente para ${row.name} (hay ${row.stock})` })
    lines.push({ product: row, qty, size: String(it.size ?? 'M'), color: String(it.color ?? 'Black') })
  }

  const shippingFor = (subtotal) => {
    if (method === 'express') return express
    if (method === 'standard') return subtotal >= threshold ? 0 : flat
    return 0
  }
  const promo = String(req.body.promoCode ?? '').trim().toUpperCase()

  let placed
  try {
    placed = await orders.placeOrder({ lines, info, promoCode: promo || null, requireActive: false, shippingFor })
  } catch (err) {
    return storeFailure(res, err, 'pedido admin', 'No se pudo registrar el pedido')
  }

  const o = placed.order
  await audit(req.auth.username, 'order.create', 'orders', o.number, `Creó pedido ${o.number} por ${placed.totals.total} USD`)
  res.status(201).json({
    ok: true,
    order: {
      id: o.id,
      number: o.number,
      status: 'pending',
      total: placed.totals.total,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      customer_phone: o.customer_phone || null,
      ship_city: o.ship_city || null,
      ship_country: o.ship_country || null,
      ship_address: o.ship_address || null,
      ship_zip: o.ship_zip || null,
      subtotal_usd: o.subtotal_usd,
      shipping_usd: o.shipping_usd,
      discount_usd: o.discount_usd,
      total_usd: o.total_usd,
      currency: 'USD',
      coupon_code: o.coupon_code,
      created_at: o.created_at,
      itemCount: placed.items.length,
      quantity: placed.items.reduce((s, i) => s + i.quantity, 0),
    },
  })
})

app.delete('/api/admin/orders/:id', requireAuth, async (req, res) => {
  const order = await orders.deleteOrder(req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  await audit(req.auth.username, 'order.delete', 'orders', order.number, `Eliminó pedido ${order.number}`)
  res.json({ ok: true })
})

/* ---------------- admin: settings, coupons, social, customers, audit ---------------- */

app.get('/api/admin/settings', requireAuth, async (_req, res) => {
  const map = await content.loadSettings()
  const settings = Object.fromEntries(Object.entries(map).sort(([a], [b]) => cmpStr(a, b)))
  res.json({ settings, coupons: await content.listCoupons() })
})

app.put('/api/admin/settings', requireAuth, async (req, res) => {
  const body = req.body ?? {}
  const allowed = [
    'company_name', 'company_tagline', 'company_email', 'company_phone',
    'company_whatsapp', 'company_address', 'default_currency', 'free_shipping_threshold',
    'flat_shipping', 'express_shipping', 'instagram_url', 'announcement_bar',
    'philosophy_title', 'philosophy_text', 'philosophy_image_1', 'philosophy_image_2', 'philosophy_items',
    'category_image_1', 'category_image_2', 'category_image_3', 'category_image_4',
  ]
  const entries = {}
  for (const k of allowed) {
    if (body[k] !== undefined) entries[k] = body[k]
  }
  if (Object.keys(entries).length > 0) await content.saveSettings(entries)
  await audit(req.auth.username, 'settings.update', 'settings', null, 'Actualizó configuración')
  res.json({ ok: true })
})

/* Imagen de la sección "Filosofía Sultán": se sube a Cloudinary y se guarda su URL en ajustes. */
app.post('/api/admin/settings/philosophy-image', requireAuth, rateLimit('upload', 60), async (req, res) => {
  const slot = String(req.body.slot ?? '')
  if (slot !== '1' && slot !== '2') return res.status(422).json({ error: 'Posición de imagen no válida' })
  const decoded = decodeBase64Image(req.body.data)
  if (!decoded || decoded.error) return res.status(422).json({ error: decoded?.error ?? 'Imagen inválida' })
  let uploaded
  try {
    uploaded = await uploadSiteImage(decoded.buf, `philosophy-${slot}`)
  } catch (err) {
    console.error('[upload filosofía]', err)
    return res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }
  await content.saveSettings({ [`philosophy_image_${slot}`]: uploaded.url })
  await audit(req.auth.username, 'settings.image', 'settings', `philosophy_image_${slot}`, 'Actualizó imagen de filosofía')
  res.status(201).json({ url: uploaded.url })
})

/* Imágenes de las 4 tarjetas de "Diseñado en Colombia" (Inicio): se guardan por posición. */
app.post('/api/admin/settings/category-image', requireAuth, rateLimit('upload', 60), async (req, res) => {
  const slot = String(req.body.slot ?? '')
  if (!['1', '2', '3', '4'].includes(slot)) return res.status(422).json({ error: 'Posición de imagen no válida' })
  const decoded = decodeBase64Image(req.body.data)
  if (!decoded || decoded.error) return res.status(422).json({ error: decoded?.error ?? 'Imagen inválida' })
  let uploaded
  try {
    uploaded = await uploadSiteImage(decoded.buf, `category-${slot}`)
  } catch (err) {
    console.error('[upload tarjetas]', err)
    return res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }
  await content.saveSettings({ [`category_image_${slot}`]: uploaded.url })
  await audit(req.auth.username, 'settings.image', 'settings', `category_image_${slot}`, 'Actualizó imagen de tarjeta de Inicio')
  res.status(201).json({ url: uploaded.url })
})

app.post('/api/admin/coupons', requireAuth, async (req, res) => {
  const code = String(req.body.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{3,20}$/.test(code)) return res.status(422).json({ error: 'Código inválido' })
  const percent = Math.min(100, Math.max(0, Math.floor(toNum(req.body.percent))))
  if (!percent) return res.status(422).json({ error: 'Porcentaje inválido' })
  const min = toNum(req.body.minSubtotal, 0)
  const coupon = await content.upsertCoupon({ code, percent, minSubtotal: min, active: toBool(req.body.active ?? true) })
  await audit(req.auth.username, 'coupon.create', 'coupons', code, `${code} ${percent}%`)
  res.status(201).json({ coupon })
})

app.patch('/api/admin/coupons/:code', requireAuth, async (req, res) => {
  const row = await content.getCoupon(req.params.code)
  if (!row) return res.status(404).json({ error: 'Cupón no encontrado' })
  const fields = {}
  if (req.body.percent !== undefined) fields.percent = Math.min(100, Math.max(0, Math.floor(toNum(req.body.percent))))
  if (req.body.minSubtotal !== undefined) fields.min_subtotal = toNum(req.body.minSubtotal)
  if (req.body.active !== undefined) fields.active = toBool(req.body.active) ? 1 : 0
  if (Object.keys(fields).length === 0) return res.status(422).json({ error: 'Sin cambios' })
  const coupon = await content.patchCoupon(row.code, fields)
  await audit(req.auth.username, 'coupon.update', 'coupons', row.code)
  res.json({ coupon })
})

app.delete('/api/admin/coupons/:code', requireAuth, async (req, res) => {
  const row = await content.getCoupon(req.params.code)
  if (!row) return res.status(404).json({ error: 'Cupón no encontrado' })
  await content.deleteCoupon(row.code)
  await audit(req.auth.username, 'coupon.delete', 'coupons', row.code)
  res.json({ ok: true })
})

app.get('/api/admin/subscribers', requireAuth, async (_req, res) => {
  res.json({ items: await content.listSubscribers() })
})

app.delete('/api/admin/subscribers/:id', requireAuth, async (req, res) => {
  await content.deleteSubscriber(req.params.id)
  await audit(req.auth.username, 'subscriber.delete', 'subscribers', req.params.id)
  res.json({ ok: true })
})

app.get('/api/admin/contacts', requireAuth, async (_req, res) => {
  res.json({ items: await content.listContacts() })
})

app.delete('/api/admin/contacts/:id', requireAuth, async (req, res) => {
  await content.deleteContact(req.params.id)
  await audit(req.auth.username, 'contact.delete', 'contacts', req.params.id)
  res.json({ ok: true })
})

app.get('/api/admin/customers', requireAuth, async (_req, res) => {
  res.json({ items: await orders.listCustomers() })
})

app.get('/api/admin/reviews', requireAuth, async (req, res) => {
  res.json(
    await content.listAdminReviews({
      status: String(req.query.status ?? '').trim(),
      q: String(req.query.q ?? '').trim().toLowerCase(),
    }),
  )
})

/* Vacía el contenido de demostración (reseñas, pedidos y cupones inventados).
   Solo se permite si no hay pedidos ni reseñas reales: es una operación de
   limpieza, no un borrado rutinario. */
app.post('/api/admin/demo/purge', requireAuth, async (req, res) => {
  const scope = String(req.body.scope ?? 'reviews')

  if (scope === 'reviews') {
    const realReviews = await content.countRealReviews()
    if (realReviews > 0) {
      return res.status(409).json({
        error: 'Hay reseñas reales en la base. Revísalas y bórralas una a una si no las necesitas.',
        realReviews,
      })
    }
    const n = await content.purgeDemoReviews()
    await audit(req.auth.username, 'demo.purge', 'reviews', null, `Eliminó ${n} reseñas de demostración`)
    return res.json({ ok: true, removed: { reviews: n } })
  }

  if (scope === 'orders') {
    const realOrders = await orders.countRealOrders()
    if (realOrders > 0) {
      return res.status(409).json({
        error: 'Hay pedidos reales en la base. La limpieza de pedidos demo se hace cuando no quede ninguno real.',
        realOrders,
      })
    }
    const removed = await orders.purgeDemoOrders()
    await audit(req.auth.username, 'demo.purge', 'orders', null, `Eliminó ${removed.orders} pedidos de demostración`)
    return res.json({ ok: true, removed: { orders: removed.orders, orderItems: removed.orderItems } })
  }

  return res.status(422).json({ error: 'Ámbito no válido' })
})

/* Reseña del admin: el producto (si se indica) debe existir; se guarda su ID real. */
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

async function validateReview(r) {
  if (r.name.length < 2) return 'El nombre es obligatorio'
  if (r.rating < 1 || r.rating > 5) return 'Calificación inválida'
  if (r.comment.length < 4) return 'El comentario debe tener al menos 4 caracteres'
  if (r.productId) {
    const product = await products.findProductRef(r.productId)
    if (!product) return 'Producto no válido'
    r.productId = product.id
  }
  return null
}

app.post('/api/admin/reviews', requireAuth, async (req, res) => {
  const r = reviewBody(req.body)
  const err = await validateReview(r)
  if (err) return res.status(422).json({ error: err })
  const review = await content.createReview(r)
  await audit(req.auth.username, 'review.create', 'reviews', String(review.id), `${r.name} · ${r.rating} · ${r.status}`)
  res.status(201).json({ review })
})

app.put('/api/admin/reviews/:id', requireAuth, async (req, res) => {
  const row = await content.getReview(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  const r = reviewBody(req.body)
  const err = await validateReview(r)
  if (err) return res.status(422).json({ error: err })
  const review = await content.updateReview(row.id, r)
  await audit(req.auth.username, 'review.update', 'reviews', row.id, `${r.name} · ${r.status}`)
  res.json({ review })
})

app.patch('/api/admin/reviews/:id', requireAuth, async (req, res) => {
  const row = await content.getReview(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  if (!['pending', 'approved', 'rejected'].includes(req.body.status))
    return res.status(422).json({ error: 'Estado no válido' })
  await content.moderateReview(row.id, req.body.status)
  await audit(req.auth.username, 'review.moderate', 'reviews', row.id, `${row.name} → ${req.body.status}`)
  res.json({ ok: true })
})

app.delete('/api/admin/reviews/:id', requireAuth, async (req, res) => {
  const row = await content.getReview(req.params.id)
  if (!row) return res.status(404).json({ error: 'Reseña no encontrada' })
  await content.deleteReview(row.id)
  await audit(req.auth.username, 'review.delete', 'reviews', row.id, `Eliminó reseña de ${row.name}`)
  res.json({ ok: true })
})

app.get('/api/admin/audit', requireAuth, async (_req, res) => {
  res.json({ items: await recentAudit(60) })
})

/* ---------------- misc ---------------- */

/* Pasarela de pago: sesión, webhook y estado. */
app.use(
  '/api/payments',
  paymentRoutes({
    orders: { findByNumber: orders.findByNumber, changeStatusByNumber: orders.changeStatusByNumber },
    audit,
    rateLimit,
  }),
)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, _req, res, _next) => {
  if (err instanceof StoreError) return res.status(err.status).json({ error: err.message })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La foto es demasiado grande (máx. 5 MB por imagen)' })
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

/* ---------------- static frontend (production) ---------------- */

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => res.json({ ok: true, service: 'sultan-black-api' }))
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SULTAN BLACK API escuchando en http://0.0.0.0:${PORT}`)
  console.log('Admin: /admin')
})
