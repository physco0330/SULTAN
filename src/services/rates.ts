import { setRates, markRatesStale, getRatesMeta, type RatesMeta } from '@/data/currencies'

/**
 * Tasas de cambio desde una fuente pública y verificable.
 * Frankfurter publica las tasas de referencia del Banco Central Europeo (ECB),
 * con fecha de publicación incluida en la respuesta.
 * Documentación: https://frankfurter.dev
 *
 * Si la fuente no responde se conservan las tasas de referencia locales y se
 * marcan como no verificadas, para no presentarlas como Rates reales.
 */
const ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=USD'

let loaded = false
let inflight: Promise<void> | null = null

async function loadOnce(): Promise<void> {
  if (loaded) return
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(ENDPOINT, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { rates?: Record<string, number>; date?: string }
      const rates = data.rates || {}
      // Frankfurter no publica COP: ese valor se conserva de la referencia local (no se fuerza a 1).
      if (rates && Object.keys(rates).length > 0) {
        setRates({ ...rates, USD: 1 }, {
          date: data.date || new Date().toISOString().slice(0, 10),
          source: 'Banco Central Europeo (frankfurter.dev)',
          verified: true,
        })
      } else {
        markRatesStale()
      }
    } catch {
      // Sin conexión: seguimos con referencia local marcada como no verificada.
      markRatesStale()
    } finally {
      loaded = true
      inflight = null
    }
  })()
  return inflight
}

/** Precarga las tasas. No bloquea el render. */
export function preloadRates(): Promise<void> {
  return loadOnce()
}

export function ratesMeta(): RatesMeta {
  return getRatesMeta()
}
