import { Instagram } from 'lucide-react'
import { brandConfig } from '@/config/brand'

export function InstagramButton() {
  const url = brandConfig.instagramUrl
  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Instagram"
      className="group flex items-center gap-2 justify-end"
    >
      <span className="pointer-events-none max-w-0 overflow-hidden whitespace-nowrap border border-gold/30 bg-carbon px-0 py-2 text-xs text-ivory opacity-0 transition-all duration-300 group-hover:max-w-xs group-hover:px-4 group-hover:opacity-100">
        Instagram · {brandConfig.name}
      </span>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-night text-gold transition-all duration-300 group-hover:scale-105 group-hover:bg-gold group-hover:text-night">
        <Instagram size={20} />
      </span>
    </a>
  )
}