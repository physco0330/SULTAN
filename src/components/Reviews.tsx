import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, Send, MessageSquareQuote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/services/api'
import { useUi } from '@/store/ui'
import { subscribeDataVersion } from '@/utils/liveSync'
import { Reveal } from '@/components/Reveal'
import { SectionTitle } from '@/components/SectionTitle'
import type { ReviewRow } from '@/services/adminService'
import { cn } from '@/utils/cn'

const input =
  'w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function Stars({ value, onSelect, size = 13 }: { value: number; onSelect?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onSelect}
          onMouseEnter={() => onSelect && setHover(i)}
          onClick={() => onSelect && onSelect(i)}
          aria-label={`${i} estrellas`}
          className={cn('transition-transform duration-150', onSelect && 'cursor-pointer hover:scale-125')}
        >
          <Star size={size} className={cn(i <= active ? 'fill-gold text-gold' : 'fill-transparent text-bone/40')} />
        </button>
      ))}
    </div>
  )
}

export function ReviewsSection() {
  const { t } = useTranslation()
  const pushToast = useUi((s) => s.pushToast)
  const [items, setItems] = useState<ReviewRow[]>([])
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', rating: 5, comment: '' })

  const load = useCallback(() => {
    api
      .get<{ items: ReviewRow[] }>('/reviews')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setBusy(false))
  }, [])

  useEffect(() => {
    load()
  }, [])

  /* Live sync: refresh the reviews silently when data changes anywhere. */
  useEffect(() => subscribeDataVersion(load), [load])

  const average = useMemo(() => {
    if (items.length === 0) return 0
    return Math.round((items.reduce((s, r) => s + r.rating, 0) / items.length) * 10) / 10
  }, [items])

  const submit = async () => {
    if (!form.name.trim()) return pushToast(t('reviews.nameRequired'), 'error')
    if (!form.comment.trim() || form.comment.trim().length < 4) return pushToast(t('reviews.commentRequired'), 'error')
    setSaving(true)
    try {
      await api.post('/reviews', form)
      setForm({ name: '', city: '', rating: 5, comment: '' })
      pushToast(t('reviews.success'))
      load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : t('reviews.sendError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border-y border-gold/10 bg-carbon/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <SectionTitle eyebrow="SULTAN BLACK" title={t('reviews.title')} subtitle={t('reviews.subtitle')} />

        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-display text-4xl text-gold">{average}</span>
            <div>
              <Stars value={average} size={16} />
              <p className="mt-1 text-xs text-bone">
                {items.length} {t('reviews.count')} · {t('reviews.latest50')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            {busy && <p className="py-10 text-center text-sm text-bone">Cargando reseñas…</p>}
            {!busy && items.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 border border-gold/15 px-6 py-16 text-center">
                <MessageSquareQuote size={28} className="text-gold/50" />
                <p className="text-sm text-bone">{t('reviews.empty')}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((r, i) => (
                <Reveal key={r.id} delay={Math.min(i, 8) * 60}>
                  <article className="group relative flex h-full flex-col border border-gold/15 bg-night/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-lg hover:shadow-gold/5">
                    <Stars value={r.rating} />
                    <p className="mt-3 flex-1 text-sm font-light leading-relaxed text-ivory">“{r.comment}”</p>
                    <footer className="mt-5 flex items-center gap-3 border-t border-gold/10 pt-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-carbon text-xs font-bold text-gold">
                        {initials(r.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ivory">{r.name}</p>
                        <p className="truncate text-xs text-bone">
                          {r.city || 'SULTAN BLACK'}
                          {r.rating === 5 && <span className="ml-2 text-gold">★ {t('reviews.verified')}</span>}
                        </p>
                      </div>
                    </footer>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>

          <aside className="h-fit border border-gold/20 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(201,162,39,0.12)_0%,rgba(13,13,13,0)_50%)] bg-carbon p-6 lg:sticky lg:top-24">
            <h3 className="font-display text-lg text-ivory">{t('reviews.leaveTitle')}</h3>
            <p className="mt-1 text-xs text-bone">{t('reviews.leaveSubtitle')}</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">{t('reviews.rating')}</label>
                <Stars value={form.rating} onSelect={(v) => setForm((f) => ({ ...f, rating: v }))} size={22} />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">{t('reviews.name')} *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tu nombre" className={input} />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">{t('reviews.city')}</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Tu ciudad" className={input} />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">{t('reviews.comment')} *</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={4}
                  maxLength={800}
                  placeholder={t('reviews.commentPlaceholder')}
                  className={input}
                />
              </div>
              <button
                onClick={submit}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 bg-gold px-6 py-3.5 text-xs font-bold uppercase tracking-[0.25em] text-night transition-all hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={13} /> {t('reviews.send')}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}