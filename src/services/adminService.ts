/* Admin API service (requires the admin token). */

import { api } from '@/services/api'
import { toApiProduct } from '@/services/productService'
import type { Product } from '@/types'

export interface AdminUser {
  username: string
  name: string
  role: string
}

export type AdminProduct = Product & { active: boolean }

export interface AdminStats {
  period: { key: string; label: string }
  revenue: { total: number; orders: number; delta?: number }
  ordersDelta?: number
  products: { total: number; lowStock: number; outOfStock: number; featured: number }
  social: { subscribers: number; contacts: number }
  revenueByMonth: { month: string; label: string; orders: number; revenue: number }[]
  recentOrders: Array<Record<string, unknown>>
  lowStockProducts: Product[]
  topSelling: { productId: string; name: string; qty: number; revenue: number }[]
}

export type AdminOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
export type PeriodKey = 'all' | 'week' | 'month' | 'year'
export type ShippingMethod = 'standard' | 'express' | 'free'

export interface AdminOrder {
  id: number
  number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  ship_city: string | null
  ship_country: string | null
  ship_address: string | null
  ship_zip: string | null
  subtotal_usd: number
  shipping_usd: number
  discount_usd: number
  total_usd: number
  currency: string
  coupon_code: string | null
  status: string
  created_at: string
  itemCount: number
  quantity: number
}

export interface AdminOrderDetail extends Omit<AdminOrder, 'itemCount' | 'quantity'> {
  items: {
    product_id: string | null
    name: string
    size: string | null
    color: string | null
    quantity: number
    price_usd: number
  }[]
}

export interface CouponRow {
  code: string
  percent: number
  min_subtotal: number
  active: number | boolean
  created_at: string
}

export interface SubscriberRow {
  id: number
  email: string
  created_at: string
}

export interface ContactRow {
  id: number
  name: string
  email: string
  subject: string | null
  message: string
  created_at: string
}

export interface CustomerRow {
  id: number
  name: string
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  document: string | null
  address: string | null
  created_at: string
  first_order_at: string | null
  last_order_at: string | null
  total_spent: number
  order_count: number
}

export interface ProductImageRow {
  id: number
  product_id: string
  path: string
  alt: string
  position: number
  is_primary: number | boolean
  status: 'published' | 'pending' | 'disabled'
  created_at: string
  updated_at: string
  product_name?: string
}

export type ImageStatus = 'published' | 'pending' | 'disabled'

export interface SupplierRow {
  id: number
  company: string
  tax_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  category: string | null
  notes: string | null
  active: number | boolean
  created_at: string
  updated_at: string
}

export interface AuditRow {
  id: number
  username: string
  action: string
  entity: string
  entity_id: string | null
  detail: string
  created_at: string
}

export interface ReviewRow {
  id: number
  name: string
  city: string | null
  rating: number
  comment: string
  created_at: string
}

