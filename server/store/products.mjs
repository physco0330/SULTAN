import {
  allocIds,
  cached,
  cmpStr,
  col,
  db,
  deleteRefs,
  descStr,
  getOne,
  invalidate,
  listAll,
  listWhere,
  nowIso,
  readCounter,
  StoreError,
  toBool,
  toNum,
  writeCounter,
} from './core.mjs'

const CATALOG_KEY = 'catalog'

const byImageOrder = (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position || a.id - b.id

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Catálogo en memoria (TTL 60 s): productos, fotos publicadas y valoraciones
 * reales. Solo cuentan reseñas aprobadas y no-demo: nunca se usan columnas fijas.
 */
export function loadCatalog() {
  return cached(CATALOG_KEY, async () => {
    const [products, images, reviews] = await Promise.all([
      listAll('products'),
      listAll('product_images'),
      listAll('reviews'),
    ])
    const imagesByProduct = new Map()
    for (const im of images) {
      if (im.status !== 'published') continue
      imagesByProduct.set(im.product_id, [...(imagesByProduct.get(im.product_id) ?? []), im])
    }
    for (const list of imagesByProduct.values()) list.sort(byImageOrder)

    const sums = new Map()
    for (const r of reviews) {
      if (r.status !== 'approved' || r.is_demo || !r.product_id) continue
      const s = sums.get(r.product_id) ?? { n: 0, total: 0 }
      s.n += 1
      s.total += Number(r.rating)
      sums.set(r.product_id, s)
    }
    const ratings = new Map(
      [...sums].map(([id, s]) => [id, { rating: Math.round((s.total / s.n) * 10) / 10, count: s.n }]),
    )
    return { products, imagesByProduct, ratings }
  })
}

export function invalidateCatalog() {
  invalidate(CATALOG_KEY)
}

export function shape(p, catalog, admin) {
  const rr = catalog.ratings.get(p.id) ?? { rating: 0, count: 0 }
  const images = (catalog.imagesByProduct.get(p.id) ?? []).map((im) => ({
    src: im.path,
    alt: im.alt || `${p.name} — imagen`,
  }))
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    gender: p.gender,
    collection: p.collection,
    price: p.price,
    compareAtPrice: p.compare_at_price ?? null,
    currency: p.currency,
    stock: p.stock,
    rating: rr.rating,
    reviews: rr.count,
    featured: !!p.featured,
    isNew: !!p.is_new,
    isLimited: !!p.is_limited,
    isBestSeller: !!p.is_best_seller,
    isOnSale: !!p.is_on_sale,
    isCombo: !!p.is_combo,
    comboItems: Array.isArray(p.combo_items) ? p.combo_items : [],
    material: p.material,
    /* El SKU es un dato interno: solo lo ven los administradores. */
    ...(admin ? { sku: p.sku } : {}),
    description: p.description,
    quality: p.quality === 'original' ? 'original' : 'turkish',
    colors: p.colors ?? [],
    sizes: p.sizes ?? [],
    images,
    active: !!p.active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

export async function shapeProduct(p, { admin = false } = {}) {
  return shape(p, await loadCatalog(), admin)
}

/** Producto por slug o ID (cualquiera, activo o no). */
export async function findProductRef(ref) {
  const key = String(ref ?? '').trim()
  if (!key) return null
  const { products } = await loadCatalog()
  return products.find((p) => p.slug === key) ?? products.find((p) => p.id === key) ?? null
}

/** Ficha pública: solo productos activos, por slug o por ID. */
export async function getPublicProduct(ref) {
  const catalog = await loadCatalog()
  const p = catalog.products.find((x) => x.active && x.slug === ref) ?? catalog.products.find((x) => x.active && x.id === ref)
  return p ? shape(p, catalog, false) : null
}

const FEATURED = (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating || b.reviews - a.reviews

const SORTS = {
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  newest: (a, b) => Number(b.isNew) - Number(a.isNew) || cmpStr(b.createdAt, a.createdAt),
  rated: (a, b) => b.reviews - a.reviews || b.rating - a.rating || a.name.localeCompare(b.name),
  featured: FEATURED,
}

/** Listado público con los mismos filtros y orden que el catálogo de la tienda. */
export async function listPublic(f, womenEnabled) {
  const catalog = await loadCatalog()
  const actives = catalog.products.filter((p) => p.active)
  const prices = actives.map((p) => p.price)
  const bounds = {
    min: Math.floor(prices.length ? Math.min(...prices) : 0),
    max: Math.ceil(prices.length ? Math.max(...prices) : 1),
  }

  let rows = actives.filter((p) => womenEnabled || p.gender !== 'women')
  if (f.gender.length) rows = rows.filter((p) => f.gender.includes(p.gender))
  if (f.category.length) rows = rows.filter((p) => f.category.includes(p.category))
  if (f.collection.length) rows = rows.filter((p) => f.collection.includes(p.collection))
  if (f.size.length) rows = rows.filter((p) => (p.sizes ?? []).some((s) => f.size.includes(String(s))))
  if (f.color.length) rows = rows.filter((p) => (p.colors ?? []).some((c) => f.color.includes(c?.id)))
  const quality = f.quality.filter((v) => v === 'original' || v === 'turkish')
  if (quality.length) rows = rows.filter((p) => quality.includes(p.quality))
  if (f.q) {
    rows = rows.filter(
      (p) =>
        (p.name ?? '').toLowerCase().includes(f.q) ||
        (p.sku ?? '').toLowerCase().includes(f.q) ||
        (p.material ?? '').toLowerCase().includes(f.q) ||
        p.category === f.q,
    )
  }
  if (f.min !== null) rows = rows.filter((p) => p.price >= f.min)
  if (f.max !== null) rows = rows.filter((p) => p.price <= f.max)

  let items = rows.map((p) => shape(p, catalog, false))
  items.sort(SORTS[f.sort] ?? FEATURED)
  if (f.availability.length) {
    items = items.filter((p) => f.availability.includes(p.stock === 0 ? 'out-of-stock' : p.stock <= 8 ? 'low-stock' : 'in-stock'))
  }
  return { items, total: items.length, bounds }
}

export async function listAdmin(q) {
  const catalog = await loadCatalog()
  let rows = catalog.products
  if (q) rows = rows.filter((p) => (p.name ?? '').toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
  return [...rows].sort(descStr('created_at')).map((p) => shape(p, catalog, true))
}

function uniqueSlug(products, name, selfId) {
  const base = slugify(name) || 'producto'
  const taken = new Set(products.filter((p) => p.id !== selfId).map((p) => p.slug))
  let slug = base
  let n = 2
  while (taken.has(slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

function productDoc(id, slug, sku, b, createdAt) {
  return {
    id,
    name: b.name,
    slug,
    category: b.category,
    gender: b.gender,
    collection: b.collection,
    price: b.price,
    compare_at_price: b.compareAtPrice,
    currency: 'USD',
    stock: b.stock,
    featured: b.featured,
    is_new: b.isNew,
    is_limited: b.isLimited,
    is_best_seller: b.isBestSeller,
    is_on_sale: b.isOnSale,
    is_combo: b.isCombo,
    combo_items: b.comboItems,
    material: b.material,
    sku,
    description: b.description,
    quality: b.quality,
    colors: b.colors,
    sizes: b.sizes,
    active: b.active,
    created_at: createdAt,
    updated_at: nowIso(),
  }
}

export async function createProduct(b) {
  const [n] = await allocIds('products')
  const id = `SB-${String(n).padStart(3, '0')}`
  const slug = uniqueSlug(await listAll('products'), b.name, id)
  const doc = productDoc(id, slug, b.sku || `${slug}-${id}`, b, nowIso())
  await col('products').doc(id).set(doc)
  invalidateCatalog()
  return doc
}

export async function updateProduct(id, b) {
  const row = await getOne('products', id)
  if (!row) return null
  const slug = uniqueSlug(await listAll('products'), b.name, row.id)
  const doc = productDoc(row.id, slug, b.sku || `${slug}-${row.id}`, b, row.created_at)
  await col('products').doc(row.id).set(doc)
  invalidateCatalog()
  return doc
}

/** Cambios parciales (activar, stock, precio, destacado, calidad). */
export async function patchProduct(id, body) {
  const row = await getOne('products', id)
  if (!row) return null
  const changes = {}
  if (body.active !== undefined) changes.active = toBool(body.active)
  if (body.stock !== undefined) changes.stock = Math.max(0, Math.floor(toNum(body.stock)))
  if (body.price !== undefined) changes.price = toNum(body.price)
  if (body.compareAtPrice !== undefined) changes.compare_at_price = body.compareAtPrice === '' ? null : toNum(body.compareAtPrice)
  if (body.featured !== undefined) changes.featured = toBool(body.featured)
  if (body.quality !== undefined) {
    if (!['original', 'turkish'].includes(body.quality)) throw new StoreError(422, 'Calidad no válida')
    changes.quality = body.quality
  }
  if (Object.keys(changes).length === 0) throw new StoreError(422, 'Sin cambios')
  changes.updated_at = nowIso()
  await col('products').doc(row.id).update(changes)
  invalidateCatalog()
  return { ...row, ...changes }
}

/** Borra el producto y sus fotos. Devuelve las fotos borradas (para liberar Cloudinary). */
export async function deleteProduct(id) {
  const row = await getOne('products', id)
  if (!row) return null
  const images = await listWhere('product_images', 'product_id', row.id)
  await deleteRefs([col('products').doc(row.id), ...images.map((im) => col('product_images').doc(String(im.id)))])
  invalidateCatalog()
  return { product: row, images }
}

/* ---------------- imágenes ---------------- */

export async function listAdminImages(q) {
  const [images, products] = await Promise.all([listAll('product_images'), listAll('products')])
  const names = new Map(products.map((p) => [p.id, p.name]))
  let rows = images
    .filter((im) => names.has(im.product_id))
    .map((im) => ({ ...im, product_name: names.get(im.product_id) }))
  if (q) rows = rows.filter((r) => r.product_name.toLowerCase().includes(q))
  return rows.sort((a, b) => cmpStr(a.product_id, b.product_id) || Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
}

export async function listProductImages(productId) {
  const rows = await listWhere('product_images', 'product_id', productId)
  return rows.sort(byImageOrder)
}

export async function getProductRow(id) {
  return getOne('products', id)
}

/** Guarda fotos ya subidas a Cloudinary. Todo o nada: una sola transacción. */
export async function addProductImages(productId, items) {
  const saved = await db().runTransaction(async (tx) => {
    const pSnap = await tx.get(col('products').doc(productId))
    if (!pSnap.exists) throw new StoreError(404, 'Producto no encontrado')
    const existing = (await tx.get(col('product_images').where('product_id', '==', productId))).docs.map((d) => d.data())
    const last = await readCounter(tx, 'product_images')

    const now = nowIso()
    let position = existing.length
    let primaryTaken = existing.some((im) => Number(im.is_primary) === 1)
    const out = items.map((it, i) => {
      const id = last + i + 1
      const isPrimary = !primaryTaken
      primaryTaken = true
      const pos = position
      position += 1
      tx.set(col('product_images').doc(String(id)), {
        id,
        product_id: productId,
        path: it.path,
        public_id: it.publicId,
        alt: it.alt,
        position: pos,
        is_primary: isPrimary ? 1 : 0,
        status: it.status,
        created_at: now,
        updated_at: now,
      })
      return { id, productId, path: it.path, alt: it.alt, position: pos, isPrimary, status: it.status }
    })
    writeCounter(tx, 'product_images', last + items.length)
    return out
  })
  invalidateCatalog()
  return saved
}

export const getImage = (id) => getOne('product_images', id)

export async function updateImage(id, fields) {
  await col('product_images').doc(String(id)).update({ ...fields, updated_at: nowIso() })
  invalidateCatalog()
}

/** Marca una foto como principal y quita la marca al resto del mismo producto. */
export async function setPrimaryImage(id) {
  const image = await getOne('product_images', id)
  if (!image) return null
  const siblings = await listWhere('product_images', 'product_id', image.product_id)
  const batch = db().batch()
  for (const s of siblings) {
    batch.update(col('product_images').doc(String(s.id)), { is_primary: s.id === image.id ? 1 : 0 })
  }
  await batch.commit()
  invalidateCatalog()
  return image
}

export async function reorderImages(ids) {
  await db().runTransaction(async (tx) => {
    const refs = ids.map((id) => col('product_images').doc(String(id)))
    const snaps = refs.length ? await tx.getAll(...refs) : []
    const now = nowIso()
    snaps.forEach((s, i) => {
      if (s.exists) tx.update(s.ref, { position: i, updated_at: now })
    })
  })
  invalidateCatalog()
}

/** Borra una foto. Si era la principal, la siguiente publicada pasa a serlo. */
export async function deleteImage(id) {
  const image = await getOne('product_images', id)
  if (!image) return null
  const batch = db().batch()
  batch.delete(col('product_images').doc(String(image.id)))
  if (Number(image.is_primary) === 1) {
    const next = (await listWhere('product_images', 'product_id', image.product_id))
      .filter((s) => s.id !== image.id && s.status === 'published')
      .sort((a, b) => a.position - b.position || a.id - b.id)[0]
    if (next) batch.update(col('product_images').doc(String(next.id)), { is_primary: 1 })
  }
  await batch.commit()
  invalidateCatalog()
  return image
}
