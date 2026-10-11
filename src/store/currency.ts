import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CURRENCY, convertPrice, formatPrice } from '@/data/currencies'
import { DEFAULT_COUNTRY, getCountry } from '@/data/countries'

export interface CurrencyState {
  /** país seleccionado (ISO 3166-1 alfa-2) */
  country: string
  /** moneda activa (ISO 4217) */
  code: string
  /** true si el usuario eligió la moneda a mano (prevalece sobre la del país) */
  manual: boolean
  setCountry: (country: string) => void
  setCode: (code: string) => void
  /** vuelve a la moneda oficial del país seleccionado */
  resetToCountryCurrency: () => void
}

export const useCurrency = create<CurrencyState>()(
  persist(
    (set, get) => ({
      country: DEFAULT_COUNTRY,
      code: DEFAULT_CURRENCY,
      manual: false,
      /** Al cambiar de país se actualiza la moneda a la oficial de ese país,
       *  salvo que el usuario la haya elegido manualmente. */
      setCountry: (country) => {
        const c = getCountry(country)
        set({ country, code: get().manual ? get().code : c.currency })
      },
      /** Selección manual: prevalece sobre la automática del país. */
      setCode: (code) => set({ code, manual: true }),
      resetToCountryCurrency: () => set({ code: getCountry(get().country).currency, manual: false }),
    }),
    {
      name: 'sultan-currency',
      version: 2,
      migrate: (state) => {
        const s = state as Partial<CurrencyState> | undefined
        return {
          country: s?.country ?? DEFAULT_COUNTRY,
          code: s?.code ?? DEFAULT_CURRENCY,
          manual: s?.manual ?? false,
        } as CurrencyState
      },
    },
  ),
)

/** Convierte un precio almacenado en el backend a la moneda activa (solo presentación). */
export function useDisplayPrice(price: number, fromCurrency = 'USD'): string {
  const code = useCurrency((s) => s.code)
  const converted = convertPrice(price, fromCurrency, code)
  return formatPrice(converted, code)
}

export function displayPriceOf(price: number, fromCurrency: string, toCurrency: string): string {
  return formatPrice(convertPrice(price, fromCurrency, toCurrency), toCurrency)
}
