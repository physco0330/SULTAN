import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { LanguageSelector } from '@/components/LanguageSelector'
import { CurrencySelector } from '@/components/CurrencySelector'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { to: '/', key: 'home' },
  { to: '/hombre', key: 'men' },
  { to: '/mujer', key: 'women' },
  { to: '/nueva-coleccion', key: 'newCollection' },
  { to: '/catalogo', key: 'catalog' },
  { to: '/ofertas', key: 'offers' },
]

function AnnouncementBar() {
  const { t } = useTranslation()
  const items = [
    t('sections.marquee.freeShipping'),
    t('sections.marquee.international'),
    t('sections.marquee.authentic'),
    t('sections.marquee.returns'),
    t('sections.marquee.secure'),
  ]
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden border-b border-gold/15 bg-carbon py-2 text-[0.62rem] font-medium uppercase tracking-[0.28em] text-gold" aria-hidden="true">
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
        {row.map((it, i) => (
          <span key={i} className="flex items-center gap-10">
            <span>{it}</span><span className="text-gold/40">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Header() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0))
  const wishCount = useWishlist((s) => s.ids.length)
  const openCart = useCart((s) => s.openCart)
  const openSearch = useUi((s) => s.openSearch)
  const openMenu = useUi((s) => s.openMobileMenu)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <AnnouncementBar />
      <div
        className={cn(
          'border-b transition-all duration-500',
          scrolled
            ? 'border-gold/15 bg-night/85 py-2 backdrop-blur-md'
            : 'border-transparent bg-gradient-to-b from-night/90 to-night/20 py-4 backdrop-blur-sm',
        )}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={openMenu}
              aria-label={t('nav.openMenu')}
              className="flex h-10 w-10 items-center justify-center text-silver transition-colors hover:text-gold"
            >
              <Menu size={22} />
            </button>
          </div>

          <Logo compact={scrolled} />

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'group relative py-1 text-[0.72rem] font-medium uppercase tracking-[0.24em] transition-colors',
                    isActive ? 'text-gold' : 'text-silver hover:text-ivory',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {t(`nav.${item.key}`)}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 left-0 h-px bg-gold transition-all duration-300',
                        isActive ? 'w-full' : 'w-0 group-hover:w-full',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 lg:gap-1">
            <button
              onClick={openSearch}
              aria-label={t('nav.search')}
              className="flex h-10 w-10 items-center justify-center text-silver transition-all hover:-translate-y-0.5 hover:text-gold"
            >
              <Search size={18} />
            </button>

            <div className="hidden md:block">
              <LanguageSelector compact />
            </div>
            <div className="hidden md:block">
              <CurrencySelector compact />
            </div>

            <Link
              to="/favoritos"
              aria-label={t('nav.favorites')}
              className="relative flex h-10 w-10 items-center justify-center text-silver transition-colors hover:text-gold"
            >
              <Heart size={18} />
              {wishCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[0.6rem] font-bold text-night animate-toggle">
                  {wishCount}
                </span>
              )}
            </Link>

            <Link
              to="/admin"
              aria-label={t('nav.account')}
              className="hidden h-10 w-10 items-center justify-center text-silver transition-colors hover:text-gold sm:flex"
            >
              <User size={18} />
            </Link>

            <button
              onClick={openCart}
              aria-label={t('nav.cart')}
              className="relative flex h-10 w-10 items-center justify-center text-silver transition-colors hover:text-gold"
            >
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[0.6rem] font-bold text-night animate-toggle"
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}