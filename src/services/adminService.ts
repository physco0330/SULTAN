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
  created_at: string
  order_count: number
  total_spent: number
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

export const adminService = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AdminUser }>('/admin/auth/login', { username, password }),
  me: () => api.get<{ user: AdminUser }>('/admin/me'),

  stats: (period?: PeriodKey) =>
    api.get<AdminStats>(`/admin/stats${period && period !== 'all' ? `?period=${period}` : ''}`),

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
  }) => api.post<{ ok: boolean; order: { id: number; number: string; status: string; total: number } }>('/admin/orders', body),
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
  audit: () => api.get<{ items: AuditRow[] }>('/admin/audit'),
}