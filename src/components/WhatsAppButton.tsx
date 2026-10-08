import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { brandConfig } from '@/config/brand'

export function WhatsAppButton() {
  const { t } = useTranslation()
  const number = brandConfig.whatsappNumber
  if (!number) return null

  const url = `https://wa.me/${number}?text=${encodeURIComponent('Hello SULTAN BLACK, I have a question.')}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className="group flex items-center gap-2 justify-end"
    >
      <span className="pointer-events-none max-w-0 overflow-hidden whitespace-nowrap border border-gold/30 bg-carbon px-0 py-2 text-xs text-ivory opacity-0 transition-all duration-300 group-hover:max-w-xs group-hover:px-4 group-hover:opacity-100">
        {t('misc.needHelp')}
      </span>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-night shadow-2xl shadow-gold/20 transition-all duration-300 group-hover:scale-105 group-hover:bg-gold-soft">
        <Send size={20} />
      </span>
    </a>
  )
}