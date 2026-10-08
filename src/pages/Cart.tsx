import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCart, cartKey } from '@/store/cart'
import { useCurrency } from '@/store/currency'
import { convertPrice, formatPrice } from '@/data/currencies'
import { applyPromo, discountAmount } from '@/services/discounts'
import { validateCoupon } from '@/services/productService'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'

function fmt(usd: number, code: string) {
  return formatPrice(convertPrice(usd, 'USD', code), code)
}

export default function CartPage() {
  const { t } = useTranslation()
  const items = useCart((s) => s.items)
  const removeItem = useCart((s) => s.removeItem)
  const updateQty = useCart((s) => s.updateQty)
  const promoCode = useCart((s) => s.promoCode)
  const setPromo = useCart((s) => s.setPromo)
  const code = useCurrency((s) => s.code)
  const pushToast = useUi((s) => s.pushToast)
  const cfg = useStoreConfig()
  const [promoInput, setPromoInput] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)

  const subtotalUsd = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountUsd = promoCode ? discountAmount(promoCode, subtotalUsd) : 0
  const shippingUsd = subtotalUsd - discountUsd >= cfg.freeShippingThreshold ? 0 : cfg.flatShipping
  const totalUsd = Math.max(subtotalUsd - discountUsd, 0) + shippingUsd

  const tryPromo = async () => {
    const codeToCheck = promoInput.trim()
    if (!codeToCheck || promoBusy) return
    setPromoBusy(true)
    try {
      const r = await validateCoupon(codeToCheck, subtotalUsd)
      if (r.valid) {
        setPromo(r.code)
        setPromoInput('')
        pushToast(t('cart.promoApplied', { code: r.code }))
      } else {
        const local = applyPromo(codeToCheck, subtotalUsd)
        if (local.valid) {
          setPromo(local.code)
          setPromoInput('')
          pushToast(t('cart.promoApplied', { code: local.code }))
        } else {
          pushToast(t('cart.promoInvalid'), 'error')
        }
      }
    } finally {
      setPromoBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('cart.title')}</h1>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="font-display text-xl text-ivory">{t('cart.empty')}</p>
          <p className="text-sm text-bone">{t('cart.emptyHint')}</p>
          <Link to="/catalogo" className="mt-2 border border-gold/50 px-8 py-3.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
            {t('cart.continue')}
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden border border-gold/15">
            <div className="hidden grid-cols-[80px_1fr_90px_120px] gap-4 border-b border-gold/15 px-5 py-3 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-bone md:grid">
              <span>{t('product.featured')}</span>
              <span>{t('cart.title')}</span>
              <span className="text-center">{t('cart.qty')}</span>
              <span className="text-right">{t('misc.price')}</span>
            </div>
            <ul>
              {items.map((item) => {
                const key = cartKey(item.productId, item.size, item.color)
                return (
                  <li key={key} className="grid grid-cols-[64px_1fr] gap-4 border-b border-gold/10 px-5 py-5 md:grid-cols-[80px_1fr_90px_120px] md:items-center">
                    <Link to={`/producto/${item.slug}`} className="block aspect-[3/4] max-h-24 overflow-hidden border border-gold/15">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </Link>
                    <div>
                      <Link to={`/producto/${item.slug}`} className="font-display text-sm text-ivory hover:text-gold">{item.name}</Link>
                      <p className="mt-1 text-xs text-bone">
                        {t('cart.size')}: {item.size} · {t('cart.color')}: {item.color}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gold md:hidden">{fmt(item.price * item.quantity, code)}</p>
                    </div>
                    <div className="flex items-center gap-2 md:justify-center">
                      <div className="flex items-center border border-gold/25">
                        <button onClick={() => updateQty(key, item.quantity - 1)} aria-label="−" className="flex h-8 w-8 items-center justify-center text-silver hover:text-gold"><Minus size={13} /></button>
                        <span className="w-8 text-center text-sm text-ivory">{item.quantity}</span>
                        <button onClick={() => updateQty(key, item.quantity + 1)} aria-label="+" className="flex h-8 w-8 items-center justify-center text-silver hover:text-gold"><Plus size={13} /></button>
                      </div>
                      <button onClick={() => removeItem(key)} aria-label={t('cart.remove')} className="ml-1 text-bone hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                    <p className="hidden text-right font-medium text-ivory md:block">{fmt(item.price * item.quantity, code)}</p>
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="h-fit border border-gold/15 bg-carbon/60 p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-lg text-ivory">{t('cart.drawerTitle')}</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder={t('cart.promoPlaceholder')}
                aria-label={t('cart.promo')}
                className="min-w-0 flex-1 border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
              />
              <button onClick={tryPromo} disabled={promoBusy} className="border border-gold/50 px-4 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night disabled:cursor-not-allowed disabled:opacity-50">
                {promoBusy ? '···' : t('cart.apply')}
              </button>
            </div>
            {promoCode && <p className="mt-2 text-xs text-gold">{t('cart.promoApplied', { code: promoCode })}</p>}

            <div className="mt-5 space-y-2.5 border-t border-gold/15 pt-4 text-sm">
              <div className="flex justify-between text-bone"><span>{t('cart.subtotal')}</span><span className="text-ivory">{fmt(subtotalUsd, code)}</span></div>
              <div className="flex justify-between text-bone"><span>{t('cart.shipping')}</span><span className="text-ivory">{shippingUsd === 0 ? t('misc.freeShippingBadge') : fmt(shippingUsd, code)}</span></div>
              {discountUsd > 0 && <div className="flex justify-between text-bone"><span>{t('cart.discount')}</span><span className="text-gold">−{fmt(discountUsd, code)}</span></div>}
              <div className="flex justify-between border-t border-gold/15 pt-3">
                <span className="text-ivory">{t('cart.total')}</span>
                <span className="font-display text-xl text-gold">{fmt(totalUsd, code)}</span>
              </div>
            </div>

            <Link to="/checkout" className={cn('mt-6 flex w-full items-center justify-center bg-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.28em] text-night transition-all hover:bg-gold-soft')}>
              {t('cart.checkout')} →
            </Link>
            <div className="mt-4 flex items-center justify-center gap-4 text-[0.62rem] uppercase tracking-widest text-bone">
              <span>🔒 {t('checkout.secure')}</span>
              <span>✓ {t('checkout.international')}</span>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}