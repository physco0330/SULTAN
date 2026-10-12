import {
  cents,
  col,
  countOf,
  cmpStr,
  db,
  deleteRefs,
  descStr,
  findWhere,
  getOne,
  listAll,
  listWhere,
  nowIso,
  readCounter,
  StoreError,
  tsOf,
  writeCounter,
  docKey,
} from './core.mjs'
import { invalidateCatalog, loadCatalog, shape } from './products.mjs'
import { couponReason } from './content.mjs'

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

/** Pedido confirmado: el único que cuenta para ventas, ingresos, top y gasto de clientes. */
export const CONFIRMED_STATUSES = ['confirmed', 'shipped', 'delivered']
export const isConfirmed = (o) => CONFIRMED_STATUSES.includes(o.status)

/** Rango de fechas de los filtros de admin (en UTC, como el resto de fechas). */
export function periodRange(period, opts = {}) {
  const now = new Date()
  const startOfDay = () => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
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

/* Toda transacción que mueve stock invalida el catálogo público en caché. */
async function inTx(fn) {
  const out = await db().runTransaction(fn)
  invalidateCatalog()
  return out
}

/* ---------------- stock ---------------- */

/** Lee los productos de las líneas (agrupadas) dentro de una transacción. */
async function readStock(tx, items) {
  const qty = new Map()
  for (const it of items) {
    if (!it.product_id) continue
    qty.set(it.product_id, (qty.get(it.product_id) ?? 0) + Number(it.quantity))
  }
  const ids = [...qty.keys()]
  const snaps = ids.length ? await tx.getAll(...ids.map((id) => col('products').doc(id))) : []
  const stock = new Map()
  snaps.forEach((s, i) => {
    if (s.exists) stock.set(ids[i], Number(s.get('stock')) || 0)
  })
  return { qty, stock }
}

function applyStock(tx, { qty, stock }, sign, now) {
  for (const [pid, q] of qty) {
    if (!stock.has(pid)) continue
    tx.update(col('products').doc(pid), { stock: stock.get(pid) + sign * q, updated_at: now })
  }
}

/* ---------------- clientes ---------------- */

/** Datos de cliente: lo nuevo sustituye a lo viejo solo si viene con valor. */
const pick = (next, prev) => next || prev

/**
 * Crea un pedido completo en UNA transacción: revalida precio y stock, aplica
 * el cupón, crea el pedido, sus líneas, descuenta stock y actualiza el cliente.
 * Si algo falla, no queda nada escrito.
 *
 * lines: [{ product, qty, size, color }] (product = documento del catálogo)
 */
export async function placeOrder({ lines, info, promoCode, shippingFor, requireActive }) {
  const name = String(info.name ?? '').trim()
  const email = String(info.email ?? '').trim().toLowerCase()
  const phone = String(info.phone ?? '').trim()
  const city = String(info.city ?? '').trim()
  const neighborhood = String(info.neighborhood ?? '').trim().slice(0, 80)
  const country = String(info.country ?? '').trim()
  const address = String(info.address ?? '').trim()
  const zip = String(info.zip ?? '').trim()
  const document = String(info.document ?? '').trim().slice(0, 40)

  const productIds = [...new Set(lines.map((l) => l.product.id))]
  const couponKey = promoCode ? docKey(promoCode) : null

  return inTx(async (tx) => {
    /* ---- lecturas ---- */
    const prodSnaps = await tx.getAll(...productIds.map((id) => col('products').doc(id)))
    const products = new Map()
    prodSnaps.forEach((s) => {
      if (s.exists) products.set(s.id, s.data())
    })
    const couponSnap = couponKey ? await tx.get(col('coupons').doc(couponKey)) : null
    const customerSnap = email ? await tx.get(col('customers').where('email', '==', email).limit(1)) : null

    let number = ''
    for (let attempt = 0; ; attempt += 1) {
      if (attempt > 20) throw new StoreError(500, 'No se pudo generar el número de pedido')
      number = `S-${String(Math.floor(100000 + Math.random() * 899999))}`
      const dup = await tx.get(col('orders').where('number', '==', number).limit(1))
      if (dup.empty) break
    }
    const lastOrder = await readCounter(tx, 'orders')
    const lastItem = await readCounter(tx, 'order_items')
    const lastCustomer = await readCounter(tx, 'customers')

    /* ---- validación y precios con datos frescos ---- */
    const priced = lines.map((l) => {
      const p = products.get(l.product.id)
      if (!p || (requireActive && !p.active)) throw new StoreError(422, `Producto no disponible: ${l.product.name}`)
      return { ...l, row: p, price: Number(p.price) }
    })
    const needed = new Map()
    for (const l of priced) needed.set(l.product.id, (needed.get(l.product.id) ?? 0) + l.qty)
    for (const [pid, q] of needed) {
      if (products.get(pid).stock < q) {
        throw new StoreError(409, 'El stock cambió mientras se procesaba el pedido. Intenta de nuevo.')
      }
    }

    const subtotal = priced.reduce((s, l) => s + l.price * l.qty, 0)
    const shipping = shippingFor(subtotal)
    let discount = 0
    let couponCode = null
    const coupon = couponSnap && couponSnap.exists ? couponSnap.data() : null
    if (coupon && !couponReason(coupon, subtotal)) {
      discount = cents((subtotal * coupon.percent) / 100)
      couponCode = coupon.code
    }
    const total = cents(subtotal + shipping - discount)

    /* ---- cliente ---- */
    const now = nowIso()
    const existing = customerSnap && !customerSnap.empty ? customerSnap.docs[0].data() : null
    const customer = existing
      ? {
          ...existing,
          name: name || existing.name,
          phone: pick(phone, existing.phone),
          city: pick(city, existing.city),
          neighborhood: pick(neighborhood, existing.neighborhood),
          country: pick(country, existing.country),
          address: pick(address, existing.address),
          document: pick(document, existing.document),
        }
      : {
          id: lastCustomer + 1,
          name,
          email: email || null,
          phone: phone || null,
          city: city || null,
          neighborhood: neighborhood || null,
          country: country || null,
          address: address || null,
          document: document || null,
          created_at: now,
          first_order_at: null,
          last_order_at: null,
        }
    customer.first_order_at = customer.first_order_at ?? now
    customer.last_order_at = now

    /* ---- escrituras ---- */
    const orderId = lastOrder + 1
    const order = {
      id: orderId,
      number,
      customer_id: customer.id,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      ship_city: city,
      ship_neighborhood: neighborhood,
      ship_country: country,
      ship_address: address,
      ship_zip: zip,
      subtotal_usd: cents(subtotal),
      shipping_usd: shipping,
      discount_usd: discount,
      total_usd: total,
      currency: 'USD',
      coupon_code: couponCode,
      status: 'pending',
      is_demo: 0,
      created_at: now,
    }
    tx.set(col('orders').doc(String(orderId)), order)

    const items = priced.map((l, k) => {
      const id = lastItem + k + 1
      const item = {
        id,
        order_id: orderId,
        product_id: l.product.id,
        name: l.row.name,
        size: l.size,
        color: l.color,
        quantity: l.qty,
        price_usd: l.price,
        image: null,
      }
      tx.set(col('order_items').doc(String(id)), item)
      return item
    })
    applyStock(tx, { qty: needed, stock: new Map([...needed.keys()].map((pid) => [pid, products.get(pid).stock])) }, -1, now)

    tx.set(col('customers').doc(String(customer.id)), customer)
    writeCounter(tx, 'orders', orderId)
    writeCounter(tx, 'order_items', lastItem + priced.length)
    if (!existing) writeCounter(tx, 'customers', lastCustomer + 1)

    return {
      order,
      items,
      customerId: customer.id,
      totals: { subtotal, shipping, discount, total },
    }
  })
}

/* ---------------- estado y borrado ---------------- */

/**
 * Cambia el estado. Cancelar devuelve el stock; reactivar un pedido cancelado
 * vuelve a descontarlo (si hay existencias). Todo en una transacción.
 */
export async function changeStatus(orderId, status) {
  return inTx(async (tx) => {
    const ref = col('orders').doc(String(orderId))
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const order = snap.data()
    const previous = order.status
    const restore = status === 'cancelled' && previous !== 'cancelled'
    const retake = previous === 'cancelled' && status !== 'cancelled'

    if (restore || retake) {
      const items = (await tx.get(col('order_items').where('order_id', '==', order.id))).docs.map((d) => d.data())
      const stock = await readStock(tx, items)
      if (retake) {
        for (const [pid, q] of stock.qty) {
          if (stock.stock.has(pid) && stock.stock.get(pid) < q) {
            throw new StoreError(409, 'Stock insuficiente para reactivar el pedido')
          }
        }
      }
      applyStock(tx, stock, restore ? 1 : -1, nowIso())
    }

    tx.update(ref, { status, updated_at: nowIso() })
    return { previous, order: { ...order, status } }
  })
}

export async function changeStatusByNumber(number, status) {
  const order = await findWhere('orders', 'number', number)
  if (!order) return null
  return changeStatus(order.id, status)
}

/** Borra el pedido y sus líneas. Si no estaba cancelado, devuelve el stock. */
export async function deleteOrder(id) {
  return inTx(async (tx) => {
    const ref = col('orders').doc(String(id))
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const order = snap.data()
    const items = (await tx.get(col('order_items').where('order_id', '==', order.id))).docs.map((d) => d.data())
    if (order.status !== 'cancelled') {
      applyStock(tx, await readStock(tx, items), 1, nowIso())
    }
    for (const it of items) tx.delete(col('order_items').doc(String(it.id)))
    tx.delete(ref)
    return order
  })
}

/* ---------------- consultas ---------------- */

export async function findByNumber(number) {
  return findWhere('orders', 'number', number)
}

export const getOrder = (id) => getOne('orders', id)

export async function getOrderWithItems(id) {
  const order = await getOne('orders', id)
  if (!order) return null
  const items = await listWhere('order_items', 'order_id', order.id)
  return { ...order, items }
}

export async function itemsOf(orderId) {
  return listWhere('order_items', 'order_id', orderId)
}

export async function listAdminOrders({ status, period, demo }) {
  const { start } = periodRange(period)
  const [orders, items] = await Promise.all([listAll('orders'), listAll('order_items')])
  const counts = new Map()
  for (const it of items) {
    const c = counts.get(it.order_id) ?? { n: 0, qty: 0 }
    c.n += 1
    c.qty += Number(it.quantity)
    counts.set(it.order_id, c)
  }
  const startMs = start ? start.getTime() : null
  return orders
    .filter((o) => !status || o.status === status)
    .filter((o) => (demo === 'exclude' ? !o.is_demo : demo === 'only' ? !!o.is_demo : true))
    .filter((o) => startMs === null || tsOf(o.created_at) >= startMs)
    .sort(descStr('created_at'))
    .map((o) => ({ ...o, itemCount: counts.get(o.id)?.n ?? 0, quantity: counts.get(o.id)?.qty ?? 0 }))
}

/** Clientes con su historial. Gasto y último pedido solo cuentan pedidos confirmados. */
export async function listCustomers() {
  const [customers, orders] = await Promise.all([listAll('customers'), listAll('orders')])
  return customers
    .map((c) => {
      const mine = orders.filter(
        (o) => o.customer_id === c.id || (o.customer_id == null && c.email != null && o.customer_email === c.email),
      )
      const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]))
      for (const o of mine) if (o.status in byStatus) byStatus[o.status] += 1
      const confirmed = mine.filter(isConfirmed)
      const spent = confirmed.reduce((s, o) => s + Number(o.total_usd), 0)
      const lastOrderAt = confirmed.map((o) => o.created_at).sort().at(-1) ?? null
      return {
        ...c,
        order_count: mine.length,
        orders_by_status: byStatus,
        total_spent: Math.round(spent * 100) / 100,
        last_order_at: lastOrderAt,
      }
    })
    .sort((a, b) => b.total_spent - a.total_spent)
}

