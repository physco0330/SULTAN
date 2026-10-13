import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { Logo } from '@/components/Logo'
import { LanguageSelector } from '@/components/LanguageSelector'
import { CurrencySelector } from '@/components/CurrencySelector'
import { useUi } from '@/store/ui'

/* Mismas secciones que la barra de escritorio: Inicio / Catálogo / Ofertas. */
const LINKS = [
  { to: '/', key: 'home' },
  { to: '/catalogo', key: 'catalog' },
  { to: '/ofertas', key: 'offers' },
]

export function MobileMenu() {
  const { t } = useTranslation()
  const open = useUi((s) => s.mobileMenuOpen)
  const close = useUi((s) => s.closeMobileMenu)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
      <button aria-label={t('nav.close')} onClick={close} className="absolute inset-0 bg-night/85 backdrop-blur-sm animate-fade-in" />
      <aside className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-gold/20 bg-carbon animate-drawer-in-l">
        <div className="flex items-center justify-between border-b border-gold/15 px-4 py-4">
          <Logo />
          <button
            onClick={close}
            aria-label={t('nav.close')}
            className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver hover:border-gold hover:text-gold"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Mobile">
          <ul className="space-y-1">
            {LINKS.map((l, i) => (
              <li key={l.to} className="animate-fade-up border-b border-gold/10" style={{ animationDelay: `${i * 60}ms` }}>
                <Link
                  to={l.to}
                  onClick={close}
                  className="flex items-center justify-between py-4 font-display text-xl tracking-wide text-ivory transition-colors hover:text-gold"
                >
                  {t(`nav.${l.key}`)}
                  <span className="text-gold/50">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-1 border-t border-gold/15 px-4 py-3">
          <LanguageSelector menu />
          <CurrencySelector menu />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
