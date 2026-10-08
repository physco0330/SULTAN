import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Heart, ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types'
import { Badge } from '@/components/Badge'
import { Price } from '@/components/Price'
import { Rating } from '@/components/Rating'
import { Modal } from '@/components/Modal'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { t } = useTranslation()
  const [quickView, setQuickView] = useState(false)
  const [size, setSize] = useState<string | null>(null)
  const [color, setColor] = useState(product.colors[0]?.id ?? '')

  const addItem = useCart((s) => s.addItem)
  const wishlist = useWishlist((s) => s.ids)
  const toggleWish = useWishlist((s) => s.toggle)
  const pushToast = useUi((s) => s.pushToast)

  const wished = wishlist.includes(product.id)

  const quickAdd = (p: Product, chosenSize: string) => {
    addItem(p, chosenSize, color, 1)
    pushToast(`${p.name} — ${t('misc.added')}`)
  }

  return (
    <>
      <article className={cn('group relative', className)}>
        <Link
          to={`/producto/${product.slug}`}
          className="relative block aspect-[3/4] overflow-hidden bg-ash"
          aria-label={product.name}
        >
          <img
            src={product.images[0]?.src}
            alt={product.images[0]?.alt ?? product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-0"
          />
          <img
            src={product.images[1]?.src ?? product.images[0]?.src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
          />
          <span className="pointer-events-none absolute inset-0 bg-night/0 transition-colors duration-500 group-hover:bg-night/30" />

          <span className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
            {product.isNew && <Badge tone="silver">{t('badges.new')}</Badge>}
            {product.isLimited && <Badge tone="gold">{t('badges.limited')}</Badge>}
            {product.isOnSale && <Badge tone="outline">{t('badges.sale')}</Badge>}
          </span>
        </Link>

        <button
          onClick={(e) => {
            e.preventDefault()
            toggleWish(product.id)
            pushToast(wished ? t('favorites.removed') : t('favorites.added'), wished ? 'info' : 'success')
          }}
          aria-label={t('product.addWishlist')}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center border border-gold/40 bg-night/50 text-silver backdrop-blur transition-all duration-300 hover:border-gold hover:text-gold"
        >
          <Heart size={15} className={cn('transition-transform duration-300', wished && 'fill-gold-soft text-gold-soft animate-toggle')} />
        </button>

        <button
          onClick={() => setQuickView(true)}
          className="absolute right-3 top-[3.5rem] z-20 flex h-9 w-9 items-center justify-center border border-gold/40 bg-night/50 text-silver backdrop-blur transition-all duration-300 hover:border-gold hover:text-gold"
          aria-label={t('misc.view')}
        >
          <Eye size={15} />
        </button>

        <div className="relative z-10 -mt-px border border-gold/15 border-t-0 bg-carbon px-4 pb-5 pt-4 transition-colors duration-300 group-hover:border-gold/35">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.28em] text-bone">
              {t(`catalog.types.${product.category}`)}
            </p>
            <Rating value={product.rating} />
          </div>
          <h3 className="mt-1.5 font-display text-[1.05rem] leading-snug text-ivory transition-colors group-hover:text-gold-soft">
            <Link to={`/producto/${product.slug}`} className="focus:outline-none after:absolute after:inset-0 after:z-0">
              {product.name}
            </Link>
          </h3>
          <div className="mt-2 flex items-end justify-between gap-2">
            <Price price={product.price} compareAtPrice={product.compareAtPrice} />
            <button
              onClick={() => quickAdd(product, product.sizes.includes('M') ? 'M' : product.sizes[0])}
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-gold text-night transition-all duration-300 hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('product.addToCart')}
              disabled={product.stock === 0}
            >
              <ShoppingBag size={15} />
            </button>
          </div>
        </div>
      </article>

      <Modal open={quickView} onClose={() => setQuickView(false)} title={product.name} maxWidth="max-w-4xl">
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="aspect-[3/4] overflow-hidden border border-gold/15 bg-ash">
            <img
              src={product.images[0]?.src}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <Rating value={product.rating} count={product.reviews} />
            <Price price={product.price} compareAtPrice={product.compareAtPrice} large className="mt-3" />
            <p className="mt-4 text-sm font-light leading-relaxed text-bone">{product.description}</p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bone">
                {t('product.selectColor')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColor(c.id)}
                    aria-label={c.name}
                    className={cn(
                      'h-7 w-7 rounded-full border transition-all',
                      color === c.id ? 'border-gold ring-2 ring-gold/40 ring-offset-2 ring-offset-carbon' : 'border-bone/40',
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bone">
                {t('product.selectSize')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      'min-w-[2.75rem] border px-3 py-2 text-xs font-medium transition-all',
                      size === s ? 'border-gold bg-gold text-night' : 'border-bone/40 text-ivory hover:border-gold',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {product.stock <= 5 && product.stock > 0 && (
              <p className="mt-4 text-xs text-gold">{t('product.lowStock')} — {product.stock} {t('misc.view').toLowerCase()}</p>
            )}

            <div className="mt-6">
              <button
                disabled={product.stock === 0}
                onClick={() => {
                  if (product.stock === 0) return
                  if (!size) {
                    pushToast(t('misc.selectSizeToast'), 'error')
                    return
                  }
                  quickAdd(product, size)
                  setQuickView(false)
                }}
                className="flex w-full items-center justify-center gap-2 bg-gold px-3 py-3.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-night transition-all hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingBag size={14} /> {t('product.addToCart')}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}