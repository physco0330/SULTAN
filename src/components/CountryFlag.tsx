import type { JSX } from 'react'

const FLAGS: Record<string, JSX.Element> = {
  GB: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  ),
  CN: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#DE2910" />
      <g fill="#FFDE00">
        <path transform="translate(13,12) scale(1.15)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" />
        <path transform="translate(24,5.5) scale(0.4)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" />
        <path transform="translate(28,10) scale(0.4)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" />
        <path transform="translate(28,16.5) scale(0.4)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" />
        <path transform="translate(24,21) scale(0.4)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" />
      </g>
    </svg>
  ),
  IN: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="13.33" fill="#FF9933" />
      <rect y="26.67" width="60" height="13.33" fill="#138808" />
      <circle cx="30" cy="20" r="5.3" fill="none" stroke="#000080" strokeWidth="1.1" />
      <g stroke="#000080" strokeWidth="0.6">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6
          return <line key={i} x1={30} y1={20} x2={30 + 5.3 * Math.cos(a)} y2={20 + 5.3 * Math.sin(a)} />
        })}
      </g>
      <circle cx="30" cy="20" r="1.1" fill="#000080" />
    </svg>
  ),
  ES: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </svg>
  ),
  FR: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </svg>
  ),
  SA: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#006C35" />
      <rect x="12" y="13" width="38" height="2" rx="1" fill="#fff" />
      <rect x="16" y="19" width="30" height="2" rx="1" fill="#fff" />
      <rect x="12" y="25" width="38" height="2" rx="1" fill="#fff" />
      <path d="M14 30h26l-3 3H17z" fill="#fff" />
    </svg>
  ),
  BD: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#006A4E" />
      <circle cx="27" cy="20" r="11" fill="#F42A41" />
    </svg>
  ),
  PT: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="24" height="40" fill="#046A38" />
      <rect x="24" width="36" height="40" fill="#DA291C" />
      <circle cx="24" cy="20" r="6" fill="#FFE900" />
      <circle cx="24" cy="20" r="3.6" fill="#DA291C" />
      <rect x="21" y="16.5" width="6" height="7" fill="#fff" />
      <rect x="19.5" y="18.5" width="9" height="3" fill="#fff" />
    </svg>
  ),
  RU: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#fff" />
      <rect y="13.33" width="60" height="13.33" fill="#0039A6" />
      <rect y="26.67" width="60" height="13.33" fill="#D52B1E" />
    </svg>
  ),
  PK: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#01411C" />
      <rect width="16" height="40" fill="#fff" />
      <path d="M40 14a8 8 0 100 12 9.5 9.5 0 110-12z" fill="#fff" />
      <path transform="translate(45,20) scale(0.55)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" fill="#fff" />
    </svg>
  ),
  ID: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="20" fill="#CE1126" />
      <rect y="20" width="60" height="20" fill="#fff" />
    </svg>
  ),
  DE: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="13.33" fill="#000" />
      <rect y="13.33" width="60" height="13.33" fill="#DD0000" />
      <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
    </svg>
  ),
  JP: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#fff" />
      <circle cx="30" cy="20" r="11" fill="#BC002D" />
    </svg>
  ),
  TR: (
    <svg viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="24" cy="20" r="8" fill="#fff" />
      <circle cx="27.5" cy="20" r="6.4" fill="#E30A17" />
      <path transform="translate(33,20) scale(0.62)" d="M0 -10L2.94 -3.09L9.51 -3.09L4.24 1.18L6.18 8.09L0 4.02L-6.18 8.09L-4.24 1.18L-9.51 -3.09L-2.94 -3.09Z" fill="#fff" />
    </svg>
  ),
}

export function CountryFlag({ code, className }: { code: string; className?: string }) {
  const flag = FLAGS[code]
  if (!flag) return null
  return (
    <span
      className={['inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-gold/30 align-middle', className]
        .filter(Boolean)
        .join(' ')}
    >
      {flag}
    </span>
  )
}
