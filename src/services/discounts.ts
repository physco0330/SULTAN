/* Discount mock service.
 * Replace with a validated backend endpoint. The frontend computes a
 * *display preview only* — the backend MUST recompute the final discount
 * during checkout and never trust a client-provided code or amount. */

const RULES: Record<string, { percent: number }> = {
  SULTAN10: { percent: 10 },
  SULTAN20: { percent: 20 },
  LUXE: { percent: 15 },
}

export interface DiscountResult {
  code: string
  percent: number
  valid: boolean
}

export function applyPromo(code: string, _subtotalUsd: number): DiscountResult {
  const rule = RULES[code.trim().toUpperCase()]
  if (!rule) return { code, percent: 0, valid: false }
  return { code, percent: rule.percent, valid: true }
}

export function discountAmount(code: string, subtotalUsd: number): number {
  const r = applyPromo(code, subtotalUsd)
  return r.valid ? (subtotalUsd * r.percent) / 100 : 0
}

export const FREE_SHIPPING_THRESHOLD_USD = 300
export const FLAT_SHIPPING_USD = 15
export const EXPRESS_SHIPPING_USD = 45