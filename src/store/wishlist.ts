import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WishlistState {
  ids: string[]
  toggle: (id: string) => void
  remove: (id: string) => void
  has: (id: string) => boolean
  /** Quita ids que ya no existen en el catálogo (productos borrados). */
  prune: (valid: string[]) => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({ ids: get().ids.includes(id) ? get().ids.filter((i) => i !== id) : [...get().ids, id] }),
      remove: (id) => set({ ids: get().ids.filter((i) => i !== id) }),
      has: (id) => get().ids.includes(id),
      prune: (valid) => {
        const keep = new Set(valid)
        const next = get().ids.filter((i) => keep.has(i))
        if (next.length !== get().ids.length) set({ ids: next })
      },
    }),
    { name: 'sultan-wishlist', partialize: (s) => ({ ids: s.ids }) },
  ),
)