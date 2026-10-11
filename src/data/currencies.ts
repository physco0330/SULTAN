import type { Currency } from '@/types'

/* Datos ISO 4217 de cada moneda (símbolo, decimales, formato regional).
 * SIN tasas hardcodeadas: las Tasas se obtienen de una fuente verificable
 * (ver services/rates.ts) y se guardan con su fecha de actualización. */
export const CURRENCIES: Currency[] = [
  { code: 'COP', symbol: '$', locale: 'es-CO', decimals: 0, rate: 1, label: 'Peso colombiano' },
  { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, rate: 1, label: 'Dólar estadounidense' },
  { code: 'MXN', symbol: '$', locale: 'es-MX', decimals: 2, rate: 1, label: 'Peso mexicano' },
  { code: 'PEN', symbol: 'S/', locale: 'es-PE', decimals: 2, rate: 1, label: 'Sol peruano' },
  { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0, rate: 1, label: 'Peso chileno' },
  { code: 'ARS', symbol: '$', locale: 'es-AR', decimals: 2, rate: 1, label: 'Peso argentino' },
  { code: 'UYU', symbol: '$', locale: 'es-UY', decimals: 2, rate: 1, label: 'Peso uruguayo' },
  { code: 'BRL', symbol: 'R$', locale: 'pt-BR', decimals: 2, rate: 1, label: 'Real brasileño' },
  { code: 'EUR', symbol: '€', locale: 'es-ES', decimals: 2, rate: 1, label: 'Euro' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', decimals: 2, rate: 1, label: 'Libra esterlina' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', decimals: 2, rate: 1, label: 'Dólar canadiense' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', decimals: 2, rate: 1, label: 'Dólar australiano' },
  { code: 'TRY', symbol: '₺', locale: 'tr-TR', decimals: 2, rate: 1, label: 'Lira turca' },
  { code: 'RUB', symbol: '₽', locale: 'ru-RU', decimals: 2, rate: 1, label: 'Rublo ruso' },
  { code: 'CNY', symbol: '¥', locale: 'zh-CN', decimals: 2, rate: 1, label: 'Yuan chino' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', decimals: 0, rate: 1, label: 'Yen japonés' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', decimals: 2, rate: 1, label: 'Rupia india' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', decimals: 2, rate: 1, label: 'DirhamDubai' },
  { code: 'PKR', symbol: '₨', locale: 'ur-PK', decimals: 0, rate: 1, label: 'Rupia pakistaní' },
  { code: 'BDT', symbol: '৳', locale: 'bn-BD', decimals: 0, rate: 1, label: 'Taka bengalí' },
  { code: 'IDR', symbol: 'Rp', locale: 'id-ID', decimals: 0, rate: 1, label: 'Rupia indonesia' },
]

export const DEFAULT_CURRENCY = 'COP'

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
}

/* ---------- Tabla de tasas viva ---------- */

export interface RatesMeta {
  /** fecha de publicación de las tasas (ISO date) */
  date: string
  /** fuente consultada */
  source: string
  /** true si provienen de la fuente real, false si sonreferencia local */
  verified: boolean
  /** true si la consulta falló y se usan las tasas de referencia */
  stale: boolean
}

/** Tasas de referencia (1 USD). Se usan solo si la fuente real no responde;
 *  la interfaz las marca como no verificadas para no presentarlas como reales. */
const FALLBACK_RATES: Record<string, number> = {
  COP: 4100, USD: 1, MXN: 18, PEN: 3.75, CLP: 940, ARS: 950, UYU: 38, BRL: 5.4,
  EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52, TRY: 34, RUB: 92, CNY: 7.2, JPY: 152,
  INR: 83.5, AED: 3.67, PKR: 278, BDT: 117, IDR: 15800,
}

let rateTable: Record<string, number> = { ...FALLBACK_RATES }
let meta: RatesMeta = { date: '', source: 'referencia local', verified: false, stale: true }

export function setRates(rates: Record<string, number>, info: Omit<RatesMeta, 'stale'>) {
  rateTable = { ...FALLBACK_RATES, ...rates }
  meta = { ...info, stale: false }
}

export function markRatesStale() {
  meta = { ...meta, stale: true }
}

export function getRatesMeta(): RatesMeta {
  return meta
}

/** Convierte un importe entre dos monedas usando la tabla vigente. */
export function convertPrice(price: number, from: string, to: string): number {
  if (from === to) return price
  const inUsd = price / (rateTable[from] ?? rateTable.USD ?? 1)
  return inUsd * (rateTable[to] ?? rateTable.USD ?? 1)
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
