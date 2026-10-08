import type { Product, Gender, CategoryId, CollectionId } from '@/types'
import { productImage } from '@/utils/placeholder'

let seq = 0
function make(
  name: string,
  gender: Gender,
  category: CategoryId,
  collection: CollectionId,
  price: number,
  compareAtPrice: number | undefined,
  stock: number,
  opts: Partial<Product> = {},
): Product {
  seq += 1
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const id = `SB-${String(seq).padStart(3, '0')}`
  return {
    id,
    name,
    slug,
    category,
    gender,
    collection,
    price,
    compareAtPrice,
    currency: 'USD',
images: [
      { src: productImage(name, 0), alt: `${name} — front view` },
      { src: productImage(name, 1), alt: `${name} — detail view` },
      { src: productImage(name, 2), alt: `${name} — texture view` },
    ],
    colors: opts.colors ?? [{ id: 'black', name: 'Black', hex: '#111111' }],
    sizes: opts.sizes ?? (category === 'accessories' ? ['OS'] : ['S', 'M', 'L', 'XL', 'XXL']),
    description:
      opts.description ??
      `Part of the SULTAN BLACK ${collection.toUpperCase()} collection. Cut from selected premium fabrics with exacting Turkish craftsmanship, engineered for a refined silhouette and enduring wear.`,
    material: opts.material ?? 'Premium cotton blend',
    sku: `${slug}-${id}`,
    stock,
    rating: opts.rating ?? 4.5 + (seq % 10) / 10,
    reviews: opts.reviews ?? 18 + seq,
    featured: opts.featured ?? (collection === 'premium' || collection === 'limited'),
    isNew: opts.isNew ?? collection === 'new',
    isLimited: opts.isLimited ?? collection === 'limited',
    isBestSeller: opts.isBestSeller ?? collection === 'bestsellers',
    isOnSale: opts.isOnSale ?? !!compareAtPrice,
    ...opts,
  }
}

const two = [
  { id: 'black', name: 'Black', hex: '#111111' },
  { id: 'gold', name: 'Gold', hex: '#C9A227' },
]
const metals = [
  { id: 'gold', name: 'Gold', hex: '#C9A227' },
  { id: 'silver', name: 'Silver', hex: '#C0C0C0' },
]

