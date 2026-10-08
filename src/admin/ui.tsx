import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') || iso.includes('Z') ? iso : iso + 'Z')
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden border border-gold/15 bg-carbon/40', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 px-5 py-4">
        <h2 className="font-display text-sm tracking-[0.2em] text-ivory">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  delta?: number
  hint?: string
}) {
  const up = (delta ?? 0) >= 0
  return (
    <div className="group border border-gold/15 bg-carbon/50 p-5 transition-all hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5">
      <div className="flex items-center justify-between">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-bone">{label}</span>
        <Icon size={16} className="text-gold" />
      </div>
      <p className="mt-3 font-display text-2xl text-ivory lg:text-3xl">{value}</p>
      {delta !== undefined && (
        <p className={cn('mt-2 flex items-center gap-1 text-xs', up ? 'text-emerald-400' : 'text-red-400')}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta).toFixed(1)}%
          {hint && <span className="font-light text-bone"> · {hint}</span>}
        </p>
      )}
    </div>
  )
}

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  confirmed: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  shipped: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
  delivered: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  cancelled: 'bg-red-400/10 text-red-300 border-red-400/30',
  active: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  inactive: 'bg-bone/10 text-bone border-bone/30',
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em]',
        STATUS_TONES[value] ?? 'bg-bone/10 text-bone border-bone/30',
      )}
    >
      {label ?? value}
    </span>
  )
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th className={cn('whitespace-nowrap px-4 py-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold/80', right && 'text-right')}>
      {children}
    </th>
  )
}

export function Td({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={cn('whitespace-nowrap px-4 py-3 text-sm text-ivory', right && 'text-right', className)}>{children}</td>
}

export function TableScroller({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold',
        className,
      )}
      aria-label="Cargando"
    />
  )
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-bone">
        {message}
      </td>
    </tr>
  )
}