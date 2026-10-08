import { Reveal } from '@/components/Reveal'
import { cn } from '@/utils/cn'

interface SectionTitleProps {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionTitle({ eyebrow, title, subtitle, align = 'center', className }: SectionTitleProps) {
  return (
    <Reveal
      className={cn(
        'mb-12 max-w-2xl md:mb-16',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-gold">
          — {eyebrow} —
        </p>
      )}
      <h2 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-sm font-light leading-relaxed text-bone md:text-base">{subtitle}</p>
      )}
    </Reveal>
  )
}