export const adminService = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AdminUser }>('/admin/auth/login', { username, password }),
  me: () => api.get<{ user: AdminUser }>('/admin/me'),

  stats: (period?: PeriodKey, range?: { from?: string; to?: string }) => {
    const qp = new URLSearchParams()
    if (period && period !== 'all') qp.set('period', period)
    if (range?.from) qp.set('from', range.from)
    if (range?.to) qp.set('to', range.to)
    const qs = qp.toString()
    return api.get<AdminStats>(`/admin/stats${qs ? `?${qs}` : ''}`)
  },

  products: (q?: string) =>
    api.get<{ items: AdminProduct[] }>(`/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createProduct: (p: Partial<Product>) =>
    api.post<{ product: AdminProduct }>('/admin/products', toApiProduct(p as Product)),
  updateProduct: (id: string, p: Partial<Product>) =>
    api.put<{ product: AdminProduct }>(`/admin/products/${id}`, toApiProduct(p as Product)),
  patchProduct: (id: string, patch: Record<string, unknown>) =>
    api.patch<{ product: AdminProduct }>(`/admin/products/${id}`, patch),
  deleteProduct: (id: string) => api.del<{ ok: boolean }>(`/admin/products/${id}`),

  orders: (status?: string, period?: PeriodKey) => {
    const qp = new URLSearchParams()
    if (status) qp.set('status', status)
    if (period && period !== 'all') qp.set('period', period)
    const qs = qp.toString()
    return api.get<{ items: AdminOrder[] }>(`/admin/orders${qs ? `?${qs}` : ''}`)
  },
  order: (id: number) => api.get<{ order: AdminOrderDetail }>(`/admin/orders/${id}`),
  patchOrderStatus: (id: number, status: string) =>
    api.patch<{ ok: boolean; status: string }>(`/admin/orders/${id}`, { status }),
  createOrder: (body: {
    items: { id: string; quantity: number; size?: string; color?: string }[]
    customer: { name: string; email?: string; phone?: string; city?: string; country?: string; address?: string; zip?: string }
    shipping?: ShippingMethod
    promoCode?: string
  }) => api.post<{ ok: boolean; order: AdminOrder }>('/admin/orders', body),
  deleteOrder: (id: number) => api.del<{ ok: boolean }>(`/admin/orders/${id}`),

  settings: () => api.get<{ settings: Record<string, string>; coupons: CouponRow[] }>('/admin/settings'),
  saveSettings: (body: Record<string, string>) => api.put<{ ok: boolean }>('/admin/settings', body),

  createCoupon: (body: { code: string; percent: number; minSubtotal: number; active: boolean }) =>
    api.post<{ coupon: CouponRow }>('/admin/coupons', body),
  patchCoupon: (code: string, body: Record<string, unknown>) =>
    api.patch<{ coupon: CouponRow }>(`/admin/coupons/${encodeURIComponent(code)}`, body),
  deleteCoupon: (code: string) => api.del<{ ok: boolean }>(`/admin/coupons/${encodeURIComponent(code)}`),

  subscribers: () => api.get<{ items: SubscriberRow[] }>('/admin/subscribers'),
  deleteSubscriber: (id: number) => api.del<{ ok: boolean }>(`/admin/subscribers/${id}`),

  contacts: () => api.get<{ items: ContactRow[] }>('/admin/contacts'),
  deleteContact: (id: number) => api.del<{ ok: boolean }>(`/admin/contacts/${id}`),

  customers: () => api.get<{ items: CustomerRow[] }>('/admin/customers'),
  reviews: () => api.get<{ items: ReviewRow[] }>('/admin/reviews'),
  deleteReview: (id: number) => api.del<{ ok: boolean }>(`/admin/reviews/${id}`),
  audit: () => api.get<{ items: AuditRow[] }>('/admin/audit'),

  /* ---------- imágenes del catálogo ---------- */
  images: (q?: string) =>
    api.get<{ items: ProductImageRow[] }>(`/admin/images${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  productImages: (productId: string) =>
    api.get<{ items: ProductImageRow[] }>(`/admin/products/${encodeURIComponent(productId)}/images`),
  uploadImages: (
    productId: string,
    images: { data: string; alt?: string; status?: ImageStatus }[],
  ) => api.post<{ items: ProductImageRow[] }>(`/admin/products/${encodeURIComponent(productId)}/images`, { images }),
  updateImage: (id: number, patch: { alt?: string; status?: ImageStatus; isPrimary?: boolean }) =>
    api.patch<{ ok: boolean }>(`/admin/images/${id}`, patch),
  reorderImages: (ids: number[]) => api.post<{ ok: boolean }>('/admin/images/reorder', { ids }),
  deleteImage: (id: number) => api.del<{ ok: boolean }>(`/admin/images/${id}`),

  /* ---------- proveedores ---------- */
  suppliers: (q?: string) =>
    api.get<{ items: SupplierRow[] }>(`/admin/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createSupplier: (body: Partial<SupplierRow>) =>
    api.post<{ supplier: SupplierRow }>('/admin/suppliers', body),
  updateSupplier: (id: number, body: Partial<SupplierRow>) =>
    api.put<{ supplier: SupplierRow }>(`/admin/suppliers/${id}`, body),
  patchSupplier: (id: number, body: { active: boolean }) =>
    api.patch<{ ok: boolean }>(`/admin/suppliers/${id}`, body),
  deleteSupplier: (id: number) => api.del<{ ok: boolean }>(`/admin/suppliers/${id}`),
}