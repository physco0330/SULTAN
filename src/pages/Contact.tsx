import { useState } from 'react'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUi } from '@/store/ui'
import { brandConfig } from '@/config/brand'
import { sendContact } from '@/services/productService'
import { cn } from '@/utils/cn'

export default function Contact() {
  const { t } = useTranslation()
  const pushToast = useUi((s) => s.pushToast)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    try {
      await sendContact(form)
      setSent(true)
      pushToast(t('contact.sent', { name: form.name }))
    } catch {
      pushToast(t('contact.sendError'), 'error')
    } finally {
      setSending(false)
    }
  }

  const info = [
    { icon: Mail, label: t('contact.email'), value: brandConfig.email || 'info@sultanblack.com' },
    { icon: Phone, label: t('contact.phone'), value: brandConfig.whatsappNumber?.replace('+', '+ ') || '+90 212 000 00 00' },
    { icon: MapPin, label: t('contact.address'), value: brandConfig.address },
    { icon: Clock, label: t('contact.hours'), value: t('contact.hoursValue') },
  ]

  const input =
    'w-full border border-gold/25 bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('contact.title')}</h1>
        <p className="mt-3 text-sm text-bone">{t('contact.subtitle')}</p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          {info.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4 border border-gold/15 bg-carbon/50 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-gold/40 text-gold">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-gold">{label}</p>
                <p className="mt-1 text-sm text-ivory">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border border-gold/15 bg-carbon/40 p-6 md:p-8">
          {sent ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 text-gold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h2 className="mt-4 font-display text-xl text-ivory">{t('contact.sentTitle')}</h2>
              <p className="mt-2 max-w-sm text-sm text-bone">{t('contact.sentBody')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input required value={form.name} onChange={set('name')} placeholder={t('contact.yourName')} className={input} />
                <input required type="email" value={form.email} onChange={set('email')} placeholder={t('account.email')} className={input} />
              </div>
              <input value={form.subject} onChange={set('subject')} placeholder={t('contact.subject')} className={input} />
              <textarea required value={form.message} onChange={set('message')} rows={6} placeholder={t('contact.message')} className={cn(input, 'resize-none')} />
              <button type="submit" disabled={sending} className="w-full bg-gold py-4 text-xs font-bold uppercase tracking-[0.3em] text-night hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-12">
                {sending ? '···' : `${t('contact.send')} →`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}