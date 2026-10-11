import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { subscribeDataVersion } from '@/utils/liveSync'

export interface CollectionRow {
  id: string
  label_es: string
  label_en: string
  sort: number
  active: number | boolean
}

export interface CategoryItem {
  id: string
  label: string
}

/* Fallback local (español) si la API no responde — mismos ids que la BD */
const CATEGORIES_ES: CategoryItem[] = [
  { id: 'shirts', label: 'Camisas' },
  { id: 'tshirts', label: 'Camisetas' },
  { id: 'trousers', label: 'Pantalones' },
  { id: 'jeans', label: 'Jeans' },
  { id: 'jackets', label: 'Chaquetas' },
  { id: 'coats', label: 'Abrigos' },
  { id: 'hoodies', label: 'Sudaderas' },
  { id: 'dresses', label: 'Vestidos' },
  { id: 'skirts', label: 'Faldas' },
  { id: 'sets', label: 'Conjuntos' },
  { id: 'accessories', label: 'Accesorios' },
]

const COLLECTIONS_ES: CollectionRow[] = [
  { id: 'new', label_es: 'Nueva colección', label_en: 'New collection', sort: 0, active: 1 },
  { id: 'premium', label_es: 'Premium', label_en: 'Premium', sort: 1, active: 1 },
  { id: 'limited', label_es: 'Edición limitada', label_en: 'Limited edition', sort: 2, active: 1 },
  { id: 'bestsellers', label_es: 'Más vendidos', label_en: 'Best sellers', sort: 3, active: 1 },
  { id: 'offers', label_es: 'Ofertas', label_en: 'Offers', sort: 4, active: 1 },
]

let catCache: CategoryItem[] | null = null
let colCache: CollectionRow[] | null = null

export function invalidateTaxonomyCache() {
  catCache = null
  colCache = null
}

/** Categorías en español desde la API (fallback local). */
export function useCategories(): CategoryItem[] {
  const [categories, setCategories] = useState<CategoryItem[]>(catCache ?? CATEGORIES_ES)

  useEffect(() => {
    if (catCache) { setCategories(catCache); return }
    api.get<{ items: { id: string; label_es: string; label_en: string }[] }>('/categories')
      .then((r) => { catCache = r.items.map((c) => ({ id: c.id, label: c.label_es || c.label_en || c.id })); if (catCache) setCategories(catCache) })
      .catch(() => setCategories(CATEGORIES_ES))
  }, [])

  useEffect(() => subscribeDataVersion(() => {
    catCache = null
    api.get<{ items: { id: string; label_es: string; label_en: string }[] }>('/categories')
      .then((r) => {
        catCache = r.items.map((c) => ({ id: c.id, label: c.label_es || c.label_en || c.id }))
        if (catCache) setCategories(catCache)
      })
      .catch(() => { /* mantener la lista actual */ })
  }), [])

  return categories
}

/** Colecciones en español desde la API (fallback local). */
export function useCollections(): CollectionRow[] {
  const [collections, setCollections] = useState<CollectionRow[]>(colCache ?? COLLECTIONS_ES)

  useEffect(() => {
    if (colCache) { setCollections(colCache); return }
    api.get<{ items: CollectionRow[] }>('/collections')
      .then((r) => { colCache = r.items; setCollections(r.items) })
      .catch(() => setCollections(COLLECTIONS_ES))
  }, [])

  useEffect(() => subscribeDataVersion(() => {
    colCache = null
    api.get<{ items: CollectionRow[] }>('/collections')
      .then((r) => { colCache = r.items; setCollections(r.items) })
      .catch(() => { /* mantener la lista actual */ })
  }), [])

  return collections
}

/** Crea categoría/colección desde el formulario de producto. Devuelve el id. */
export async function createCategory(labelEs: string): Promise<string> {
  const r = await api.post<{ category: { id: string } }>('/admin/categories', { labelEs })
  invalidateTaxonomyCache()
  return r.category.id
}

export async function createCollection(labelEs: string): Promise<string> {
  const r = await api.post<{ collection: { id: string } }>('/admin/collections', { labelEs })
  invalidateTaxonomyCache()
  return r.collection.id
}
