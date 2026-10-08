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
  const was = compareAtPrice ? formatPrice(convertPrice(compareAtPrice, currency, code), code) : null

  return (
    <span className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('font-medium text-ivory', large && 'text-2xl md:text-3xl font-display')}>
        {shown}
      </span>
      {was && (
        <span className="text-sm text-bone line-through decoration-gold/60">{was}</span>
      )}
    </span>
  )
}