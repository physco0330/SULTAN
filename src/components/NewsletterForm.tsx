import { useState } from 'react'
import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/store/ui'
import { subscribe } from '@/services/productService'

export function NewsletterForm({ dark = true }: { dark?: boolean }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      pushToast(t('checkout.emailInvalid'), 'error')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      await subscribe(email)
      setDone(true)
      pushToast(t('sections.newsletter.success'))
    } catch {
      pushToast(t('sections.newsletter.error'), 'error')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-gold animate-scale-in">
        {t('sections.newsletter.success')}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('sections.newsletter.placeholder')}
        aria-label={t('sections.newsletter.placeholder')}
        className={`min-w-0 flex-1 px-4 py-3 text-sm focus:outline-none ${dark ? 'border border-gold/30 bg-night text-ivory placeholder:text-bone/60 focus:border-gold' : 'border border-night/20 bg-ivory text-night placeholder:text-night/50'}`}
      />
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-2 bg-gold px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-night transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={13} /> <span className="hidden sm:inline">{busy ? '···' : t('sections.newsletter.subscribe')}</span>
      </button>
    </form>
  )
}