export async function countRealOrders() {
  return countOf('orders', 'is_demo', 0)
}

export async function purgeDemoOrders() {
  const orders = await listAll('orders')
  const demo = orders.filter((o) => o.is_demo)
  const demoIds = new Set(demo.map((o) => o.id))
  const items = (await listAll('order_items')).filter((i) => demoIds.has(i.order_id))
  const remaining = orders.filter((o) => !demoIds.has(o.id))
  const referenced = new Set(remaining.map((o) => o.customer_id).filter((v) => v != null))
  const customers = (await listAll('customers')).filter((c) => !referenced.has(c.id))

  await deleteRefs([
    ...items.map((i) => col('order_items').doc(String(i.id))),
    ...demo.map((o) => col('orders').doc(String(o.id))),
    ...customers.map((c) => col('customers').doc(String(c.id))),
  ])
  return { orders: demo.length, orderItems: items.length }
}

/* ---------------- estadísticas del panel ---------------- */

export async function computeStats({ period, from, to }) {
  const { start, end, prevStart, label } = periodRange(period, { from, to })
  const [orders, items, catalog, subscribers, contacts] = await Promise.all([
    listAll('orders'),
    listAll('order_items'),
    loadCatalog(),
    countOf('subscribers'),
    countOf('contacts'),
  ])

  const when = (o) => tsOf(o.created_at)
  const startMs = start ? start.getTime() : null
  const endMs = end ? end.getTime() : null
  const live = orders.filter((o) => isConfirmed(o) && !o.is_demo)
  const sumOf = (list) => ({ total: list.reduce((s, o) => s + Number(o.total_usd), 0), n: list.length })

  const revenue = sumOf(live.filter((o) => (startMs === null || when(o) >= startMs) && (endMs === null || when(o) <= endMs)))
  const previousRevenue = prevStart === null || start === null
    ? null
    : sumOf(live.filter((o) => when(o) >= prevStart.getTime() && when(o) < startMs))
  const revenueDelta = previousRevenue && previousRevenue.total > 0
    ? Math.round(((revenue.total - previousRevenue.total) / previousRevenue.total) * 100)
    : previousRevenue === null ? undefined : 100
  const ordersDelta = previousRevenue && previousRevenue.n > 0
    ? Math.round(((revenue.n - previousRevenue.n) / previousRevenue.n) * 100)
    : previousRevenue === null ? undefined : 100

  const active = catalog.products.filter((p) => p.active)
  const products = {
    total: active.length,
    lowStock: active.filter((p) => p.stock > 0 && p.stock <= 8).length,
    outOfStock: active.filter((p) => p.stock === 0).length,
    featured: catalog.products.filter((p) => p.featured && p.active).length,
  }

  const now = new Date()
  const revenueByMonth = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rows = live.filter((o) => String(o.created_at).slice(0, 7) === month)
    revenueByMonth.push({
      month,
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      orders: rows.length,
      revenue: Math.round(rows.reduce((s, o) => s + Number(o.total_usd), 0)),
    })
  }

  const recentOrders = orders
    .filter((o) => (startMs === null || when(o) >= startMs) && (endMs === null || when(o) <= endMs))
    .sort(descStr('created_at'))
    .slice(0, 8)

  const lowStockProducts = active
    .filter((p) => p.stock > 0 && p.stock <= 8)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((p) => shape(p, catalog, false))

  const orderById = new Map(orders.map((o) => [o.id, o]))
  const groups = new Map()
  for (const it of items) {
    const o = orderById.get(it.order_id)
    if (!o || o.is_demo || !isConfirmed(o)) continue
    const g = groups.get(it.product_id) ?? { productId: it.product_id, name: it.name, qty: 0, revenue: 0 }
    g.qty += Number(it.quantity)
    g.revenue += Number(it.quantity) * Number(it.price_usd)
    groups.set(it.product_id, g)
  }
  const topSelling = [...groups.values()].sort((a, b) => b.revenue - a.revenue || cmpStr(a.name, b.name)).slice(0, 5)

  return {
    period: { key: period, label },
    revenue: { total: Math.round(revenue.total), orders: revenue.n, delta: revenueDelta },
    ordersDelta,
    products,
    social: { subscribers, contacts },
    revenueByMonth,
    recentOrders,
    lowStockProducts,
    topSelling,
  }
}
