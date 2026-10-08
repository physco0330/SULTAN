import { useRef, useState } from 'react'
import { Check, ChevronDown, Coins } from 'lucide-react'
import { CURRENCIES } from '@/data/currencies'
import { useCurrency } from '@/store/currency'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { code, setCode } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('misc.currency')}
        className="flex h-10 items-center gap-1.5 px-2 text-xs font-medium tracking-widest text-silver transition-colors hover:text-gold"
      >
        {compact ? <Coins size={16} /> : null}
        <span>{code}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-2 max-h-80 w-56 overflow-y-auto border border-gold/25 bg-carbon py-2 shadow-2xl shadow-black/70 animate-scale-in">
          <p className="px-4 pb-2 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-bone">
            {t('misc.currency')}
          </p>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCode(c.code)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gold/10 hover:text-gold',
                code === c.code ? 'text-gold' : 'text-ivory',
              )}
            >
              <span className="flex items-center gap-3">
                <span className="font-medium">{c.symbol}</span>
                <span>{c.code}</span>
              </span>
              {code === c.code && <Check size={14} />}
            </button>
          ))}
          <p className="mt-2 border-t border-gold/10 px-4 pt-2 text-[0.6rem] text-bone">
            {t('misc.from')} — mock rates
          </p>
        </div>
      )}
    </div>
  )
}