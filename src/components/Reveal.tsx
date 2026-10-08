import { useEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'
import type { CSSProperties, ElementType, ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  variant?: 'fade-up' | 'fade-in' | 'scale-in'
  delay?: number
  as?: ElementType
  className?: string
  style?: CSSProperties
}

export function Reveal({
  children,
  variant = 'fade-up',
  delay = 0,
  as: Tag = 'div',
  className,
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={cn('reveal', visible && 'reveal-visible', className)}
      data-reveal={variant}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms', ...style }}
    >
      {children}
    </Tag>
  )
}