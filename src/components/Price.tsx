import { convertPrice, formatPrice } from '@/data/currencies'
import { useCurrency } from '@/store/currency'
import { cn } from '@/utils/cn'

interface PriceProps {
  price: number
  compareAtPrice?: number
  currency?: string
  className?: string
  large?: boolean
}

export function Price({ price, compareAtPrice, currency = 'USD', className, large }: PriceProps) {
  const code = useCurrency((s) => s.code)
  const shown = formatPrice(convertPrice(price, currency, code), code)
  /* Solo se tacha el precio normal si es un valor sensato y mayor que el precio
   * cobrado: así nunca se muestra un precio antiguo corrupto (p. ej. 1e19). */
  const valid =
    typeof compareAtPrice === 'number' &&
    Number.isFinite(compareAtPrice) &&
    compareAtPrice > price &&
    price > 0 &&
    compareAtPrice / price <= 50
  const was = valid ? formatPrice(convertPrice(compareAtPrice, currency, code), code) : null

  return (
    <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-medium text-ivory', large && 'text-2xl md:text-3xl font-display')}>
        {shown}
      </span>
      {was && (
        <span className="text-sm text-bone line-through decoration-gold/60">{was}</span>
      )}
    </span>
  )
}