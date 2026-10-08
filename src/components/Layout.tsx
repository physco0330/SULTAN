import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '@/components/Header/Header'
import { MobileMenu } from '@/components/Header/MobileMenu'
import { Footer } from '@/components/Footer/Footer'
import { SearchOverlay } from '@/components/Search/SearchOverlay'
import { CartDrawer } from '@/components/Cart/CartDrawer'
import { FloatingButtons } from '@/components/FloatingButtons'
import { useTranslation } from 'react-i18next'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col bg-night text-ivory">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold focus:px-4 focus:py-2 focus:text-night"
      >
        {t('search.skip')}
      </a>
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1 pt-[7.4rem] lg:pt-[8.2rem]">
        <Outlet />
      </main>
      <Footer />
      <MobileMenu />
      <SearchOverlay />
      <CartDrawer />
      <FloatingButtons />
    </div>
  )
}