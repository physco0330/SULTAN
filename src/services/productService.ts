/* SULTAN BLACK — data services.
 * Every function tries the real API first and falls back to the local mock
 * so the store keeps working fully offline (dev / no server). */

import { PRODUCTS, getProduct, getRelated } from '@/data/products'
import { productImage } from '@/utils/placeholder'
import { applyPromo, discountAmount, FLAT_SHIPPING_USD, FREE_SHIPPING_THRESHOLD_USD, EXPRESS_SHIPPING_USD } from '@/services/discounts'
import { api, ApiError, isApiOffline } from '@/services/api'
import type { Product, Gender, CollectionId, CategoryId } from '@/types'

/* ---------------- mapping ---------------- */

type ApiProduct = Record<string, unknown> & {
  id: string
  name: string
  slug: string
  category: string
  gender: string
  collection: string
  price: number
  compareAtPrice?: number | null
  currency: string
  stock: number
  rating: number
  reviews: number
  featured: boolean
  isNew: boolean
  isLimited: boolean
  isBestSeller: boolean
  isOnSale: boolean
  material: string
  sku: string
  description: string
  colors: { id: string; name: string; hex: string }[]
  sizes: string[]
  images: { src: string; alt: string }[]
}

function toProduct(d: ApiProduct): Product {
  const images = Array.isArray(d.images) && d.images.length > 0
    ? d.images
    : [0, 1, 2].map((i) => ({ src: productImage(d.name, i), alt: `${d.name} — view ${i + 1}` }))
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    category: d.category as CategoryId,
    gender: d.gender as Gender,
    collection: d.collection as CollectionId,
    price: d.price,
    compareAtPrice: d.compareAtPrice ?? undefined,
    currency: d.currency,
    images,
    colors: d.colors ?? [],
    sizes: d.sizes ?? [],
    description: d.description,
    material: d.material,
    sku: d.sku,
    stock: d.stock,
    rating: d.rating,
    reviews: d.reviews,
    featured: d.featured,
    isNew: d.isNew,
    isLimited: d.isLimited,
    isBestSeller: d.isBestSeller,
    isOnSale: d.isOnSale,
  }
}

export function toApiProduct(p: Product) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    gender: p.gender,
    collection: p.collection,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? null,
    currency: p.currency,
    stock: p.stock,
    rating: p.rating,
    reviews: p.reviews,
    featured: p.featured,
    isNew: p.isNew,
    isLimited: p.isLimited,
    isBestSeller: p.isBestSeller,
    isOnSale: p.isOnSale,
    material: p.material,
    sku: p.sku,
    description: p.description,
    colors: p.colors,
    sizes: p.sizes,
    active: true,
  }
}

/* ---------------- catalog ---------------- */

export interface CatalogFilters {
  gender?: string[]
  category?: string[]
  collection?: string[]
  size?: string[]
  color?: string[]
  availability?: string[]
  min?: number
  max?: number
  q?: string
  sort?: string
  featured?: boolean
}

export async function fetchCatalog(filters: CatalogFilters = {}): Promise<Product[]> {
  const params = new URLSearchParams()
  for (const key of ['gender', 'category', 'collection', 'size', 'color', 'availability'] as const) {
    for (const v of filters[key] ?? []) params.append(key, v)
  }
  if (filters.min !== undefined) params.set('min', String(filters.min))
  if (filters.max !== undefined) params.set('max', String(filters.max))
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  try {
    const data = await api.get<{ items: Array<Record<string, unknown>> }>(`/products?${params}`)
    return data.items.map((p) => toProduct(p as unknown as ApiProduct))
  } catch (err) {
    if (isApiOffline(err)) return offlineCatalog(filters)
    throw err
  }
}

