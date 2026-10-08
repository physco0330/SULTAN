import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CartItem } from '@/types'
import { Drawer } from '@/components/Drawer'
import { useCart, cartKey } from '@/store/cart'
import { convertPrice, formatPrice } from '@/data/currencies'
import { useCurrency } from '@/store/currency'
import { applyPromo, discountAmount, FLAT_SHIPPING_USD, FREE_SHIPPING_THRESHOLD_USD } from '@/services/discounts'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'

function formatIn(usd: number, code: string) {
  return formatPrice(convertPrice(usd, 'USD', code), code)
}

function LineItem({ item, index }: { item: CartItem; index: number }) {
  const { t } = useTranslation()
  const remove = useCart((s) => s.removeItem)
  const updateQty = useCart((s) => s.updateQty)
  const code = useCurrency((s) => s.code)
  const key = cartKey(item.productId, item.size, item.color)

  return (
    <li className={cn('flex gap-4 border-b border-gold/10 py-4', index === 0 && 'pt-2')}>
      <Link to={`/producto/${item.slug}`} className="block h-24 w-[4.5rem] shrink-0 overflow-hidden border border-gold/15 bg-ash">
        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/producto/${item.slug}`} className="font-display text-sm leading-tight text-ivory hover:text-gold">
            {item.name}
          </Link>
          <button
            onClick={() => remove(key)}
            aria-label={t('cart.remove')}
            className="text-bone transition-colors hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-bone">
          {t('cart.size')}: {item.size} · {t('cart.color')}: {item.color}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center border border-gold/25">
            <button
              onClick={() => updateQty(key, item.quantity - 1)}
              aria-label="−"
              className="flex h-8 w-8 items-center justify-center text-silver hover:text-gold"
            >
              <Minus size={13} />
            </button>
            <span className="w-8 text-center text-sm text-ivory">{item.quantity}</span>
            <button
              onClick={() => updateQty(key, item.quantity + 1)}
              aria-label="+"
              className="flex h-8 w-8 items-center justify-center text-silver hover:text-gold"
            >
              <Plus size={13} />
            </button>
          </div>
          <span className="text-sm font-medium text-gold">{formatIn(item.price * item.quantity, code)}</span>
        </div>
      </div>
    </li>
  )
}

export function CartDrawer() {
  const { t } = useTranslation()
  const open = useCart((s) => s.cartOpen)
  const close = useCart((s) => s.closeCart)
  const items = useCart((s) => s.items)
  const promoCode = useCart((s) => s.promoCode)
  const setPromo = useCart((s) => s.setPromo)
  const code = useCurrency((s) => s.code)
  const pushToast = useUi((s) => s.pushToast)
  const [promoInput, setPromoInput] = useState('')

  const subtotalUsd = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountUsd = promoCode ? discountAmount(promoCode, subtotalUsd) : 0
  const shippingUsd = subtotalUsd - discountUsd === 0 || subtotalUsd - discountUsd >= FREE_SHIPPING_THRESHOLD_USD ? 0 : FLAT_SHIPPING_USD
  const totalUsd = Math.max(subtotalUsd - discountUsd, 0) + shippingUsd
  const remainingUsd = Math.max(FREE_SHIPPING_THRESHOLD_USD - (subtotalUsd - discountUsd), 0)
  const progress = Math.min(((subtotalUsd - discountUsd) / FREE_SHIPPING_THRESHOLD_USD) * 100, 100)

  const tryPromo = () => {
    const r = applyPromo(promoInput, subtotalUsd)
    if (r.valid) {
      setPromo(r.code)
      setPromoInput('')
      pushToast(t('cart.promoApplied', { code: r.code }))
    } else {
      pushToast(t('cart.promoInvalid'), 'error')
    }
  }

  return (
    <Drawer open={open} onClose={close} title={t('cart.drawerTitle')} position="right" size="lg">
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <svg viewBox="0 0 64 64" className="h-16 w-16 opacity-60" aria-hidden="true">
            <rect x="2" y="2" width="60" height="60" rx="6" fill="none" stroke="#C9A227" strokeWidth="1.5" />
            <path d="M20 18h24l-3 6H23z" fill="#C9A227" opacity="0.8" />
          </svg>
          <p className="font-display text-lg text-ivory">{t('cart.empty')}</p>
          <p className="text-sm text-bone">{t('cart.emptyHint')}</p>
          <Link
            to="/catalogo"
            onClick={close}
            className="mt-2 border border-gold/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold transition-colors hover:bg-gold hover:text-night"
          >
            {t('cart.continue')}
          </Link>
        </div>
      ) : (
        <>
          <div className="h-1 w-full bg-onyx">
            <div className="h-full bg-gold-gradient transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <p className={cn('px-5 pb-1 pt-3 text-xs', remainingUsd > 0 ? 'text-bone' : 'text-gold')}>
            {remainingUsd > 0 ? t('cart.freeShipping', { amount: formatIn(remainingUsd, code) }) : t('cart.freeShippingMet')}
          </p>

          <ul className="px-5">
            {items.map((item, i) => (
              <LineItem key={cartKey(item.productId, item.size, item.color)} item={item} index={i} />
            ))}
          </ul>

          <div className="mt-4 px-5">
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder={t('cart.promoPlaceholder')}
                aria-label={t('cart.promo')}
                className="min-w-0 flex-1 border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
              />
              <button
                onClick={tryPromo}
                className="border border-gold/50 px-4 text-xs font-semibold uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-night"
              >
                {t('cart.apply')}
              </button>
            </div>
            {promoCode && (
              <p className="mt-2 text-xs text-gold">
                {t('cart.promoApplied', { code: promoCode })} — −{formatIn(discountUsd, code)}
              </p>
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-gold/15 px-5 pt-4 text-sm">
            <div className="flex justify-between text-bone">
              <span>{t('cart.subtotal')}</span>
              <span className="text-ivory">{formatIn(subtotalUsd, code)}</span>
            </div>
            <div className="flex justify-between text-bone">
              <span>{t('cart.shipping')}</span>
              <span className="text-ivory">{shippingUsd === 0 ? t('misc.freeShippingBadge') : formatIn(shippingUsd, code)}</span>
            </div>
            {discountUsd > 0 && (
              <div className="flex justify-between text-bone">
                <span>{t('cart.discount')}</span>
                <span className="text-gold">−{formatIn(discountUsd, code)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gold/15 pt-3 font-medium">
              <span className="text-ivory">{t('cart.total')}</span>
              <span className="font-display text-lg text-gold">{formatIn(totalUsd, code)}</span>
            </div>
          </div>

          <div className="mt-5 px-5 pb-6">
            <Link
              to="/checkout"
              onClick={close}
              className="flex w-full items-center justify-center bg-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.28em] text-night transition-all hover:bg-gold-soft"
            >
              {t('cart.checkout')} →
            </Link>
            <p className="mt-3 text-center text-[0.62rem] uppercase tracking-widest text-bone">
              {t('checkout.secure')} · {t('checkout.protected')}
            </p>
          </div>
        </>
      )}
    </Drawer>
  )
}