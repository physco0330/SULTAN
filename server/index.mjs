import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { db, initDb, audit, nowIso } from './db.mjs'
import { seedAll } from './seed.mjs'

process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning') return
  console.warn(w)
})

const PORT = Number(process.env.PORT || 4001)
const JWT_SECRET = process.env.SULTAN_SECRET || 'sultan-black-demo-secret-2026'
const TOKEN_TTL = '12h'

initDb()
seedAll()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

/* ---------------- utils ---------------- */

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const toNum = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true'

const asArray = (v) => {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.flatMap((x) => String(x).split(','))
  return String(v).split(',')
}

function toProduct(row) {
  if (!row) return null
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
    rating: row.rating,
    reviews: row.reviews,
    featured: !!row.featured,
    isNew: !!row.is_new,
    isLimited: !!row.is_limited,
    isBestSeller: !!row.is_best_seller,
    isOnSale: !!row.is_on_sale,
    material: row.material,
    sku: row.sku,
    description: row.description,
    colors: JSON.parse(row.colors_json || '[]'),
    sizes: JSON.parse(row.sizes_json || '[]'),
    images: row.image_base_url ? [{ src: `${row.image_base_url}/${row.slug}-0.jpg`, alt: `${row.name} — front view` }] : [],
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}

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
  }
}

function verifyPassword(password, salt, expected) {
  const hash = scryptSync(password, salt, 64)
  const buf = Buffer.from(expected, 'hex')
  return hash.length === buf.length && timingSafeEqual(hash, buf)
}

function signAuth(user) {
  return jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' })
  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
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
  res.json(rows)
})

