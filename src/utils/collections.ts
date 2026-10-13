import type { Product } from '@/types'

/**
 * ¿La prenda pertenece a esta colección?
 *
 * Coincide si su campo `collection` es ese id, O si tiene la etiqueta
 * correspondiente marcada en el admin:
 *   - "new"      → etiqueta "Nuevo"
 *   - "limited"  → etiqueta "Edición limitada"
 *   - "offers"   → etiqueta "En oferta" (o un precio de oferta válido)
 *
 * Así, marcar "En oferta" en el admin hace que la prenda aparezca en /ofertas
 * aunque su colección sea otra (mismo criterio para Nuevo y Edición limitada).
 */
export function matchesCollection(p: Product, id: string): boolean {
  if (p.collection === id) return true
  if (id === 'new') return !!p.isNew
  if (id === 'limited') return !!p.isLimited
  if (id === 'offers') {
    const cap = p.compareAtPrice ?? 0
    return !!p.isOnSale || (cap > p.price && cap <= p.price * 50)
  }
  return false
}
