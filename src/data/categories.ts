import type { Category } from '@/types'

export const CATEGORIES: Category[] = [
  { id: 'shirts', label: 'shirts' },
  { id: 'tshirts', label: 'tshirts' },
  { id: 'trousers', label: 'trousers' },
  { id: 'jeans', label: 'jeans' },
  { id: 'jackets', label: 'jackets' },
  { id: 'coats', label: 'coats' },
  { id: 'hoodies', label: 'hoodies' },
  { id: 'dresses', label: 'dresses' },
  { id: 'skirts', label: 'skirts' },
  { id: 'sets', label: 'sets' },
  { id: 'accessories', label: 'accessories' },
]

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export const FABRIC_COLORS = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#F5F1E8' },
  { id: 'gold', hex: '#C9A227' },
  { id: 'silver', hex: '#C0C0C0' },
  { id: 'grey', hex: '#6b6b6b' },
  { id: 'beige', hex: '#D6C9B2' },
  { id: 'blue', hex: '#1f3a5f' },
  { id: 'red', hex: '#7a1f1f' },
  { id: 'green', hex: '#1f4a33' },
  { id: 'others', hex: '#553a6b' },
]

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}