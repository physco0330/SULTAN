import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Coins, Globe } from 'lucide-react'
import { CURRENCIES } from '@/data/currencies'
import { COUNTRIES, getCountry } from '@/data/countries'
import { useCurrency } from '@/store/currency'
import { preloadRates, ratesMeta } from '@/services/rates'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

export function CurrencySelector({ compact = false, menu = false }: { compact?: boolean; menu?: boolean }) {
  const { t } = useTranslation()
  const { country, code, manual, setCountry, setCode, resetToCountryCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'country' | 'currency'>('country')
  const [, setTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  useEffect(() => {
    void preloadRates().then(() => setTick((t2) => t2 + 1))
  }, [])

  const meta = ratesMeta()
  const current = getCountry(country)

  return (
    <div ref={ref} className={cn('relative', menu && 'w-full')}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('misc.currency')}
        className={cn(
          'flex h-10 items-center gap-1.5 px-2 text-xs font-medium tracking-widest text-silver transition-colors hover:text-gold',
          menu && 'w-full justify-between',
        )}
      >
        {compact ? <Coins size={16} /> : null}
        <span className="hidden sm:inline">{current.code}</span>
        <span className="font-semibold text-gold">{code}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 border border-gold/25 bg-carbon shadow-2xl shadow-black/70 animate-scale-in',
            menu ? 'bottom-full mb-2 start-0 w-full' : 'end-0 top-full mt-2 w-72',
          )}
        >
          <div className="flex border-b border-gold/15">
            <button
              onClick={() => setTab('country')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[0.58rem] font-semibold uppercase tracking-widest transition-colors',
                tab === 'country' ? 'bg-gold/10 text-gold' : 'text-bone hover:text-gold',
              )}
            >
              <Globe size={12} /> {t('misc.country')}
            </button>
            <button
              onClick={() => setTab('currency')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[0.58rem] font-semibold uppercase tracking-widest transition-colors',
                tab === 'currency' ? 'bg-gold/10 text-gold' : 'text-bone hover:text-gold',
              )}
            >
              <Coins size={12} /> {t('misc.currency')}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1.5">
            {tab === 'country'
              ? COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCountry(c.code); setTab('currency') }}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gold/10',
                      country === c.code ? 'text-gold' : 'text-ivory',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-7 text-right font-mono text-[0.6rem] text-bone">{c.code}</span>
                      <span>{c.name}</span>
                      <span className="text-[0.62rem] text-bone">{c.currency}</span>
                    </span>
                    {country === c.code && <Check size={14} />}
                  </button>
                ))
              : CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCode(c.code)}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gold/10',
                      code === c.code && manual ? 'text-gold' : 'text-ivory',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="font-medium">{c.symbol}</span>
                      <span>{c.code}</span>
                      <span className="text-[0.62rem] text-bone">{c.label}</span>
                    </span>
                    {code === c.code && manual && <Check size={14} />}
                  </button>
                ))}
          </div>

          <div className="space-y-1.5 border-t border-gold/10 px-4 py-2.5">
            {manual && (
              <button
                onClick={resetToCountryCurrency}
                className="flex w-full items-center justify-center gap-1.5 border border-gold/25 py-1.5 text-[0.58rem] font-semibold uppercase tracking-widest text-bone transition-colors hover:border-gold/60 hover:text-gold"
              >
                {t('misc.resetCurrency')} ({getCountry(country).currency})
              </button>
            )}
            <p className="text-[0.56rem] leading-relaxed text-bone">
              {meta.verified && meta.date
                ? `${t('misc.ratesSource')}: ${meta.source} · ${meta.date}`
                : t('misc.ratesUnavailable')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}