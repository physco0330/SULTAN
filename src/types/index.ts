export type Gender = 'men' | 'women' | 'unisex'

export type CategoryId =
  | 'shirts'
  | 'tshirts'
  | 'trousers'
  | 'jeans'
  | 'jackets'
  | 'coats'
  | 'hoodies'
  | 'dresses'
  | 'skirts'
  | 'sets'
  | 'accessories'

export type CollectionId =
  | 'new'
  | 'premium'
  | 'limited'
  | 'bestsellers'
  | 'offers'

export type Availability = 'in-stock' | 'low-stock' | 'out-of-stock'

export interface ProductImage {
  src: string
  alt: string
}

export interface ProductColor {
  id: string
  name: string
  hex: string
}

export interface Product {
  id: string
  name: string
  slug: string
  category: CategoryId
  gender: Gender
  collection: CollectionId
  price: number
  compareAtPrice?: number
  currency: string
  images: ProductImage[]
  colors: ProductColor[]
  sizes: string[]
  description: string
  material: string
  sku: string
  stock: number
  rating: number
  reviews: number
  featured: boolean
  isNew: boolean
  isLimited: boolean
  isBestSeller: boolean
  isOnSale: boolean
}

export interface Category {
  id: CategoryId
  label: string
}

export interface Currency {
  code: string
  symbol: string
  locale: string
  decimals: number
  rate: number
  label: string
}

export interface Language {
  code: string
  label: string
  native: string
  dir: 'ltr' | 'rtl'
  enabled: boolean
}

export interface CartItem {
  productId: string
  slug: string
  name: string
  image: string
  price: number
  currency: string
  size: string
  color: string
  quantity: number
  compareAtPrice?: number
}

export interface OrderTotals {
  subtotal: number
  shipping: number
  discount: number
  total: number
  currency: string
}

/* ---- Backend-facing contracts (to be wired to a real API later) ---- */

export interface BackendOrder {
  id: string
  customer: BackendCustomer
  items: CartItem[]
  totals: OrderTotals
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
}

export interface BackendCustomer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  city: string
  address: string
  postalCode: string
}

export interface AdminProductSummary {
  id: string
  name: string
  sku: string
  stock: number
  price: number
  sales: number
  revenue: number
}

export interface AdminOrderSummary {
  id: string
  customerName: string
  total: number
  status: BackendOrder['status']
  createdAt: string
}

export type FinancialReportKind =
  | 'revenue'
  | 'expenses'
  | 'taxes'
  | 'discounts'
  | 'inventory'

export interface FinancialMovement {
  id: string
  kind: FinancialReportKind
  amount: number
  currency: string
  description: string
  createdAt: string
}

/* NOTE ON FINANCIAL SECURITY
 * Every figure rendered on the frontend is display-only.
 * All prices, discounts, taxes and totals MUST be recomputed,
 * validated and authorized by the backend before any charge.
 * Never trust client-supplied values when wiring payment. */