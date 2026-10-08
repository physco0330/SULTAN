import { useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  position?: 'right' | 'left'
  size?: 'sm' | 'md' | 'lg'
}

export function Drawer({
  open,
  onClose,
  children,
  title,
  position = 'right',
  size = 'md',
}: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
      document.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', onKey)
      }
    }
  }, [open, onClose])

  if (!open) return null

  const width =
    size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-xl' : 'max-w-md'

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-night/80 backdrop-blur-sm animate-fade-in"
      />
      <aside
        className={cn(
          'absolute top-0 flex h-full w-full flex-col border-gold/20 bg-carbon shadow-2xl shadow-black transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          width,
          position === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          position === 'right' ? 'translate-x-0 animate-drawer-in-r' : 'translate-x-0 animate-drawer-in-l',
        )}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <h3 className="font-display text-base font-semibold uppercase tracking-[0.3em] text-ivory">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver transition-colors hover:border-gold hover:text-gold"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}