export const PRODUCTS: Product[] = [
  /* ---------- MEN · NEW ---------- */
  make('Bosphorus Overshirt', 'men', 'shirts', 'new', 890, undefined, 24, {
    colors: two,
    material: 'Moleskin cotton, matte gunmetal buttons',
  }),
  make('Galata Technical Jacket', 'men', 'jackets', 'new', 1450, undefined, 12, {
    material: 'Three-layer bonded shell, taped seams',
  }),
  make('Hagia Grand Palazzo Pants', 'men', 'trousers', 'new', 620, undefined, 30),
  make('Anatolia Merino Polo', 'men', 'tshirts', 'new', 340, undefined, 40),
  make('Ottoman Peak Shirt', 'men', 'shirts', 'new', 780, 920, 15, {
    colors: two,
    isOnSale: true,
  }),
  make('Sultan Sheen Trench', 'men', 'coats', 'new', 2180, undefined, 8, {
    isLimited: true,
  }),

  /* ---------- MEN · PREMIUM ---------- */
  make('Sultan Black Jacket', 'men', 'jackets', 'premium', 1250, undefined, 18, {
    isBestSeller: true,
    featured: true,
  }),
  make('Topkapi Velvet Blazer', 'men', 'jackets', 'premium', 1590, undefined, 10),
  make('Marmara Heavyweight Shirt', 'men', 'shirts', 'premium', 690, 820, 22, {
    isOnSale: true,
  }),
  make('Beyoglu Slim Jeans', 'men', 'jeans', 'premium', 480, undefined, 45, {
    isBestSeller: true,
  }),
  make('Cappadocia Cashmere Crew', 'men', 'hoodies', 'premium', 940, undefined, 16, {
    material: 'Pure Mongolian cashmere, rib-knit collar',
  }),
  make('Edirne Pleated Trousers', 'men', 'trousers', 'premium', 560, undefined, 28),
  make('Bosphorus Zip Hoodie', 'men', 'hoodies', 'premium', 610, 700, 26, {
    isOnSale: true,
  }),

  /* ---------- MEN · LIMITED ---------- */
  make('Imperial Edition Double Coat', 'men', 'coats', 'limited', 3400, undefined, 6, {
    isLimited: true,
    material: 'Double-faced Italian wool, silk lining',
  }),
  make('Ottoman Monogram Shirt', 'men', 'shirts', 'limited', 1100, undefined, 9, {
    isLimited: true,
  }),
  make('Golden Gate Overshirt', 'men', 'shirts', 'limited', 980, undefined, 7, {
    isLimited: true,
    colors: metals,
  }),

  /* ---------- MEN · BEST SELLERS ---------- */
  make('Beyoglu Distressed Jeans', 'men', 'jeans', 'bestsellers', 520, undefined, 50, {
    isBestSeller: true,
  }),
  make('Kadikoy Essential Tee', 'men', 'tshirts', 'bestsellers', 190, 230, 80, {
    isBestSeller: true,
    isOnSale: true,
  }),
  make('Galata Oversized Tee', 'men', 'tshirts', 'bestsellers', 240, undefined, 70, {
    isBestSeller: true,
  }),
  make('Harem Cotton Shirt', 'men', 'shirts', 'bestsellers', 620, undefined, 34, {
    isBestSeller: true,
  }),
  make('Republic Track Pant', 'men', 'trousers', 'bestsellers', 380, undefined, 44),
  make('Brass Chain Bracelet', 'men', 'accessories', 'bestsellers', 260, undefined, 60, {
    sizes: ['OS'],
    colors: metals,
    material: 'Solid brass, gold or silver finish',
  }),

  /* ---------- MEN · OFFERS ---------- */
  make('Sublime Wool Overcoat', 'men', 'coats', 'offers', 1740, 2600, 9, {
    isOnSale: true,
  }),
  make('Vintage Washed Chino', 'men', 'trousers', 'offers', 290, 400, 52, {
    isOnSale: true,
  }),
  make('Classic Piped Shirt', 'men', 'shirts', 'offers', 350, 480, 38, { isOnSale: true }),
  make('Tribute Denim Jacket', 'men', 'jackets', 'offers', 640, 850, 20, {
    isOnSale: true,
  }),

  /* ---------- WOMEN · NEW ---------- */
  make('Galata Silk Slip Dress', 'women', 'dresses', 'new', 1180, undefined, 14, {
    material: 'Bias-cut silk charmeuse',
  }),
  make('Bosphorus Column Dress', 'women', 'dresses', 'new', 1350, undefined, 9),
  make('Optima Blazer Dress', 'women', 'dresses', 'new', 980, undefined, 12),
  make('Marmara Longline Blazer', 'women', 'jackets', 'new', 890, undefined, 18),
  make('Kadikoy Flowing Skirt', 'women', 'skirts', 'new', 470, undefined, 26),
  make('Anatolia Fitted Vest', 'women', 'sets', 'new', 720, 850, 11, {
    isOnSale: true,
  }),

  /* ---------- WOMEN · PREMIUM ---------- */
  make('Sultan Hourglass Coat', 'women', 'coats', 'premium', 1890, undefined, 7, {
    isBestSeller: true,
  }),
  make('Seraglio Satin Set', 'women', 'sets', 'premium', 1240, undefined, 10),
  make('Ottoman Drape Jacket', 'women', 'jackets', 'premium', 1080, undefined, 15),
  make('Golden Henna Dress', 'women', 'dresses', 'premium', 1450, 1700, 8, {
    isOnSale: true,
  }),
  make('Beyoglu Sculpt Trousers', 'women', 'trousers', 'premium', 520, undefined, 24),
  make('Cham Silk Shirt', 'women', 'shirts', 'premium', 740, undefined, 19),

  /* ---------- WOMEN · LIMITED ---------- */
  make('Imperial Silk Gown', 'women', 'dresses', 'limited', 4200, undefined, 4, {
    isLimited: true,
    material: 'Hand-finished silk, gold-thread embroidery',
  }),
  make('Harem Pearl Cardigan', 'women', 'hoodies', 'limited', 980, undefined, 6, {
    isLimited: true,
  }),
  make('Skyline Embroidered Blazer', 'women', 'jackets', 'limited', 1560, undefined, 5, {
    isLimited: true,
  }),

  /* ---------- WOMEN · BEST SELLERS ---------- */
  make('Bosphorus Wrap Dress', 'women', 'dresses', 'bestsellers', 860, undefined, 22, {
    isBestSeller: true,
  }),
  make('Essential Silk Tee', 'women', 'tshirts', 'bestsellers', 220, 260, 66, {
    isBestSeller: true,
    isOnSale: true,
  }),
  make('Galata Pleated Skirt', 'women', 'skirts', 'bestsellers', 520, undefined, 30, {
    isBestSeller: true,
  }),
  make('Sultan Wide Leg Pants', 'women', 'trousers', 'bestsellers', 580, undefined, 21),

  /* ---------- WOMEN · OFFERS ---------- */
  make('Romantic Silk Camisole', 'women', 'tshirts', 'offers', 240, 320, 48, {
    isOnSale: true,
  }),
  make('Bride Hallovers Mini', 'women', 'dresses', 'offers', 590, 780, 26, { isOnSale: true }),
  make('Satin Scarf — Gold Edge', 'women', 'accessories', 'offers', 180, 240, 90, {
    sizes: ['OS'],
    colors: two,
    material: 'Pure silk twill',
    isOnSale: true,
  }),
  make('Leather Belt — Serif Buckle', 'women', 'accessories', 'offers', 320, 450, 40, {
    sizes: ['OS'],
    isOnSale: true,
  }),
]

export function getProduct(slugOrId: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slugOrId || p.id === slugOrId)
}

export function getRelated(product: Product, limit = 4): Product[] {
  return PRODUCTS.filter(
    (p) => p.id !== product.id && (p.gender === product.gender || p.category === product.category),
  ).slice(0, limit)
}

export function productsByGender(gender: Gender): Product[] {
  return PRODUCTS.filter((p) => p.gender === gender)
}

export function minMaxPrice(products: Product[]): { min: number; max: number } {
  const prices = products.map((p) => p.price)
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
}