import { useState, type MouseEvent } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { cn } from '@/utils/cn'

/**
 * Las fotos de marcador (SVG de relleno) son casi negras: al ampliarlas la
 * pantalla se ve negra y parece que la lupa está rota. Solo se permite el zoom
 * cuando hay una foto real (Cloudinary o archivo local).
 */
const isPlaceholder = (src?: string | null) => !src || src.startsWith('data:image/svg+xml')

/** Foto con lupa: al pulsarla se acerca y el zoom sigue el cursor. */
export function ZoomImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const zoomable = !isPlaceholder(src)

  const follow = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        zoomable && (zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'),
        className,
      )}
      onMouseMove={zoomable && zoomed ? follow : undefined}
      onClick={zoomable ? () => setZoomed((z) => !z) : undefined}
    >
      <div
        className="h-full w-full transition-transform duration-300"
        style={{ transform: zoomable && zoomed ? 'scale(2.5)' : 'scale(1)', transformOrigin: `${origin.x}% ${origin.y}%` }}
      >
        <SafeImage src={src} alt={alt} />
      </div>
      {zoomable && (
        <button
          type="button"
          aria-label={zoomed ? 'Quitar zoom' : 'Hacer zoom'}
          onClick={(e) => {
            e.stopPropagation()
            setZoomed((z) => !z)
          }}
          className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center bg-night/70 text-gold transition-colors hover:bg-gold hover:text-night"
        >
          {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
        </button>
      )}
    </div>
  )
}
