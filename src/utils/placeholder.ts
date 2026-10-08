import { brandConfig } from '@/config/brand'

/* Centralized image pipeline.
 *
 * RIGHT NOW: every image resolves to a locally-generated, deterministic
 * SVG placeholder so the storefront renders fully offline.
 *
 * LATER: set brandConfig.imageBaseUrl (e.g. a CDN like
 * https://cdn.sultanblack.com/products/) and images will load from there.
 * The rest of the app does not need any changes — swap the strategy here. */

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function esc(s: string): string {
  return s.replace(/[^a-z0-9 ]/gi, '').replace(/\s+/g, ' ').trim()
}

interface PlaceholderOptions {
  label?: string
  variant?: 'product' | 'hero' | 'editorial' | 'category'
  width?: number
  height?: number
}

function svg(options: PlaceholderOptions): string {
  const width = options.width ?? 900
  const height = options.height ?? 1200
  const seed = hash(`${(options.label ?? 'sultan').toLowerCase()}-${options.variant ?? 'product'}`)
  const hue = seed % 36
  const accent = options.variant === 'hero'
    ? '#d4af37'
    : `hsl(${hue}, 0%, ${70 + (seed % 15)}%)`
  const label = esc(options.label ?? 'SULTAN BLACK')
  const lines = label.split(' ')
  const first = (lines[0] ?? 'S')[0] ?? 'S'
  const isHero = options.variant === 'hero' || options.variant === 'category'
  const shapeId = seed % 4

  const geometry = () => {
    switch (shapeId) {
      case 0:
        return '<path d="M0 900 C160 780 320 830 450 900 C620 820 800 780 900 850 L900 1200 L0 1200 Z" fill="rgba(201,162,39,0.06)"/>'
      case 1:
        return '<circle cx="700" cy="820" r="260" fill="rgba(192,192,192,0.05)"/>'
      case 2:
        return '<path d="M120 1200 L420 600 C470 520 560 520 600 600 L860 1200 Z" fill="rgba(201,162,39,0.05)"/>'
      default:
        return '<path d="M0 1100 C240 900 520 980 900 1000 L900 1200 L0 1200 Z" fill="rgba(212,175,55,0.05)"/>'
    }
  }

  const inner =
    isHero
      ? `
      <defs>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#050505"/>
          <stop offset="0.55" stop-color="#0d0d0d"/>
          <stop offset="1" stop-color="#050505"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#v)"/>
      <rect x="${Math.round(width * 0.18)}" y="${Math.round(height * 0.2)}" width="${Math.round(width * 0.32)}" height="${Math.round(height * 0.5)}" rx="4" fill="rgba(201,162,39,0.04)" stroke="rgba(201,162,39,0.25)"/>
      <rect x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.14)}" width="${Math.round(width * 0.3)}" height="${Math.round(height * 0.62)}" rx="4" fill="rgba(192,192,192,0.045)" stroke="rgba(192,192,192,0.18)"/>
      <circle cx="${Math.round(width * 0.76)}" cy="${Math.round(height * 0.7)}" r="4" fill="${accent}"/>
      <circle cx="${Math.round(width * 0.22)}" cy="${Math.round(height * 0.76)}" r="3" fill="${accent}" opacity="0.7"/>
      <rect x="0" y="${height - 3}" width="${width}" height="3" fill="rgba(201,162,39,0.14)"/>
      ${geometry()}`
      : `
      <defs>
        <linearGradient id="g${seed}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f0f0f"/>
          <stop offset="0.5" stop-color="#171717"/>
          <stop offset="1" stop-color="#0b0b0b"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g${seed})"/>
      <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="rgba(201,162,39,0.22)" stroke-width="1"/>
      <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="rgba(201,162,39,0.08)" stroke-width="1"/>
      <text x="50%" y="44%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${height * 0.2}" font-weight="400" fill="rgba(201,162,39,0.16)">${first}</text>
      ${geometry()}
      <text x="50%" y="${height - 46}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" letter-spacing="4" fill="${accent}">${label.toUpperCase()}</text>
      <text x="50%" y="${height - 20}" text-anchor="middle" font-family="Georgia, serif" font-size="12" letter-spacing="2" fill="rgba(192,192,192,0.4)">SULTAN BLACK · PLACEHOLDER</text>`

  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#050505"/>
    ${inner}
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(full)}`
}

export function productImage(label: string, variantIndex = 0): string {
  if (brandConfig.imageBaseUrl) {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return `${brandConfig.imageBaseUrl}/${slug}-${variantIndex}.jpg`
  }
  return svg({ label, variant: 'product', width: 900, height: 1200 })
}

export function heroImage(label = 'SULTAN BLACK'): string {
  if (brandConfig.imageBaseUrl) {
    return `${brandConfig.imageBaseUrl}/hero-001.jpg`
  }
  return svg({ label, variant: 'hero', width: 1920, height: 1080 })
}

export function categoryImage(label: string): string {
  return svg({ label, variant: 'category', width: 1200, height: 1400 })
}

export function editorialImage(label: string): string {
  return svg({ label, variant: 'editorial', width: 1200, height: 1500 })
}