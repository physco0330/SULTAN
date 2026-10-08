import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="SULTAN BLACK — Home"
      className={cn('group inline-flex flex-col items-start leading-none select-none', className)}
    >
      <span className="flex items-center gap-2">
        <svg viewBox="0 0 64 64" className={cn('h-7 w-7', compact && 'h-6 w-6')} aria-hidden="true">
          <rect x="2" y="2" width="60" height="60" rx="6" fill="none" stroke="#C9A227" strokeWidth="1.5" />
          <path d="M20 18h24l-3 6H23z" fill="#C9A227" />
          <path d="M16 18h32l-2.5 5H18.5z" fill="none" stroke="#C9A227" strokeWidth="1.5" />
          <rect x="17" y="26" width="30" height="3" rx="1.5" fill="#D4AF37" />
          <path d="M22 32h20v12l-10-6-10 6z" fill="none" stroke="#D4AF37" strokeWidth="2" />
        </svg>
        <span className="font-display text-2xl md:text-[1.7rem] font-semibold tracking-[0.18em] text-gold-gradient">
          SULTAN
        </span>
      </span>
      <span className="mt-1 text-[0.6rem] font-medium tracking-[0.6em] text-silver pl-9 uppercase">
        Black
      </span>
    </Link>
  )
}