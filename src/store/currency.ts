import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CURRENCY, convertPrice, formatPrice } from '@/data/currencies'

export interface CurrencyState {
  code: string
  setCode: (code: string) => void
}

export const useCurrency = create<CurrencyState>()(
  persist(
    (set) => ({
      code: DEFAULT_CURRENCY,
      setCode: (code) => set({ code }),
    }),
    { name: 'sultan-currency' },
  ),
)

/** Convert a price stored in its own currency (mock data uses USD internally)
 *  into the active display currency and format it. */
export function useDisplayPrice(price: number, fromCurrency = 'USD'): string {
  const code = useCurrency((s) => s.code)
  const converted = convertPrice(price, fromCurrency, code)
  return formatPrice(converted, code)
}

export function displayPriceOf(price: number, fromCurrency: string, toCurrency: string): string {
  return formatPrice(convertPrice(price, fromCurrency, toCurrency), toCurrency)
}