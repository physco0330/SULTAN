import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'
import type { Product } from '@/types'

export interface CartState {
  items: CartItem[]
  promoCode: string | null
  cartOpen: boolean
  addItem: (product: Product, size: string, color: string, quantity: number) => void
  removeItem: (key: string) => void
  updateQty: (key: string, quantity: number) => void
  setPromo: (code: string | null) => void
  syncStock: (products: Product[]) => void
  clear: () => void
  openCart: () => void
  closeCart: () => void
}

export function cartKey(id: string, size: string, color: string) {
  return `${id}::${size}::${color}`
}

/** Máximo por línea: 10 unidades y nunca más que el stock disponible. */
export const MAX_LINE_QTY = 10
export function maxQtyFor(stock: number | undefined) {
  return stock === undefined ? MAX_LINE_QTY : Math.max(0, Math.min(MAX_LINE_QTY, stock))
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      cartOpen: false,
      addItem: (product, size, color, quantity) => {
        const key = cartKey(product.id, size, color)
        const stock = Math.max(0, product.stock)
        if (stock === 0) return
        const existing = get().items.find((i) => cartKey(i.productId, i.size, i.color) === key)
        if (existing) {
          set({
            items: get().items.map((i) =>
              cartKey(i.productId, i.size, i.color) === key
                ? { ...i, stock, quantity: Math.min(i.quantity + quantity, maxQtyFor(stock)) }
                : i,
            ),
          })
        } else {
          set({
            items: [
              ...get().items,
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                image: product.images[0]?.src ?? '',
                price: product.price,
                currency: product.currency,
                size,
                color,
                quantity: Math.min(quantity, maxQtyFor(stock)),
                compareAtPrice: product.compareAtPrice,
                stock,
              },
            ],
          })
        }
      },
      removeItem: (key) => set({ items: get().items.filter((i) => cartKey(i.productId, i.size, i.color) !== key) }),
      updateQty: (key, quantity) =>
        set({
          items: get()
            .items.map((i) =>
              cartKey(i.productId, i.size, i.color) === key
                ? { ...i, quantity: Math.max(1, Math.min(quantity, maxQtyFor(i.stock))) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        }),
      syncStock: (products) => {
        const stockById = new Map(products.map((p) => [p.id, Math.max(0, p.stock)]))
        set({
          items: get().items.map((i) => {
            const stock = stockById.get(i.productId)
            if (stock === undefined) return i
            return { ...i, stock, quantity: Math.min(i.quantity, Math.max(1, maxQtyFor(stock))) }
          }),
        })
      },
      setPromo: (code) => set({ promoCode: code }),
      clear: () => set({ items: [], promoCode: null }),
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
    }),
    {
      name: 'sultan-cart',
      partialize: (state) => ({ items: state.items, promoCode: state.promoCode }),
    },
  ),
)

export function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  return { subtotal, count: items.reduce((n, i) => n + i.quantity, 0) }
}