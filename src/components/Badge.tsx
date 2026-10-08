import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

type BadgeTone = 'gold' | 'silver' | 'outline' | 'danger'

export function Badge({
  children,
  tone = 'gold',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em]',
        tone === 'gold' && 'bg-gold text-night',
        tone === 'silver' && 'bg-silver text-night',
        tone === 'outline' && 'border border-gold/50 text-gold',
        tone === 'danger' && 'bg-red-900/80 text-ivory',
        className,
      )}
    >
      {children}
    </span>
  )
}