import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

function lockBody(lock: boolean) {
  if (lock) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  maxWidth?: string
  labelledBy?: string
}

export function Modal({ open, onClose, children, title, maxWidth = 'max-w-2xl', labelledBy }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    lockBody(open)
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => {
      lockBody(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-night/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn('relative w-full animate-scale-in border border-gold/25 bg-carbon shadow-2xl shadow-black/80 outline-none', maxWidth)}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-6 py-4">
          {title && <h3 className="font-display text-lg tracking-widest text-ivory">{title}</h3>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-9 w-9 items-center justify-center border border-gold/30 text-silver transition-colors hover:border-gold hover:text-gold"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}