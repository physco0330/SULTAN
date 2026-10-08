import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PRODUCTS } from '@/data/products'
import { useWishlist } from '@/store/wishlist'
import { useCart } from '@/store/cart'
import { useUi } from '@/store/ui'
import { Price } from '@/components/Price'
import { Rating } from '@/components/Rating'
import { EmptyState } from '@/components/EmptyState'

export default function Favorites() {
  const { t } = useTranslation()
  const ids = useWishlist((s) => s.ids)
  const toggle = useWishlist((s) => s.toggle)
  const addItem = useCart((s) => s.addItem)
  const pushToast = useUi((s) => s.pushToast)

  const favorites = PRODUCTS.filter((p) => ids.includes(p.id))

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('favorites.title')}</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gold">{favorites.length} {t('catalog.productsShown')}</p>
      </header>

      {favorites.length === 0 ? (
        <div className="py-12">
          <EmptyState
            action={
              <Link to="/catalogo" className="mt-4 border border-gold/50 px-8 py-3.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
                {t('cart.continue')}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((p) => (
            <div key={p.id} className="group">
              <Link to={`/producto/${p.slug}`} className="relative block aspect-[3/4] overflow-hidden border border-gold/10">
                <img src={p.images[0].src} alt={p.name} className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-night/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="border border-gold/60 px-5 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.26em] text-gold">
                    {t('product.viewProduct')}
                  </span>
                </span>
              </Link>
              <div className="mt-3">
                <Link to={`/producto/${p.slug}`} className="font-display text-sm text-ivory hover:text-gold">{p.name}</Link>
                <div className="mt-1 flex items-center justify-between">
                  <Rating value={p.rating} count={p.reviews} />
                  <Price price={p.price} compareAtPrice={p.compareAtPrice} />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      addItem(p, p.sizes[0], p.colors[0].id, 1)
                      pushToast(`${p.name} — ${t('misc.added')}`)
                    }}
                    className="flex-1 border border-gold/40 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold hover:bg-gold hover:text-night"
                  >
                    {t('product.addToCart')}
                  </button>
                  <button
                    onClick={() => toggle(p.id)}
                    aria-label={t('favorites.remove')}
                    className="flex w-10 items-center justify-center border border-gold/40 text-gold hover:border-red-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-16 border border-gold/15 bg-carbon/50 p-6 text-center text-xs text-bone md:p-8">
        <p className="flex items-center justify-center gap-1.5 text-gold">
          <Heart size={13} /> {t('favorites.note')}
        </p>
      </div>
    </div>
  )
}