function offlineCatalog(filters: CatalogFilters): Product[] {
  let list = [...PRODUCTS]
  if (filters.gender?.length) list = list.filter((p) => filters.gender!.includes(p.gender))
  if (filters.category?.length) list = list.filter((p) => filters.category!.includes(p.category))
  if (filters.collection?.length) list = list.filter((p) => filters.collection!.includes(p.collection))
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
  }
  if (list.length > 200) list = list.slice(0, 200)
  return list
}

export async function fetchProductById(slugOrId: string): Promise<Product | undefined> {
  try {
    const data = await api.get<{ product: Record<string, unknown> }>(`/products/${encodeURIComponent(slugOrId)}`)
    return data.product ? toProduct(data.product as unknown as ApiProduct) : undefined
  } catch (err) {
    if (isApiOffline(err)) return getProduct(slugOrId)
    if (err instanceof ApiError && err.status === 404) return undefined
    throw err
  }
}

export function relatedProducts(product: Product, from: Product[], limit = 4): Product[] {
  const pool = from.length ? from : PRODUCTS
  if (product) return getRelated(product, limit)
  return pool.slice(0, limit)
}

/* ---------------- storefront config ---------------- */

export interface StoreConfig {
  companyName: string
  companyTagline: string
  companyEmail: string
  companyPhone: string
  companyWhatsapp: string
  companyAddress: string
  defaultCurrency: string
  freeShippingThreshold: number
  flatShipping: number
  expressShipping: number
  instagramUrl: string
}

export const FALLBACK_CONFIG: StoreConfig = {
  companyName: 'SULTAN BLACK',
  companyTagline: 'Where Turkish Craft Meets Modern Luxury',
  companyEmail: '',
  companyPhone: '',
  companyWhatsapp: '',
  companyAddress: 'Istanbul, Türkiye',
  defaultCurrency: 'USD',
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD_USD,
  flatShipping: FLAT_SHIPPING_USD,
  expressShipping: EXPRESS_SHIPPING_USD,
  instagramUrl: '',
}

export async function fetchConfig(): Promise<StoreConfig> {
  try {
    return await api.get<StoreConfig>('/config')
  } catch {
    return FALLBACK_CONFIG
  }
}

/* ---------------- coupons ---------------- */

export interface CouponResult {
  code: string
  percent: number
  valid: boolean
  discount: number
  minSubtotal?: number
}

export async function validateCoupon(code: string, subtotalUsd: number): Promise<CouponResult> {
  try {
    return await api.get<CouponResult>(`/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotalUsd}`)
  } catch {
    const r = applyPromo(code, subtotalUsd)
    return { code, percent: r.percent, valid: r.valid, discount: r.valid ? discountAmount(code, subtotalUsd) : 0 }
  }
}

/* ---------------- orders / checkout ---------------- */

export interface OrderCustomer {
  email: string
  name: string
  phone?: string
  city?: string
  country?: string
  address?: string
  zip?: string
}

export interface OrderItemInput {
  id: string
  slug: string
  size: string
  color: string
  quantity: number
}

export interface PlacedOrder {
  number: string
  status: string
  createdAt: string
  customer: { name: string; email: string }
  totals: { subtotal: number; shipping: number; discount: number; total: number; currency: string }
}

export async function placeOrder(input: {
  items: OrderItemInput[]
  customer: OrderCustomer
  promoCode?: string | null
}): Promise<PlacedOrder> {
  return api.post<PlacedOrder>('/orders', input)
}

export async function lookupOrderByNumber(number: string) {
  return api.get<{ order: Record<string, unknown> }>(`/orders/${encodeURIComponent(number)}`)
}

/* ---------------- contact & newsletter ---------------- */

export async function sendContact(input: { name: string; email: string; subject?: string; message: string }): Promise<void> {
  try {
    await api.post('/contact', input)
  } catch (err) {
    if (isApiOffline(err)) return
    throw err
  }
}

export async function subscribe(email: string): Promise<void> {
  try {
    await api.post('/newsletter', { email })
  } catch (err) {
    if (isApiOffline(err)) return
    throw err
  }
}