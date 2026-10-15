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

/* Paleta amplia y seleccionable. Se conservan los ids históricos para que los
 * productos ya guardados no pierdan sus colores al volver a editarse. */
export const FABRIC_COLORS = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#F5F1E8' },
  { id: 'gold', hex: '#C9A227' },
  { id: 'silver', hex: '#C0C0C0' },
  { id: 'grey', hex: '#6b6b6b' },
  { id: 'beige', hex: '#D6C9B2' },
  { id: 'cream', hex: '#F5F5DC' },
  { id: 'ivory', hex: '#FFFFF0' },
  { id: 'brown', hex: '#A52A2A' },
  { id: 'tan', hex: '#D2B48C' },
  { id: 'chocolate', hex: '#7B3F00' },
  { id: 'blue', hex: '#1f3a5f' },
  { id: 'navy', hex: '#000080' },
  { id: 'royal', hex: '#1E40AF' },
  { id: 'sky', hex: '#38BDF8' },
  { id: 'aqua', hex: '#00FFFF' },
  { id: 'turquoise', hex: '#40E0D0' },
  { id: 'teal', hex: '#008080' },
  { id: 'mint', hex: '#98FF98' },
  { id: 'green', hex: '#1f4a33' },
  { id: 'lime', hex: '#84CC16' },
  { id: 'olive', hex: '#808000' },
  { id: 'yellow', hex: '#FFD400' },
  { id: 'mustard', hex: '#D4A017' },
  { id: 'orange', hex: '#FFA500' },
  { id: 'peach', hex: '#FFDAB9' },
  { id: 'coral', hex: '#FF7F50' },
  { id: 'red', hex: '#7a1f1f' },
  { id: 'maroon', hex: '#800000' },
  { id: 'burgundy', hex: '#6D071A' },
  { id: 'pink', hex: '#FFB6C1' },
  { id: 'rose', hex: '#FF007F' },
  { id: 'fuchsia', hex: '#FF00FF' },
  { id: 'magenta', hex: '#E0218A' },
  { id: 'purple', hex: '#800080' },
  { id: 'violet', hex: '#EE82EE' },
  { id: 'lavender', hex: '#C4B5FD' },
  { id: 'indigo', hex: '#4B0082' },
  { id: 'others', hex: '#553a6b' },
]

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}