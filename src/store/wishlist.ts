import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WishlistState {
  ids: string[]
  toggle: (id: string) => void
  remove: (id: string) => void
  has: (id: string) => boolean
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({ ids: get().ids.includes(id) ? get().ids.filter((i) => i !== id) : [...get().ids, id] }),
      remove: (id) => set({ ids: get().ids.filter((i) => i !== id) }),
      has: (id) => get().ids.includes(id),
    }),
    { name: 'sultan-wishlist', partialize: (s) => ({ ids: s.ids }) },
  ),
)