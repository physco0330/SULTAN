import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Share2, ShieldCheck, ShoppingBag, Copy, Heart, Minus, Plus, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getProduct } from '@/data/products'
import { fetchProductById } from '@/services/productService'
import { useCatalog } from '@/hooks/useCatalog'
import { Badge } from '@/components/Badge'
import { Price } from '@/components/Price'
import { Rating } from '@/components/Rating'
import { AccordionItem } from '@/components/Accordion'
import { Modal } from '@/components/Modal'
import { ProductGrid } from '@/components/ProductGrid'
import { Reveal } from '@/components/Reveal'
import { useCart } from '@/store/cart'
import { useWishlist } from '@/store/wishlist'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'
import type { Product } from '@/types'

const SIZE_CHART = [
  { size: 'XS', chest: '84–88', waist: '68–72', hips: '88–92' },
  { size: 'S', chest: '88–92', waist: '72–76', hips: '92–96' },
  { size: 'M', chest: '92–96', waist: '76–80', hips: '96–100' },
  { size: 'L', chest: '96–100', waist: '80–84', hips: '100–104' },
  { size: 'XL', chest: '100–106', waist: '84–90', hips: '104–110' },
  { size: 'XXL', chest: '106–112', waist: '90–96', hips: '110–116' },
  { size: 'XXXL', chest: '112–118', waist: '96–102', hips: '116–122' },
]

