import { Reveal } from '@/components/Reveal'
import { ProductCard } from '@/components/ProductCard'
import { cn } from '@/utils/cn'
import type { Product } from '@/types'

export function ProductGrid({
  products,
  columns = 4,
}: {
  products: Product[]
  columns?: 2 | 3 | 4
}) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6', cols)}>
      {products.map((p, i) => (
        <Reveal key={p.id} delay={Math.min(i * 60, 300)}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton aspect-[3/4]" />
      <div className="skeleton h-3 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
      <div className="skeleton h-4 w-3/4" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}