import { brandConfig } from '@/config/brand'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { InstagramButton } from '@/components/InstagramButton'

/* Both floating buttons only render when the corresponding config value is
 * filled in (brandConfig.whatsappNumber / brandConfig.instagramUrl). */
export function FloatingButtons() {
  const hasAny = Boolean(brandConfig.whatsappNumber || brandConfig.instagramUrl)
  if (!hasAny) return null

  return (
    <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3 sm:right-6">
      <WhatsAppButton />
      <InstagramButton />
    </div>
  )
}