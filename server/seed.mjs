import { initDb, db, nowIso } from './db.mjs'
import { scryptSync, timingSafeEqual } from 'node:crypto'

process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning') return
  console.warn(w)
})

initDb()

/* ---------------- helpers ---------------- */

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password, salt, expected) {
  const hash = scryptSync(password, salt, 64)
  const buf = Buffer.from(expected, 'hex')
  return hash.length === buf.length && timingSafeEqual(hash, buf)
}

const has = (o) => o !== undefined && o !== null

/* ---------------- products (mirror of src/data/products.ts) ---------------- */

const twoColors = [
  { id: 'black', name: 'Black', hex: '#111111' },
  { id: 'gold', name: 'Gold', hex: '#C9A227' },
]
const metals = [
  { id: 'gold', name: 'Gold', hex: '#C9A227' },
  { id: 'silver', name: 'Silver', hex: '#C0C0C0' },
]

// [name, gender, category, collection, price, compareAt, stock, { colors?, material?, limited?, best?, sale? }]
const RAW = [
  /* MEN · NEW */
  ['Bosphorus Overshirt', 'men', 'shirts', 'new', 890, null, 24, { colors: twoColors, material: 'Moleskin cotton, matte gunmetal buttons' }],
  ['Galata Technical Jacket', 'men', 'jackets', 'new', 1450, null, 12, { material: 'Three-layer bonded shell, taped seams' }],
  ['Hagia Grand Palazzo Pants', 'men', 'trousers', 'new', 620, null, 30],
  ['Anatolia Merino Polo', 'men', 'tshirts', 'new', 340, null, 40],
  ['Ottoman Peak Shirt', 'men', 'shirts', 'new', 780, 920, 15, { colors: twoColors, sale: true }],
  ['Sultan Sheen Trench', 'men', 'coats', 'new', 2180, null, 8, { limited: true }],
  /* MEN · PREMIUM */
  ['Sultan Black Jacket', 'men', 'jackets', 'premium', 1250, null, 18, { best: true }],
  ['Topkapi Velvet Blazer', 'men', 'jackets', 'premium', 1590, null, 10],
  ['Marmara Heavyweight Shirt', 'men', 'shirts', 'premium', 690, 820, 22, { sale: true }],
  ['Beyoglu Slim Jeans', 'men', 'jeans', 'premium', 480, null, 45, { best: true }],
  ['Cappadocia Cashmere Crew', 'men', 'hoodies', 'premium', 940, null, 16, { material: 'Pure Mongolian cashmere, rib-knit collar' }],
  ['Edirne Pleated Trousers', 'men', 'trousers', 'premium', 560, null, 28],
  ['Bosphorus Zip Hoodie', 'men', 'hoodies', 'premium', 610, 700, 26, { sale: true }],
  /* MEN · LIMITED */
  ['Imperial Edition Double Coat', 'men', 'coats', 'limited', 3400, null, 6, { limited: true, material: 'Double-faced Italian wool, silk lining' }],
  ['Ottoman Monogram Shirt', 'men', 'shirts', 'limited', 1100, null, 9, { limited: true }],
  ['Golden Gate Overshirt', 'men', 'shirts', 'limited', 980, null, 7, { limited: true, colors: metals }],
  /* MEN · BEST SELLERS */
  ['Beyoglu Distressed Jeans', 'men', 'jeans', 'bestsellers', 520, null, 50, { best: true }],
  ['Kadikoy Essential Tee', 'men', 'tshirts', 'bestsellers', 190, 230, 80, { best: true, sale: true }],
  ['Galata Oversized Tee', 'men', 'tshirts', 'bestsellers', 240, null, 70, { best: true }],
  ['Harem Cotton Shirt', 'men', 'shirts', 'bestsellers', 620, null, 34, { best: true }],
  ['Republic Track Pant', 'men', 'trousers', 'bestsellers', 380, null, 44],
  ['Brass Chain Bracelet', 'men', 'accessories', 'bestsellers', 260, null, 60, { sizes: ['OS'], colors: metals, material: 'Solid brass, gold or silver finish' }],
  /* MEN · OFFERS */
  ['Sublime Wool Overcoat', 'men', 'coats', 'offers', 1740, 2600, 9, { sale: true }],
  ['Vintage Washed Chino', 'men', 'trousers', 'offers', 290, 400, 52, { sale: true }],
  ['Classic Piped Shirt', 'men', 'shirts', 'offers', 350, 480, 38, { sale: true }],
  ['Tribute Denim Jacket', 'men', 'jackets', 'offers', 640, 850, 20, { sale: true }],
  /* WOMEN · NEW */
  ['Galata Silk Slip Dress', 'women', 'dresses', 'new', 1180, null, 14, { material: 'Bias-cut silk charmeuse' }],
  ['Bosphorus Column Dress', 'women', 'dresses', 'new', 1350, null, 9],
  ['Optima Blazer Dress', 'women', 'dresses', 'new', 980, null, 12],
  ['Marmara Longline Blazer', 'women', 'jackets', 'new', 890, null, 18],
  ['Kadikoy Flowing Skirt', 'women', 'skirts', 'new', 470, null, 26],
  ['Anatolia Fitted Vest', 'women', 'sets', 'new', 720, 850, 11, { sale: true }],
  /* WOMEN · PREMIUM */
  ['Sultan Hourglass Coat', 'women', 'coats', 'premium', 1890, null, 7, { best: true }],
  ['Seraglio Satin Set', 'women', 'sets', 'premium', 1240, null, 10],
  ['Ottoman Drape Jacket', 'women', 'jackets', 'premium', 1080, null, 15],
  ['Golden Henna Dress', 'women', 'dresses', 'premium', 1450, 1700, 8, { sale: true }],
  ['Beyoglu Sculpt Trousers', 'women', 'trousers', 'premium', 520, null, 24],
  ['Cham Silk Shirt', 'women', 'shirts', 'premium', 740, null, 19],
  /* WOMEN · LIMITED */
  ['Imperial Silk Gown', 'women', 'dresses', 'limited', 4200, null, 4, { limited: true, material: 'Hand-finished silk, gold-thread embroidery' }],
  ['Harem Pearl Cardigan', 'women', 'hoodies', 'limited', 980, null, 6, { limited: true }],
  ['Skyline Embroidered Blazer', 'women', 'jackets', 'limited', 1560, null, 5, { limited: true }],
  /* WOMEN · BEST SELLERS */
  ['Bosphorus Wrap Dress', 'women', 'dresses', 'bestsellers', 860, null, 22, { best: true }],
  ['Essential Silk Tee', 'women', 'tshirts', 'bestsellers', 220, 260, 66, { best: true, sale: true }],
  ['Galata Pleated Skirt', 'women', 'skirts', 'bestsellers', 520, null, 30, { best: true }],
  ['Sultan Wide Leg Pants', 'women', 'trousers', 'bestsellers', 580, null, 21],
  /* WOMEN · OFFERS */
  ['Romantic Silk Camisole', 'women', 'tshirts', 'offers', 240, 320, 48, { sale: true }],
  ['Bride Hallovers Mini', 'women', 'dresses', 'offers', 590, 780, 26, { sale: true }],
  ['Satin Scarf — Gold Edge', 'women', 'accessories', 'offers', 180, 240, 90, { sizes: ['OS'], colors: twoColors, material: 'Pure silk twill', sale: true }],
  ['Leather Belt — Serif Buckle', 'women', 'accessories', 'offers', 320, 450, 40, { sizes: ['OS'], sale: true }],
]

