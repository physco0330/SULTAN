import type { Currency } from '@/types'

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, rate: 1, label: 'US Dollar' },
  { code: 'CNY', symbol: '¥', locale: 'zh-CN', decimals: 2, rate: 7.18, label: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 2, rate: 83.2, label: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2, rate: 0.92, label: 'Euro' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', decimals: 2, rate: 3.67, label: 'UAE Dirham' },
  { code: 'BDT', symbol: '৳', locale: 'bn-BD', decimals: 2, rate: 110.4, label: 'Bangladeshi Taka' },
  { code: 'BRL', symbol: 'R$', locale: 'pt-BR', decimals: 2, rate: 5.02, label: 'Brazilian Real' },
  { code: 'RUB', symbol: '₽', locale: 'ru-RU', decimals: 2, rate: 91.5, label: 'Russian Ruble' },
  { code: 'IDR', symbol: 'Rp', locale: 'id-ID', decimals: 0, rate: 15700, label: 'Indonesian Rupiah' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', decimals: 2, rate: 0.79, label: 'British Pound' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', decimals: 0, rate: 154.3, label: 'Japanese Yen' },
  { code: 'PKR', symbol: '₨', locale: 'ur-PK', decimals: 0, rate: 279, label: 'Pakistani Rupee' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', decimals: 2, rate: 1.36, label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', decimals: 2, rate: 1.53, label: 'Australian Dollar' },
  { code: 'TRY', symbol: '₺', locale: 'tr-TR', decimals: 2, rate: 33.4, label: 'Turkish Lira' },
]

export const DEFAULT_CURRENCY = 'USD'

/* IMPORTANT: rates above are MOCK display rates for the frontend prototype.
 * They are intentionally not real market values. Wire a real exchange-rate
 * API (e.g. from a backend service) before going live. */

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
}

export function convertPrice(price: number, from: string, to: string): number {
  const source = getCurrency(from)
  const target = getCurrency(to)
  const inUsd = price / source.rate
  return inUsd * target.rate
}

export function formatPrice(price: number, currency: string, localeCode?: string): string {
  const cur = getCurrency(currency)
  const locale = localeCode || cur.locale
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur.code,
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    }).format(price)
  } catch {
    return `${cur.symbol}${price.toFixed(cur.decimals)}`
  }
}