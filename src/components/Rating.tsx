import { Star } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Valoración de un producto.
 *
 * Si el producto no tiene ninguna reseña real no se dibuja nada: mostrar
 * "0 estrellas (0)" inventa una impresión de reseñas que no existen.
 */
export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  const total = typeof count === 'number' ? count : 0

  if (!total || value <= 0) {
    /* Sin reseñas no se muestra nada: el texto "noReviewsYet" sobraba en la ficha. */
    return null
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex" role="img" aria-label={`${value} / 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={13}
            aria-hidden="true"
            className={i <= Math.round(value) ? 'fill-gold text-gold' : 'fill-transparent text-bone/50'}
          />
        ))}
      </div>
      <span className="text-xs text-bone">
        {value.toFixed(1)} ({total})
      </span>
    </div>
  )
}