app.get('/api/coupons/validate', (req, res) => {
  const code = String(req.query.code ?? '').trim().toUpperCase()
  const subtotal = toNum(req.query.subtotal)
  if (!code) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'missing' })
  const row = db.prepare('SELECT code, percent, min_subtotal, active FROM coupons WHERE code = ?').get(code)
  if (!row) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'invalid' })
  if (!row.active) return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'inactive' })
  if (subtotal < row.min_subtotal)
    return res.json({ valid: false, code, percent: 0, discount: 0, reason: 'min-subtotal', minSubtotal: row.min_subtotal })
  const discount = Math.round((subtotal * row.percent) / 100)
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
  const q = String(req.query.q ?? '').trim().toLowerCase()
  const min = req.query.min !== undefined ? toNum(req.query.min) : null
  const max = req.query.max !== undefined ? toNum(req.query.max) : null

  const where = ['active = 1']
  const params = []
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
  if (q) {
    where.push('(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(material) LIKE ? OR category = ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, q)
  }
  if (min !== null) { where.push('price >= ?'); params.push(min) }
  if (max !== null) { where.push('price <= ?'); params.push(max) }

  let sql = `SELECT * FROM products WHERE ${where.join(' AND ')}`
  const sort = String(req.query.sort ?? 'featured')
  const orderBy =
    sort === 'price-asc' ? 'price ASC'
    : sort === 'price-desc' ? 'price DESC'
    : sort === 'newest' ? 'is_new DESC, created_at DESC'
    : sort === 'rated' ? 'rating DESC'
    : 'featured DESC, rating DESC'
  sql += ` ORDER BY ${orderBy}`

  const rows = db.prepare(sql).all(...params)
  let items = rows.map(toProduct)
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

app.post('/api/orders', (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : []
  const info = req.body.customer ?? {}
  if (items.length === 0) return res.status(422).json({ error: 'El carrito está vacío' })
  if (!String(info.email ?? '').trim() || !String(info.name ?? '').trim())
    return res.status(422).json({ error: 'Datos de contacto requeridos' })

  const prepared = []
  for (const it of items) {
    const qty = Math.max(1, Math.floor(toNum(it.quantity, 1)))
    const row = db.prepare('SELECT * FROM products WHERE (slug = ? OR id = ?) AND active = 1').get(it.id, it.id)
    if (!row) return res.status(422).json({ error: `Producto no disponible: ${it.id}` })
    if (row.stock < qty) return res.status(409).json({ error: `Stock insuficiente para ${row.name}` })
    prepared.push({ row, qty, size: String(it.size ?? 'M'), color: String(it.color ?? 'Black') })
  }

  const subtotal = prepared.reduce((s, p) => s + p.row.price * p.qty, 0)
  const threshold = toNum(getSetting('free_shipping_threshold', '300'))
  const flat = toNum(getSetting('flat_shipping', '15'))
  const shipping = subtotal >= threshold ? 0 : flat

  const code = String(req.body.promoCode ?? '').trim().toUpperCase()
  let discount = 0
  let couponCode = null
  if (code) {
    const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code)
    if (c && subtotal >= c.min_subtotal) {
      discount = Math.round((subtotal * c.percent) / 100)
      couponCode = code
    }
  }
  const total = Math.round(subtotal + shipping - discount)

  const upsert = db.prepare(`
    INSERT INTO customers (name, email, phone, city, country)
    VALUES (?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name, phone = excluded.phone, city = excluded.city, country = excluded.country
  `).run(
    String(info.name).trim(), String(info.email).trim().toLowerCase(),
    String(info.phone ?? '').trim(), String(info.city ?? '').trim(), String(info.country ?? '').trim(),
  )

  let number = ''
  do {
    number = `S-${String(Math.floor(100000 + Math.random() * 899999))}`
  } while (db.prepare('SELECT id FROM orders WHERE number = ?').get(number))

  const orderRes = db.prepare(`INSERT INTO orders (
    number, customer_name, customer_email, customer_phone, ship_city, ship_country,
    ship_address, ship_zip, subtotal_usd, shipping_usd, discount_usd, total_usd, currency,
    coupon_code, status, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    number, String(info.name).trim(), String(info.email).trim().toLowerCase(),
    String(info.phone ?? '').trim(), String(info.city ?? '').trim(), String(info.country ?? '').trim(),
    String(info.address ?? '').trim(), String(info.zip ?? '').trim(),
    Math.round(subtotal), shipping, discount, total, 'USD', couponCode, 'pending', nowIso(),
  )
  const orderId = Number(orderRes.lastInsertRowid)

  const itemIns = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, size, color, quantity, price_usd, image) VALUES (?,?,?,?,?,?,?,?)',
  )
  const stockUpd = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?')
  for (const p of prepared) {
    itemIns.run(orderId, p.row.id, p.row.name, p.size, p.color, p.qty, p.row.price, null)
    stockUpd.run(p.qty, nowIso(), p.row.id)
  }

  audit('cliente', 'order.create', 'orders', number, `Pedido ${number} por ${subtotal} USD`)

  res.status(201).json({
    ok: true,
    order: {
      number,
      status: 'pending',
      createdAt: nowIso(),
      customer: { name: info.name, email: info.email },
      totals: { subtotal, shipping, discount, total, currency: 'USD' },
    },
  })
})

app.get('/api/orders/:number', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(req.params.number)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })
  const rows = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  const items = rows.map((r) => ({
    productId: r.product_id, name: r.name, size: r.size, color: r.color,
    quantity: r.quantity, price: r.price_usd, image: r.image,
  }))
  res.json({ order: { ...order, items } })
})

/* ---------------- public: contact & newsletter ---------------- */

app.post('/api/contact', (req, res) => {
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

app.post('/api/newsletter', (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: 'Email inválido' })
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email)
  res.status(201).json({ ok: true })
})

/* ---------------- public: reviews ---------------- */

app.get('/api/reviews', (_req, res) => {
  const rows = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC, id DESC LIMIT 50').all()
  res.json({ items: rows })
})

app.post('/api/reviews', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const city = String(req.body.city ?? '').trim()
  const rating = Math.round(toNum(req.body.rating, 5))
  const comment = String(req.body.comment ?? '').trim()
  if (!name || name.length > 60) return res.status(422).json({ error: 'Nombre requerido' })
  if (rating < 1 || rating > 5) return res.status(422).json({ error: 'Calificación inválida' })
  if (comment.length < 4 || comment.length > 800) return res.status(422).json({ error: 'El comentario debe tener al menos 4 caracteres' })
  db.prepare('INSERT INTO reviews (name, city, rating, comment) VALUES (?,?,?,?)').run(name, city || null, rating, comment)
  audit(null, 'review.create', 'reviews', null, `${name} dejó una reseña de ${rating}★`)
  res.status(201).json({ ok: true })
})

/* ---------------- admin: auth ---------------- */

app.post('/api/admin/auth/login', (req, res) => {
  const username = String(req.body.username ?? '').trim()
  const password = String(req.body.password ?? '')
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username)
  if (!user || !verifyPassword(password, user.salt, user.password_hash))
    return res.status(401).json({ error: 'Credenciales inválidas' })
  const token = signAuth(user)
  audit(user.username, 'auth.login', 'admin_users', user.username)
  res.json({ token, user: { username: user.username, name: user.name, role: user.role } })
})

app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.auth.username, name: req.auth.name, role: req.auth.role } })
})

/* ---------------- admin: dashboard ---------------- */

/* ---------------- admin: stats ---------------- */

function periodRange(period) {
  const now = new Date()
  const startOfDay = () => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  switch (period) {
    case 'week': {
      const start = startOfDay()
      start.setDate(start.getDate() - 6)
      const prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 7)
      return { start, prevStart, label: 'Últimos 7 días' }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start, prevStart, label: 'Mes actual' }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const prevStart = new Date(now.getFullYear() - 1, 0, 1)
      return { start, prevStart, label: 'Año actual' }
    }
    default:
      return { start: null, prevStart: null, label: 'Todo el historial' }
  }
}

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const period = String(req.query.period ?? 'all').trim()
  const { start, prevStart, label } = periodRange(period)
  const base = "SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND created_at >= ?"
  const revenue = start === null
    ? db.prepare("SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled'").get()
    : db.prepare(base).get(start.toISOString())
  const previousRevenue = prevStart === null || start === null
    ? null
    : db.prepare("SELECT COALESCE(SUM(total_usd),0) AS total, COUNT(*) AS n FROM orders WHERE status != 'cancelled' AND created_at >= ? AND created_at < ?")
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
       FROM orders WHERE status != 'cancelled' AND strftime('%Y-%m', created_at) = ?`,
    ).get(month)
    months.push({ month, label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), orders: row.orders, revenue: Math.round(row.revenue) })
  }

  const orderOffset = start === null ? '0' : '8'
  const recent = start === null
    ? db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8').all()
    : db.prepare('SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT 8').all(start.toISOString())
  const lowStock = db.prepare(
    'SELECT * FROM products WHERE active = 1 AND stock > 0 AND stock <= 8 ORDER BY stock ASC LIMIT 8',
  ).all().map(toProduct)

  const top = db.prepare(`
    SELECT oi.product_id, oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price_usd) AS revenue
    FROM order_items oi GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 5
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
  res.json({ items: rows.map(toProduct) })
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
    description, colors_json, sizes_json, images_json, active, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, body.name, slug, body.category, body.gender, body.collection, body.price,
    body.compareAtPrice, 'USD', body.stock,
    body.rating ?? 4.5, body.reviews ?? 0,
    body.featured ? 1 : 0, body.isNew ? 1 : 0, body.isLimited ? 1 : 0,
    body.isBestSeller ? 1 : 0, body.isOnSale ? 1 : 0, body.material, sku, body.description,
    JSON.stringify(body.colors), JSON.stringify(body.sizes), JSON.stringify([]),
    body.active ? 1 : 0, nowIso(), nowIso(),
  )
  audit(req.auth.username, 'product.create', 'products', id, `Creó ${body.name}`)
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  res.status(201).json({ product: toProduct(row) })
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
    is_on_sale = ?, material = ?, sku = ?, description = ?, colors_json = ?, sizes_json = ?, active = ?, updated_at = ?
    WHERE id = ?`).run(
    body.name, slug, body.category, body.gender, body.collection, body.price,
    body.compareAtPrice, body.stock, body.rating ?? row.rating, body.reviews ?? row.reviews,
    body.featured ? 1 : 0, body.isNew ? 1 : 0, body.isLimited ? 1 : 0,
    body.isBestSeller ? 1 : 0, body.isOnSale ? 1 : 0, body.material, sku, body.description,
    JSON.stringify(body.colors), JSON.stringify(body.sizes), body.active ? 1 : 0, nowIso(), row.id,
  )
  audit(req.auth.username, 'product.update', 'products', row.id, `Actualizó ${body.name}`)
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(row.id)
  res.json({ product: toProduct(updated) })
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
  if (fields.length === 0) return res.status(422).json({ error: 'Sin cambios' })
  fields.push('updated_at = ?')
  params.push(nowIso(), row.id)
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  audit(req.auth.username, 'product.update', 'products', row.id, req.body.active !== undefined ? 'Cambió disponibilidad' : 'Actualizó precio/stock')
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(row.id)
  res.json({ product: toProduct(updated) })
})

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  db.prepare('DELETE FROM products WHERE id = ?').run(row.id)
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
  if (status && start) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? AND created_at >= ? ORDER BY created_at DESC').all(status, start.toISOString())
  } else if (status) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status)
  } else if (start) {
    rows = db.prepare('SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC').all(start.toISOString())
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()
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
    if (c && subtotal >= c.min_subtotal) {
      discount = Math.round((subtotal * c.percent) / 100)
      couponCode = code
    }
  }
  const total = Math.round(subtotal + shipping - discount)

  if (String(info.email ?? '').trim()) {
    db.prepare(`
      INSERT INTO customers (name, email, phone, city, country)
      VALUES (?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name, phone = excluded.phone, city = excluded.city, country = excluded.country
    `).run(
      String(info.name).trim(), String(info.email).trim().toLowerCase(),
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
    Math.round(subtotal), shipping, discount, total, 'USD', couponCode, 'pending', nowIso(),
  )
  const orderId = Number(orderRes.lastInsertRowid)

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
    subtotal_usd: Math.round(subtotal),
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
    'flat_shipping', 'express_shipping', 'instagram_url',
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
    SELECT c.*, COUNT(DISTINCT o.id) AS order_count, COALESCE(SUM(o.total_usd),0) AS total_spent
    FROM customers c LEFT JOIN orders o ON o.customer_email = c.email
    GROUP BY c.id ORDER BY total_spent DESC
  `).all()
  res.json({ items: rows })
})

app.get('/api/admin/reviews', requireAuth, (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM reviews ORDER BY created_at DESC, id DESC LIMIT 200').all() })
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

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`SULTAN BLACK API escuchando en http://localhost:${PORT}`)
  console.log(`Admin: http://localhost:5174/admin  (admin / sultan2026)`)
})