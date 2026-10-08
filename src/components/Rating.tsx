import { Star } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
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
      {typeof count === 'number' && (
        <span className="text-xs text-bone">({count})</span>
      )}
    </div>
  )
}