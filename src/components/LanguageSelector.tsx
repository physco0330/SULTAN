import { useRef, useState } from 'react'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { LANGUAGES } from '@/data/languages'
import { useLanguage } from '@/contexts/LanguageContext'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils/cn'

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const current = LANGUAGES.find((l) => language.startsWith(l.code)) ?? LANGUAGES[3]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('misc.language')}
        className={cn(
          'flex h-10 items-center gap-1.5 px-2 text-xs font-medium uppercase tracking-widest text-silver transition-colors hover:text-gold',
        )}
      >
        {compact ? <Languages size={16} /> : null}
        <span>{current.native}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-2 max-h-80 w-52 overflow-y-auto border border-gold/25 bg-carbon py-2 shadow-2xl shadow-black/70 animate-scale-in">
          <p className="px-4 pb-2 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-bone">
            {t('misc.language')}
          </p>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gold/10 hover:text-gold',
                language.startsWith(l.code) ? 'text-gold' : 'text-ivory',
              )}
            >
              <span className="flex items-center gap-3">
                <span className="font-medium">{l.native}</span>
                <span className="text-[0.65rem] uppercase text-bone">{l.code}</span>
              </span>
              {language.startsWith(l.code) && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}