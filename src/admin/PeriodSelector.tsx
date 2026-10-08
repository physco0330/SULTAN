import { cn } from '@/utils/cn'
import type { PeriodKey } from '@/services/adminService'

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todo' },
]

export function PeriodSelector({ value, onChange, size = 'md' }: { value: PeriodKey; onChange: (k: PeriodKey) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'border font-semibold uppercase tracking-[0.18em] transition-colors',
            size === 'sm' ? 'px-2.5 py-1.5 text-[0.58rem]' : 'px-3.5 py-2 text-[0.62rem]',
            value === o.key ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}