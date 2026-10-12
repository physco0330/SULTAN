import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

const box = 'flex items-center justify-center bg-carbon text-bone/50'

/**
 * Miniatura de producto tolerante a fallos: si la imagen no existe,
 * está rota o el producto no tiene fotos, muestra un placeholder
 * en lugar de un cuadro negro.
 */
export function ProductThumb({
  src,
  alt,
  className,
  iconClassName = 'size-4',
}: {
  src?: string | null
  alt?: string
  className?: string
  iconClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className={cn(box, className)} role="img" aria-label={alt || 'Sin imagen'}>
        <ImageOff className={cn('shrink-0', iconClassName)} aria-hidden />
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
      className={cn('object-cover', className)}
    />
  )
}