export default function Product() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { products } = useCatalog()

  const [serverProduct, setServerProduct] = useState<Product | undefined>()
  const product = serverProduct ?? (slug ? getProduct(slug) : undefined)

  const [activeImg, setActiveImg] = useState(0)
  const [size, setSize] = useState<string | null>(null)
  const [color, setColor] = useState<string>('')
  const [qty, setQty] = useState(1)
  const [sizeGuide, setSizeGuide] = useState(false)
  const [copied, setCopied] = useState(false)

  const addItem = useCart((s) => s.addItem)
  const wishlist = useWishlist((s) => s.ids)
  const toggleWish = useWishlist((s) => s.toggle)
  const pushToast = useUi((s) => s.pushToast)

  useEffect(() => {
    setServerProduct(undefined)
    if (!slug) return
    let dead = false
    fetchProductById(slug)
      .then((p) => {
        if (dead || !p) return
        setServerProduct(p)
      })
      .catch(() => {
        /* fallback to local mock */
      })
    return () => {
      dead = true
    }
  }, [slug])

  const related = useMemo(() => {
    if (!product) return []
    return products
      .filter((p) => p.id !== product.id && (p.gender === product.gender || p.category === product.category))
      .slice(0, 4)
  }, [products, product])

  useEffect(() => {
    setSize(null)
    setColor(product?.colors[0]?.id ?? '')
    setQty(1)
    setActiveImg(0)
    window.scrollTo({ top: 0 })
  }, [product?.id])

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <p className="font-display text-3xl text-ivory">404</p>
        <p className="mt-3 text-bone">{t('misc.emptyStateTitle')}</p>
        <Link to="/catalogo" className="mt-8 inline-block border border-gold/50 px-8 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
          {t('cart.continue')}
        </Link>
      </div>
    )
  }

  const wished = wishlist.includes(product.id)
  const sizeGuideOpen = sizeGuide

  const ensureSelection = () => {
    if (!size) {
      pushToast(t('misc.selectSizeToast'), 'error')
      return false
    }
    return true
  }

  const handleAdd = () => {
    if (!ensureSelection()) return
    addItem(product, size as string, color, qty)
    pushToast(`${product.name} — ${t('misc.added')}`)
  }

  const handleBuyNow = () => {
    if (!ensureSelection()) return
    addItem(product, size as string, color, qty)
    navigate('/checkout')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      pushToast(t('product.copyLink'), 'info')
    }
  }

  const shareUrl = encodeURIComponent(window.location.href)

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 lg:px-8">
      <nav aria-label="Breadcrumb" className="py-6 text-xs uppercase tracking-widest text-bone">
        <Link to="/" className="hover:text-gold">{t('nav.home')}</Link> <span className="mx-2 text-gold/50">/</span>
        <Link to={product.gender === 'men' ? '/hombre' : '/mujer'} className="hover:text-gold">
          {product.gender === 'men' ? t('nav.men') : t('nav.women')}
        </Link> <span className="mx-2 text-gold/50">/</span>
        <span className="text-gold">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="group relative overflow-hidden border border-gold/15 bg-ash">
            <img
              src={product.images[activeImg]?.src}
              alt={product.name}
              className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              {product.isNew && <Badge tone="silver">{t('badges.new')}</Badge>}
              {product.isLimited && <Badge tone="gold">{t('badges.limited')}</Badge>}
              {product.isOnSale && <Badge tone="outline">{t('badges.sale')}</Badge>}
            </div>
            <ZoomIn size={20} className="absolute bottom-4 right-4 text-gold/70" aria-hidden="true" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                aria-label={`${product.name} — ${i + 1}`}
                className={cn(
                  'aspect-[3/4] overflow-hidden border transition-all',
                  i === activeImg ? 'border-gold' : 'border-gold/15 hover:border-gold/50',
                )}
              >
                <img src={img.src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="lg:pl-4">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.34em] text-gold">
            {t(`catalog.types.${product.category}`)}
            {product.collection !== 'offers' && <span className="text-bone"> · {product.collection.toUpperCase()}</span>}
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold leading-tight text-ivory md:text-4xl">
            {product.name}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <Rating value={product.rating} count={product.reviews} />
            <span className="text-xs text-bone">{t('product.sku')}: {product.sku}</span>
          </div>

          <div className="mt-5">
            <Price price={product.price} compareAtPrice={product.compareAtPrice} large />
          </div>
          <p className="mt-4 text-sm font-light leading-relaxed text-bone">{product.description}</p>

          <p className={cn('mt-4 text-xs font-medium uppercase tracking-widest', availabilityColor(product.stock))}>
            {availabilityLabel(product.stock, t)}
          </p>

          {/* Color */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bone">{t('product.selectColor')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  aria-label={`${c.name} ${c.id === color ? '✓' : ''}`}
                  className={cn(
                    'h-8 w-8 rounded-full border transition-all',
                    c.id === color ? 'border-gold ring-2 ring-gold/40 ring-offset-2 ring-offset-night' : 'border-bone/40 hover:border-gold',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bone">{t('product.selectSize')}</p>
              <button onClick={() => setSizeGuide(true)} className="text-xs text-gold underline underline-offset-4 hover:text-gold-soft">
                {t('product.sizeGuide')}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    'min-w-[3rem] border px-4 py-2.5 text-sm font-medium transition-all',
                    size === s ? 'border-gold bg-gold text-night' : 'border-bone/40 text-ivory hover:border-gold hover:text-gold',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Qty + actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-gold/25">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="−" className="flex h-12 w-11 items-center justify-center text-silver hover:text-gold">
                <Minus size={15} />
              </button>
              <span className="w-10 text-center text-ivory">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="+" className="flex h-12 w-11 items-center justify-center text-silver hover:text-gold">
                <Plus size={15} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className="flex h-12 flex-1 items-center justify-center gap-2 bg-gold px-8 text-xs font-bold uppercase tracking-[0.24em] text-night transition-all hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingBag size={15} /> {t('product.addToCart')}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="flex h-12 items-center justify-center border border-gold/60 px-8 text-xs font-semibold uppercase tracking-[0.24em] text-gold transition-all hover:bg-gold hover:text-night disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('product.buyNow')}
            </button>
            <button
              onClick={() => {
                toggleWish(product.id)
                pushToast(wished ? t('favorites.removed') : t('favorites.added'), wished ? 'info' : 'success')
              }}
              aria-label={t('product.addWishlist')}
              className={cn(
                'flex h-12 w-12 items-center justify-center border transition-all',
                wished ? 'border-gold bg-gold text-night' : 'border-gold/40 text-gold hover:bg-gold/10',
              )}
            >
              <Heart size={17} className={cn(wished && 'fill-night')} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 border border-gold/15 bg-carbon/60 px-4 py-3 text-xs text-bone">
            <ShieldCheck size={15} className="shrink-0 text-gold" />
            {t('checkout.secure')} · {t('checkout.international')} · {t('sections.marquee.returns')}
          </div>

          {/* Accordions */}
          <div className="mt-8">
            <AccordionItem title={t('product.description')} defaultOpen>
              {product.description}
            </AccordionItem>
            <AccordionItem title={t('product.material')}>{product.material}</AccordionItem>
            <AccordionItem title={t('product.manufacturing')}>{t('product.manufacturingText')}</AccordionItem>
            <AccordionItem title={t('product.care')}>{t('product.careText')}</AccordionItem>
            <AccordionItem title={t('product.shippingTab')}>{t('sections.marquee.international')} · {t('sections.marquee.freeShipping')}</AccordionItem>
            <AccordionItem title={t('product.returns')}>{t('product.returnsText')}</AccordionItem>
          </div>

          {/* Share */}
          <div className="mt-8 flex items-center gap-3 border-t border-gold/15 pt-5">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-bone">{t('product.share')}</span>
            <a href={`https://wa.me/?text=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver hover:border-gold hover:text-gold">
              <Share2 size={14} />
            </a>
            <a href={`https://instagram.com/share?url=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver hover:border-gold hover:text-gold">
              <Share2 size={14} />
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver hover:border-gold hover:text-gold">
              <Share2 size={14} />
            </a>
            <button onClick={copyLink} className="flex h-9 items-center gap-2 border border-gold/30 px-3 text-xs text-silver hover:border-gold hover:text-gold">
              <Copy size={13} /> {copied ? t('product.copied') : t('product.copyLink')}
            </button>
          </div>
        </div>
      </div>

      {/* Related */}
      <section className="mt-24">
        <Reveal>
          <h2 className="mb-10 text-center font-display text-2xl font-semibold text-ivory md:text-4xl">
            {t('product.related')}
          </h2>
        </Reveal>
        <ProductGrid products={related} columns={4} />
      </section>

      {/* Size guide modal */}
      <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuide(false)} />
    </div>
  )
}

