import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export interface UiState {
  searchOpen: boolean
  mobileMenuOpen: boolean
  toasts: Toast[]
  openSearch: () => void
  closeSearch: () => void
  openMobileMenu: () => void
  closeMobileMenu: () => void
  toggleMobileMenu: () => void
  pushToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUi = create<UiState>()((set, get) => ({
  searchOpen: false,
  mobileMenuOpen: false,
  toasts: [],
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openMobileMenu: () => set({ mobileMenuOpen: true }),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  pushToast: (message, type = 'success') => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, type }] })
    setTimeout(() => get().dismissToast(id), 2600)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))