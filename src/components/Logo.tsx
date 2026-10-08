import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="SULTAN BLACK — Home"
      className={cn('inline-flex select-none', className)}
    >
      <img
        src="/logo.jpg"
        alt="SULTAN BLACK"
        className={cn('h-10 w-auto object-contain', compact && 'h-8')}
      />
    </Link>
  )
}