function availabilityColor(stock: number) {
  if (stock === 0) return 'text-red-400'
  if (stock <= 8) return 'text-gold'
  return 'text-silver'
}

function availabilityLabel(stock: number, t: (k: string) => string) {
  if (stock === 0) return t('product.outOfStock')
  if (stock <= 8) return `${t('product.lowStock')} — ${stock}`
  return t('product.inStock')
}

function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('product.sizeGuideTitle')}>
      <div className="p-6">
        <p className="mb-4 text-sm text-bone">{t('product.sizeGuideNote')}</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gold/30 text-left text-[0.66rem] uppercase tracking-[0.2em] text-gold">
              <th className="py-2 pr-4">{t('product.sizeTableSize')}</th>
              <th className="py-2 pr-4">{t('product.sizeTableChest')}</th>
              <th className="py-2 pr-4">{t('product.sizeTableWaist')}</th>
              <th className="py-2">{t('product.sizeTableHips')}</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_CHART.map((r) => (
              <tr key={r.size} className="border-b border-gold/10">
                <td className="py-2.5 pr-4 font-medium text-ivory">{r.size}</td>
                <td className="py-2.5 pr-4 text-bone">{r.chest}</td>
                <td className="py-2.5 pr-4 text-bone">{r.waist}</td>
                <td className="py-2.5 text-bone">{r.hips}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}