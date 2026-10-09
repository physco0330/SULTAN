import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCart } from '@/store/cart'
import { useCurrency } from '@/store/currency'
import { useUi } from '@/store/ui'
import { convertPrice, formatPrice } from '@/data/currencies'
import { placeOrder, validateCoupon } from '@/services/productService'
import { ApiError } from '@/services/api'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { brandConfig } from '@/config/brand'
import { cn } from '@/utils/cn'

export default function Checkout() {
  const { t } = useTranslation()
  const items = useCart((s) => s.items)
  const clear = useCart((s) => s.clear)
  const promoCode = useCart((s) => s.promoCode)
  const code = useCurrency((s) => s.code)
  const pushToast = useUi((s) => s.pushToast)
  const cfg = useStoreConfig()

  const subtotalUsd = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items])
  const [discountUsd, setDiscountUsd] = useState(0)
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    if (!promoCode) {
      setDiscountUsd(0)
      return
    }
    let dead = false
    validateCoupon(promoCode, subtotalUsd)
      .then((r) => {
        if (!dead) setDiscountUsd(r.valid ? r.discount : 0)
      })
      .catch(() => {
        if (!dead) setDiscountUsd(0)
      })
    return () => {
      dead = true
    }
  }, [promoCode, subtotalUsd])

  const shippingUsd = subtotalUsd - discountUsd >= cfg.freeShippingThreshold ? 0 : cfg.flatShipping
  const totalUsd = Math.max(subtotalUsd - discountUsd, 0) + shippingUsd

  const money = (usd: number) => formatPrice(convertPrice(usd, 'USD', code), code)

  const buildWaMessage = (orderNumber: string) => {
    const lines: (string | null)[] = [
      `*SULTAN BLACK — ${t('wa.waOrder')}: ${orderNumber}*`,
      `${t('wa.waDate')}: ${new Date().toLocaleString()}`,
      '',
      `*${t('wa.waCustomer')}*`,
      `${t('checkout.fullName')}: ${form.name}`,
      form.phone.trim() ? `${t('checkout.phone')}: ${form.phone}` : null,
      `${t('checkout.email')}: ${form.email}`,
      `${t('checkout.address')}: ${form.address}`,
      `${t('checkout.city')}: ${form.city}`,
      `${t('checkout.zip')}: ${form.zip}`,
      `${t('checkout.country')}: ${form.country}`,
      '',
      `*${t('wa.waItems')}*`,
      ...items.map(
        (it) =>
          `• ${it.name} — ${it.size} / ${it.color} ×${it.quantity} = ${money(it.price * it.quantity)}`,
      ),
      '',
      `${t('cart.subtotal')}: ${money(subtotalUsd)}`,
      discountUsd > 0 ? `${t('cart.discount')}: −${money(discountUsd)}` : null,
      `${t('cart.shipping')}: ${shippingUsd === 0 ? t('misc.freeShippingBadge') : money(shippingUsd)}`,
      `*${t('cart.total')}: ${money(totalUsd)}*`,
      promoCode ? `${t('cart.promo')}: ${promoCode}` : null,
    ]
    return lines.filter((l): l is string => l !== null).join('\n')
  }

  const waUrlFor = (orderNumber: string) =>
    `https://wa.me/${brandConfig.whatsappNumber}?text=${encodeURIComponent(buildWaMessage(orderNumber))}`

  const [placed, setPlaced] = useState<{ number: string; offline: boolean; waUrl: string } | null>(null)
  const [form, setForm] = useState({
    email: '', name: '', city: '', address: '', zip: '', country: '', phone: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: '' }))
  }

  const validate = () => {
    const er: Record<string, string> = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = t('checkout.errEmail')
    if (form.name.trim().length < 3) er.name = t('checkout.errName')
    if (form.address.trim().length < 5) er.address = t('checkout.errAddress')
    if (form.city.trim().length < 2) er.city = t('checkout.errCity')
    if (form.zip.trim().length < 3) er.zip = t('checkout.errZip')
    if (form.country.trim().length < 2) er.country = t('checkout.errCountry')
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || placing) return
    setPlacing(true)
    try {
      const order = await placeOrder({
        items: items.map((it) => ({
          id: it.productId,
          slug: it.slug,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
        })),
        customer: {
          email: form.email,
          name: form.name,
          phone: form.phone,
          city: form.city,
          country: form.country,
          address: form.address,
          zip: form.zip,
        },
        promoCode,
      })
      clear()
      setPlaced({ number: order.number, offline: false, waUrl: waUrlFor(order.number) })
      window.open(waUrlFor(order.number), '_blank', 'noopener,noreferrer')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        pushToast(err.message, 'error')
      } else {
        const number = `S-${Math.floor(100000 + Math.random() * 899999)}`
        clear()
        setPlaced({ number, offline: true, waUrl: waUrlFor(number) })
        pushToast('Modo demostración: sin conexión al servidor, pedido simulado', 'info')
        window.open(waUrlFor(number), '_blank', 'noopener,noreferrer')
      }
    } finally {
      setPlacing(false)
      window.scrollTo({ top: 0 })
    }
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 text-gold">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="font-display mt-6 text-3xl font-semibold text-ivory">{t('checkout.thankYou')}</h1>
        <p className="mt-3 text-sm text-bone">{t('checkout.orderNumber')}: <span className="text-gold">{placed.number}</span></p>
        <p className="mt-4 text-sm font-light leading-relaxed text-silver">
          {placed.offline ? t('checkout.offlineNote') : t('checkout.confirmationSent')}
        </p>
        <a
          href={placed.waUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex w-full items-center justify-center gap-3 bg-[#25D366] px-6 py-4 text-xs font-bold uppercase tracking-[0.28em] text-white transition-all hover:bg-[#1ebe5d]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          {t('wa.waButton')}
        </a>
        <p className="mt-3 text-xs font-light leading-relaxed text-bone">{t('wa.waNote')}</p>
        <Link to="/catalogo" className="mt-8 inline-block border border-gold/50 px-8 py-3.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
          {t('cart.continue')}
        </Link>
      </div>
    )
  }

  const input = (k: keyof typeof form, placeholder: string) => (
    <input
      value={form[k]}
      onChange={set(k)}
      placeholder={placeholder}
      aria-invalid={!!errors[k]}
      className={cn(
        'w-full border bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:outline-none',
        errors[k] ? 'border-red-500/70 focus:border-red-500' : 'border-gold/25 focus:border-gold',
      )}
    />
  )

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('checkout.title')}</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gold flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} /> {t('checkout.secure')}
        </p>
      </header>

      <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="border border-gold/15 p-6 md:p-8">
            <h2 className="font-display mb-5 text-lg text-ivory">1 · {t('checkout.contact')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{input('email', t('checkout.email'))}</div>
              <div>{input('name', t('checkout.fullName'))}</div>
              <div>{input('phone', t('checkout.phone'))}</div>
            </div>
          </section>

          <section className="border border-gold/15 p-6 md:p-8">
            <h2 className="font-display mb-5 text-lg text-ivory">2 · {t('checkout.shippingAddress')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>{input('country', t('checkout.country'))}</div>
              <div>{input('city', t('checkout.city'))}</div>
              <div className="sm:col-span-2">{input('address', t('checkout.address'))}</div>
              <div>{input('zip', t('checkout.zip'))}</div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-bone">
              <ShieldCheck size={14} className="text-gold" /> {t('checkout.paymentHandled')}
            </div>
          </section>

          <section className="border border-gold/15 p-6 md:p-8">
            <h2 className="font-display mb-5 text-lg text-ivory">3 · {t('checkout.payment')}</h2>
            <div className="flex flex-wrap gap-2 text-[0.62rem] uppercase tracking-widest text-bone">
              {['VISA', 'MASTERCARD', 'AMEX', 'PAYPAL', 'APPLE PAY', 'GOOGLE PAY'].map((m) => (
                <span key={m} className="border border-gold/25 px-3 py-2 text-gold">{m}</span>
              ))}
            </div>
            <p className="mt-4 text-sm font-light leading-relaxed text-bone">
              {t('checkout.mockNote')}
            </p>
          </section>
        </div>

        <aside className="h-fit border border-gold/15 bg-carbon/60 p-6 lg:sticky lg:top-28">
          <h2 className="font-display mb-4 text-lg text-ivory">{t('checkout.summary')}</h2>
          {items.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-bone">{t('cart.empty')}</p>
              <Link to="/catalogo" className="mt-4 inline-block border border-gold/50 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
                {t('cart.continue')}
              </Link>
            </div>
          ) : (
            <>
              <ul className="max-h-56 space-y-3 overflow-auto pr-1">
                {items.map((it) => (
                  <li key={`${it.productId}-${it.size}-${it.color}`} className="flex items-center gap-3">
                    <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden border border-gold/15">
                      <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-gold text-[0.6rem] font-bold text-night">{it.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ivory">{it.name}</p>
                      <p className="text-xs text-bone">{it.size} · {it.color}</p>
                    </div>
                    <p className="text-sm text-silver">{formatPrice(convertPrice(it.price * it.quantity, 'USD', code), code)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2.5 border-t border-gold/15 pt-4 text-sm">
                <div className="flex justify-between text-bone"><span>{t('cart.subtotal')}</span><span className="text-ivory">{formatPrice(convertPrice(subtotalUsd, 'USD', code), code)}</span></div>
                {discountUsd > 0 && <div className="flex justify-between text-bone"><span>{t('cart.discount')}</span><span className="text-gold">−{formatPrice(convertPrice(discountUsd, 'USD', code), code)}</span></div>}
                <div className="flex justify-between text-bone"><span>{t('cart.shipping')}</span><span className="text-ivory">{shippingUsd === 0 ? t('misc.freeShippingBadge') : formatPrice(convertPrice(shippingUsd, 'USD', code), code)}</span></div>
                <div className="flex justify-between border-t border-gold/15 pt-3">
                  <span className="text-ivory">{t('cart.total')}</span>
                  <span className="font-display text-xl text-gold">{formatPrice(convertPrice(totalUsd, 'USD', code), code)}</span>
                </div>
              </div>
              <button type="submit" disabled={placing} className="mt-6 flex w-full items-center justify-center bg-gold px-6 py-4 text-xs font-bold uppercase tracking-[0.28em] text-night transition-all hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50">
                {placing ? '···' : `${t('checkout.placeOrder')} →`}
              </button>
              <p className="mt-3 text-center text-[0.62rem] leading-relaxed text-bone">{t('checkout.terms')}</p>
            </>
          )}
        </aside>
      </form>
    </div>
  )
}