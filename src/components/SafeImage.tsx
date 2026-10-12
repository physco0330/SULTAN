import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Imagen de producto tolerante a fallos: si la URL falta, está rota o el
 * producto no tiene fotos, muestra un placeholder en lugar de un cuadro negro.
 */
export function SafeImage({
  src,
  alt,
  className,
  wrapperClassName,
  label = 'SULTAN BLACK',
}: {
  src?: string | null
  alt?: string
  className?: string
  wrapperClassName?: string
  label?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span
        className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-ash text-bone/60', wrapperClassName)}
        role="img"
        aria-label={alt || 'Imagen no disponible'}
      >
        <ImageOff className="size-6 shrink-0" aria-hidden />
        <span className="px-3 text-center text-[0.55rem] uppercase tracking-[0.2em]">{label}</span>
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('h-full w-full object-cover', className)}
    />
  )
}