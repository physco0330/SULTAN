import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  title?: string
  hint?: string
  action?: React.ReactNode
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-gold/15 bg-carbon/50 px-6 py-20 text-center">
      <SearchX size={34} className="text-gold/60" aria-hidden="true" />
      <p className="font-display text-xl uppercase tracking-[0.2em] text-ivory">
        {title ?? t('catalog.noProducts')}
      </p>
      <p className="max-w-xs text-sm font-light text-bone">{hint ?? t('catalog.noProductsHint')}</p>
      {action}
    </div>
  )
}