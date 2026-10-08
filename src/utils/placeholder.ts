import { brandConfig } from '@/config/brand'

/* Centralized image pipeline.
 *
 * Product photos placed in `src/assets/productos/` are picked up
 * automatically (named `<product-slug>-<variant>.jpg`, e.g.
 * `cafe-novara-001-0.jpg`). Any product without a photo falls back to
 * the deterministic SVG placeholder, and if brandConfig.imageBaseUrl is
 * set the store loads images from that CDN instead. */

const localProductPhotos = import.meta.glob('/src/assets/productos/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function productSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

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

  function luxuryScene(width: number, height: number): string {
    const cx = (f: number): number => Math.round(width * f)
    const cy = (f: number): number => Math.round(height * f)
    const floorY = cy(0.86)
    const cw = Math.round(width * 0.042)
    const colYs = cy(0.34)
    const colYe = cy(0.82)
    let cols = ''
    const fx = [0.08, 0.175, 0.27, 0.365]
    const col = (x: number) => `
      <rect x="${x}" y="${colYs}" width="${cw}" height="${colYe - colYs}" fill="rgba(201,162,39,0.06)" stroke="rgba(201,162,39,0.35)" stroke-width="1.5"/>
      <line x1="${x + cw * 0.25}" y1="${colYs + 10}" x2="${x + cw * 0.25}" y2="${colYe - 10}" stroke="rgba(201,162,39,0.18)"/>
      <line x1="${x + cw * 0.5}" y1="${colYs + 10}" x2="${x + cw * 0.5}" y2="${colYe - 10}" stroke="rgba(201,162,39,0.18)"/>
      <line x1="${x + cw * 0.75}" y1="${colYs + 10}" x2="${x + cw * 0.75}" y2="${colYe - 10}" stroke="rgba(201,162,39,0.18)"/>
      <rect x="${x - cw * 0.22}" y="${colYs - 26}" width="${cw * 1.44}" height="8" fill="rgba(201,162,39,0.25)"/>
      <rect x="${x - cw * 0.22}" y="${colYs - 12}" width="${cw * 1.44}" height="14" fill="rgba(201,162,39,0.4)"/>
      <rect x="${x - cw * 0.18}" y="${colYe}" width="${cw * 1.36}" height="11" fill="rgba(201,162,39,0.3)"/>`
    fx.forEach((f) => {
      cols += col(cx(f))
      cols += col(width - cx(f) - cw)
    })

    return `
      <defs>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2d2317"/>
          <stop offset="0.5" stop-color="#1b130b"/>
          <stop offset="1" stop-color="#0e0a06"/>
        </linearGradient>
        <linearGradient id="alcove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(255,214,120,0.35)"/>
          <stop offset="1" stop-color="rgba(212,175,55,0.05)"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="28%" r="55%">
          <stop offset="0" stop-color="rgba(255,214,120,0.30)"/>
          <stop offset="1" stop-color="rgba(255,214,120,0)"/>
        </radialGradient>
        <radialGradient id="spotlight" cx="50%" cy="42%" r="34%">
          <stop offset="0" stop-color="rgba(255,224,150,0.22)"/>
          <stop offset="1" stop-color="rgba(255,224,150,0)"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#v)"/>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      <path d="M 0 ${floorY} L ${cx(0.5)} ${cy(0.86)} L ${width} ${floorY} L ${width} ${height} L 0 ${height} Z" fill="rgba(24,16,9,0.8)"/>
      <path d="M ${cx(0.395)} ${cy(0.74)} L ${cx(0.395)} ${cy(0.6)} A ${cx(0.105)} ${cy(0.17)} 0 0 1 ${cx(0.605)} ${cy(0.6)} L ${cx(0.605)} ${cy(0.74)} Z" fill="url(#alcove)" stroke="rgba(224,190,90,0.55)" stroke-width="2.5"/>
      <path d="M ${cx(0.415)} ${cy(0.74)} L ${cx(0.415)} ${cy(0.62)} A ${cx(0.085)} ${cy(0.13)} 0 0 1 ${cx(0.585)} ${cy(0.62)} L ${cx(0.585)} ${cy(0.74)} Z" fill="rgba(28,19,11,0.5)" stroke="rgba(212,175,55,0.4)" stroke-width="1.5"/>
      <rect x="0" y="${floorY}" width="${width}" height="${height}" fill="url(#spotlight)"/>
      ${cols}
      <line x1="${cx(0.5)}" y1="${cy(0)}" x2="${cx(0.5)}" y2="${cy(0.2)}" stroke="rgba(212,175,55,0.45)" stroke-width="1.5"/>
      <circle cx="${cx(0.5)}" cy="${cy(0.215)}" r="${Math.round(width * 0.026)}" fill="rgba(255,214,120,0.14)"/>
      <circle cx="${cx(0.5)}" cy="${cy(0.22)}" r="${Math.round(width * 0.01)}" fill="#ffd678"/>
      <circle cx="${cx(0.5 - 0.055)}" cy="${cy(0.26)}" r="${Math.round(width * 0.0065)}" fill="#e8c766" opacity="0.9"/>
      <circle cx="${cx(0.5 + 0.055)}" cy="${cy(0.26)}" r="${Math.round(width * 0.0065)}" fill="#e8c766" opacity="0.9"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.455)}" y2="${height}" stroke="rgba(212,175,55,0.14)"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.545)}" y2="${height}" stroke="rgba(212,175,55,0.14)"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.41)}" y2="${height}" stroke="rgba(212,175,55,0.1)"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.59)}" y2="${height}" stroke="rgba(212,175,55,0.1)"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.365)}" y2="${height}" stroke="rgba(212,175,55,0.07)"/>
      <line x1="${cx(0.5)}" y1="${cy(0.86)}" x2="${cx(0.635)}" y2="${height}" stroke="rgba(212,175,55,0.07)"/>
      <line x1="${cx(0.5)}" y1="${floorY}" x2="${cx(0.5)}" y2="${cy(0.86)}" stroke="none"/>
      <ellipse cx="${cx(0.5)}" cy="${cy(0.9)}" rx="${cx(0.3)}" ry="${Math.round(height * 0.05)}" fill="rgba(255,214,120,0.1)"/>
      <ellipse cx="${cx(0.5)}" cy="${cy(0.92)}" rx="${cx(0.45)}" ry="${Math.round(height * 0.05)}" fill="rgba(212,175,55,0.06)"/>
      <line x1="0" y1="${floorY}" x2="${width}" y2="${floorY}" stroke="rgba(212,175,55,0.5)" stroke-width="2"/>
      <rect x="5" y="5" width="${width - 10}" height="${height - 10}" fill="none" stroke="rgba(212,175,55,0.22)" stroke-width="1.5"/>`
  }

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
      ? luxuryScene(width, height)
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
    const slug = productSlug(label)
    return `${brandConfig.imageBaseUrl}/${slug}-${variantIndex}.jpg`
  }
  const slug = productSlug(label)
  const prefix = `/src/assets/productos/${slug}-`
  const keys = Object.keys(localProductPhotos).filter((k) => k.startsWith(prefix))
  if (keys.length > 0) return localProductPhotos[`${prefix}${variantIndex}.jpg`] ?? localProductPhotos[keys[0]]
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