const DEFAULT_TEXT = (collection) =>
  `Part of the SULTAN BLACK ${collection.toUpperCase()} collection. Cut from selected premium fabrics with exacting Turkish craftsmanship, engineered for a refined silhouette and enduring wear.`

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n
  if (count > 0) {
    console.log(`seed: products already present (${count}), skipping`)
    return
  }
  const insert = db.prepare(`INSERT INTO products (
    id, name, slug, category, gender, collection, price, compare_at_price, currency, stock,
    rating, reviews, featured, is_new, is_limited, is_best_seller, is_on_sale, material, sku, description,
    colors_json, sizes_json, images_json, active, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const seq = { n: 0 }
  for (const [name, gender, category, collection, price, compareAt, stock, opts = {}] of RAW) {
    seq.n += 1
    const id = `SB-${String(seq.n).padStart(3, '0')}`
    const slug = slugify(name)
    const featured = has(opts.featured) ? opts.featured : collection === 'premium' || collection === 'limited'
    const isNew = collection === 'new'
    const isLimited = has(opts.limited) ? opts.limited : collection === 'limited'
    const isBestSeller = has(opts.best) ? opts.best : collection === 'bestsellers'
    const isOnSale = has(opts.sale) ? opts.sale : !!compareAt
    const sizes = opts.sizes ?? (category === 'accessories' ? ['OS'] : ['S', 'M', 'L', 'XL', 'XXL'])
    const colors = opts.colors ?? [{ id: 'black', name: 'Black', hex: '#111111' }]
    insert.run(
      id, name, slug, category, gender, collection, price, compareAt ?? null, 'USD', stock,
      Number((4.5 + (seq.n % 10) / 10).toFixed(2)), 18 + seq.n,
      featured ? 1 : 0, isNew ? 1 : 0, isLimited ? 1 : 0, isBestSeller ? 1 : 0, isOnSale ? 1 : 0,
      opts.material ?? 'Premium cotton blend', `${slug}-${id}`, opts.description ?? DEFAULT_TEXT(collection),
      JSON.stringify(colors), JSON.stringify(sizes), JSON.stringify([]),
      1, nowIso(), nowIso(),
    )
  }
  console.log(`seed: ${RAW.length} products inserted`)
}

function seedCategories() {
  const categories = [
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
  const insert = db.prepare('INSERT OR IGNORE INTO categories (id, label_en, label_es, label_tr, sort) VALUES (?,?,?,?,?)')
  categories.forEach(([id, en, es, tr], i) => insert.run(id, en, es, tr, i))
}

function seedSettings() {
  const values = {
    company_name: 'SULTAN BLACK',
    company_tagline: 'Where Turkish Craft Meets Modern Luxury',
    company_email: 'sales@sultanblack.com',
    company_phone: '+57 311 7317614',
    company_whatsapp: '+57 311 7317614',
    company_address: 'Istanbul, Türkiye',
    default_currency: 'COP',
    free_shipping_threshold: '300',
    flat_shipping: '15',
    express_shipping: '45',
    instagram_url: 'https://www.instagram.com/sultanblack_store',
  }
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)')
  Object.entries(values).forEach(([k, v]) => insert.run(k, String(v)))
}

function seedCoupons() {
  const insert = db.prepare('INSERT OR IGNORE INTO coupons (code, percent, min_subtotal, active) VALUES (?,?,?,1)')
  const rows = [
    ['SULTAN10', 10, 0],
    ['SULTAN20', 20, 0],
    ['LUXE', 15, 150],
  ]
  rows.forEach((r) => insert.run(...r))
}

function seedAdmin() {
  const existing = db.prepare("SELECT id FROM admin_users WHERE username = 'admin'").get()
  if (existing) return
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const hash = hashPassword('sultan2026', salt)
  db.prepare('INSERT INTO admin_users (username, name, role, password_hash, salt) VALUES (?,?,?,?,?)').run(
    'admin', 'Administrador', 'ADMIN', hash, salt,
  )
  console.log('seed: admin user created (username: admin, password: sultan2026)')
}

function seedSocial() {
  const sub = db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)')
  ;['sofia.marti@demo.co', 'industry@select.co', 'the.connosieur@gmail.com'].forEach((e) => sub.run(e))
  const c = db.prepare('INSERT INTO contacts (name, email, subject, message) VALUES (?,?,?,?)')
  c.run('Mariana Ortiz', 'mariana.ortiz@gmail.com', 'Consulta de tallas', 'Hola, ¿el jacket Sultan Black está disponible en talla M?')
  c.run('James Whitfield', 'jwhitfield@outlook.com', 'Envíos internacionales', '¿Hacen envíos a Canadá? ¿Cuál es el tiempo estimado?')
  c.run('Aylin Demir', 'aylin.d@icloud.com', 'Colaboración', 'Soy stylist en Estambul y me encantaría una colaboración para la próxima temporada.')
}

/* ---------------- demo customers + orders ---------------- */

const DEMO_ORDERS = [
  { name: 'Camila Restrepo', email: 'camila.restrepo@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 165, status: 'delivered', items: [['Kadikoy Essential Tee', 2]] },
  { name: 'Andrés Jiménez', email: 'andres.j@demo.co', city: 'Medellín', country: 'Colombia', daysAgo: 158, status: 'delivered', items: [['Bosphorus Overshirt', 1], ['Republic Track Pant', 1]] },
  { name: 'Laura Vanegas', email: 'laura.v@demo.co', city: 'Cali', country: 'Colombia', daysAgo: 149, status: 'delivered', items: [['Galata Silk Slip Dress', 1]] },
  { name: 'Diego Salazar', email: 'diego.s@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 132, status: 'delivered', coupon: 'SULTAN10', items: [['Sultan Black Jacket', 1]] },
  { name: 'Sofía Martínez', email: 'sofia.marti@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 118, status: 'delivered', items: [['Bosphorus Wrap Dress', 1], ['Satin Scarf — Gold Edge', 1]] },
  { name: 'James Whitfield', email: 'jwhitfield@outlook.com', city: 'Toronto', country: 'Canada', daysAgo: 104, status: 'delivered', items: [['Imperial Edition Double Coat', 1]] },
  { name: 'Valentina Ríos', email: 'valentina.r@demo.co', city: 'Barranquilla', country: 'Colombia', daysAgo: 87, status: 'delivered', coupon: 'SULTAN20', items: [['Imperial Silk Gown', 1]] },
  { name: 'Mateo Álvarez', email: 'mateo.av@demo.co', city: 'Medellín', country: 'Colombia', daysAgo: 61, status: 'shipped', items: [['Galata Technical Jacket', 1]] },
  { name: 'Camila Restrepo', email: 'camila.restrepo@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 45, status: 'delivered', items: [['Beyoglu Slim Jeans', 1], ['Anatolia Merino Polo', 1]] },
  { name: 'Natalia Gómez', email: 'natalia.g@demo.co', city: 'Pereira', country: 'Colombia', daysAgo: 27, status: 'confirmed', coupon: 'LUXE', items: [['Sultan Hourglass Coat', 1]] },
  { name: 'Daniel Prieto', email: 'daniel.p@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 14, status: 'pending', items: [['Cappadocia Cashmere Crew', 1]] },
  { name: 'Carolina Peña', email: 'carolina.p@demo.co', city: 'Cali', country: 'Colombia', daysAgo: 6, status: 'pending', items: [['Ottoman Drape Jacket', 1]] },
  { name: 'Andrés Jiménez', email: 'andres.j@demo.co', city: 'Medellín', country: 'Colombia', daysAgo: 3, status: 'pending', coupon: 'SULTAN10', items: [['Golden Henna Dress', 1]] },
  { name: 'Julia Ramos', email: 'julia.r@demo.co', city: 'Bogotá', country: 'Colombia', daysAgo: 1, status: 'pending', items: [['Leather Belt — Serif Buckle', 1], ['Essential Silk Tee', 1]] },
]

function seedDemoOrders() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n
  if (count > 0) {
    console.log(`seed: orders already present (${count}), skipping`)
    return
  }
  const getProduct = (name) =>
    db.prepare('SELECT id, name, price, compare_at_price FROM products WHERE name = ?').get(name)
  const customerIns = db.prepare(
    'INSERT INTO customers (name, email, phone, city, country) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING',
  )
  const orderIns = db.prepare(`INSERT INTO orders (
    number, customer_name, customer_email, customer_phone, ship_city, ship_country,
    ship_address, ship_zip, subtotal_usd, shipping_usd, discount_usd, total_usd, currency,
    coupon_code, status, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const itemIns = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, size, color, quantity, price_usd, image) VALUES (?,?,?,?,?,?,?,?)',
  )

  const now = Date.now()
  let n = 0
  for (const o of DEMO_ORDERS) {
    const createdAt = new Date(now - o.daysAgo * 86400000).toISOString().replace('T', ' ').slice(0, 19)
    const customer = customerIns.run(o.name, o.email, null, o.city, o.country)
    const snap = []
    let subtotal = 0
    for (const [pname, qty] of o.items) {
      const p = getProduct(pname)
      if (!p) continue
      snap.push({ id: p.id, name: p.name, qty, price: p.price })
      subtotal += p.price * qty
    }
    if (snap.length === 0) continue
    const shipping = subtotal >= 300 ? 0 : 15
    const coupon = o.coupon ?? null
    let percent = 0
    if (coupon) {
      const c = db.prepare('SELECT percent FROM coupons WHERE code = ? AND active = 1').get(coupon)
      percent = c ? c.percent : 0
    }
    const discount = Math.round((subtotal * percent) / 100)
    const total = Math.round(subtotal + shipping - discount)
    const number = `S-${String(10000 + n).padStart(6, '0')}`
    const res = orderIns.run(
      number, o.name, o.email, null, o.city, o.country, 'Calle de demostración 123', '110111',
      subtotal, shipping, discount, total, 'USD', coupon, o.status, createdAt,
    )
    for (const s of snap) {
      itemIns.run(res.lastInsertRowid, s.id, s.name, 'M', 'Black', s.qty, s.price, null)
    }
    n += 1
  }
  console.log(`seed: ${n} demo orders inserted`)
}

export function seedAll() {
  seedProducts()
  seedCategories()
  seedSettings()
  seedCoupons()
  seedAdmin()
  seedSocial()
  seedDemoOrders()
  console.log('seed: done')
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seedAll()
  console.log('Seed completed. Run `npm run server` to start the API.')
}