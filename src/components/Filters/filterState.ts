import type { Product, CategoryId, CollectionId, Gender, Availability } from '@/types'
import { minMaxPrice } from '@/data/products'

export type SortKey =
  | 'relevance'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'bestsellers'
  | 'rated'

export interface FilterState {
  genders: Gender[]
  categories: CategoryId[]
  sizes: string[]
  colors: string[]
  collections: CollectionId[]
  availability: Availability[]
  minPrice: number
  maxPrice: number
  sort: SortKey
}

export const DEFAULT_FILTERS: FilterState = {
  genders: [],
  categories: [],
  sizes: [],
  colors: [],
  collections: [],
  availability: [],
  minPrice: 0,
  maxPrice: 5000,
  sort: 'relevance',
}

export function availabilityOf(product: Product): Availability {
  if (product.stock === 0) return 'out-of-stock'
  if (product.stock <= 8) return 'low-stock'
  return 'in-stock'
}

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const arr = [...list]
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return arr.sort((a, b) => b.price - a.price)
    case 'newest':
      return arr.sort((a) => (a.isNew ? -1 : 1))
    case 'bestsellers':
      return arr.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || b.reviews - a.reviews)
    case 'rated':
      return arr.sort((a, b) => b.rating - a.rating)
    default:
      return arr.sort((a, b) => Number(b.featured) - Number(a.featured))
  }
}

export interface FilterInput {
  genders?: Gender[]
  categories?: CategoryId[]
  sizes?: string[]
  colors?: string[]
  collections?: CollectionId[]
  availability?: Availability[]
  minPrice?: number
  maxPrice?: number
  sort?: SortKey
}

export function applyFilters(products: Product[], f: FilterInput): Product[] {
  const bounds = minMaxPrice(products)
  const min = f.minPrice ?? bounds.min
  const max = f.maxPrice ?? bounds.max

  const filtered = products.filter((p) => {
    if (f.genders && f.genders.length && !f.genders.includes(p.gender)) return false
    if (f.categories && f.categories.length && !f.categories.includes(p.category)) return false
    if (f.sizes && f.sizes.length && !f.sizes.some((s) => p.sizes.includes(s))) return false
    if (f.colors && f.colors.length && !f.colors.some((c) => p.colors.some((pc) => pc.id === c))) return false
    if (f.collections && f.collections.length && !f.collections.includes(p.collection)) return false
    if (f.availability && f.availability.length && !f.availability.includes(availabilityOf(p))) return false
    if (p.price < min || p.price > max) return false
    return true
  })

  return sortProducts(filtered, f.sort ?? 'relevance')
}

export function parseCatalogoParams(params: URLSearchParams): FilterInput {
  const parse = (key: string): string[] => params.getAll(key)
  const pick = (key: string): string[] | undefined => {
    const vals = parse(key)
    return vals.length ? vals : undefined
  }
  return {
    genders: pick('gender') as Gender[] | undefined,
    categories: pick('category') as CategoryId[] | undefined,
    sizes: pick('size'),
    colors: pick('color'),
    collections: pick('collection') as CollectionId[] | undefined,
    availability: pick('availability') as Availability[] | undefined,
    minPrice: params.get('min') ? Number(params.get('min')) : undefined,
    maxPrice: params.get('max') ? Number(params.get('max')) : undefined,
    sort: (params.get('sort') as SortKey | null) ?? undefined,
  }
}

export function catalogoQuery(f: FilterState): string {
  const params = new URLSearchParams()
  f.genders.forEach((g) => params.append('gender', g))
  f.categories.forEach((c) => params.append('category', c))
  f.sizes.forEach((s) => params.append('size', s))
  f.colors.forEach((c) => params.append('color', c))
  f.collections.forEach((c) => params.append('collection', c))
  f.availability.forEach((a) => params.append('availability', a))
  if (f.minPrice > 0) params.set('min', String(f.minPrice))
  if (f.maxPrice < 5000) params.set('max', String(f.maxPrice))
  if (f.sort !== 'relevance') params.set('sort', f.sort)
  const q = params.toString()
  return q ? `?${q}` : ''
}