import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PRODUCTS } from '@/data/products'
import { CATEGORIES } from '@/data/categories'
import { Price } from '@/components/Price'
import { useUi } from '@/store/ui'

const RECENT_KEY = 'sultan-recent-searches'

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writeRecent(q: string) {
  const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

export function SearchOverlay() {
  const { t } = useTranslation()
  const open = useUi((s) => s.searchOpen)
  const close = useUi((s) => s.closeSearch)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setRecent(readRecent())
      document.body.style.overflow = 'hidden'
      setTimeout(() => inputRef.current?.focus(), 120)
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
      document.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', onKey)
      }
    }
  }, [open, close])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { products: [], categories: [] }
    const products = PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.collection.toLowerCase().includes(q),
    )
    const categories = CATEGORIES.filter((c) => t(`catalog.types.${c.id}`).toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    return { products, categories }
  }, [query, t])

  if (!open) return null

  const runSearch = (q: string) => {
    const clean = q.trim()
    if (!clean) return
    writeRecent(clean)
    close()
    navigate(`/catalogo?q=${encodeURIComponent(clean)}`)
  }

  return createPortal(
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label={t('search.title')}>
      <button aria-label={t('nav.close')} onClick={close} className="absolute inset-0 bg-night/92 backdrop-blur-md animate-fade-in" />
      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-4 pt-24 md:pt-28 animate-fade-up">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            runSearch(query)
          }}
          className="flex items-center gap-3 border-b border-gold/40 pb-4"
        >
          <Search size={22} className="shrink-0 text-gold" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('nav.searchPlaceholder')}
            className="w-full bg-transparent font-display text-2xl tracking-wide text-ivory placeholder:text-bone/50 focus:outline-none"
          />
          <button onClick={close} aria-label={t('nav.close')} className="flex h-9 w-9 items-center justify-center border border-gold/30 text-silver hover:text-gold">
            <X size={16} />
          </button>
        </form>

        <div className="mt-6 flex-1 overflow-y-auto pb-16">
          {query.trim().length < 2 ? (
            <>
              {recent.length > 0 && (
                <section>
                  <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-bone">
                    {t('search.recent')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => runSearch(r)}
                        className="flex items-center gap-2 border border-gold/25 px-3 py-2 text-sm text-silver transition-colors hover:border-gold hover:text-gold"
                      >
                        <Clock size={13} /> {r}
                      </button>
                    ))}
                    <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]) }} className="px-2 text-xs text-bone hover:text-gold">
                      {t('search.clear')}
                    </button>
                  </div>
                </section>
              )}
              <section className="mt-8">
                <p className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-bone">
                  {t('search.categoriesTitle')}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c.id}
                      to={`/catalogo?type=${c.id}`}
                      onClick={close}
                      className="border border-gold/15 px-4 py-3 text-sm text-ivory transition-all hover:border-gold/60 hover:text-gold"
                    >
                      {t(`catalog.types.${c.id}`)}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              {results.products.length === 0 && results.categories.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-display text-xl text-ivory">{t('search.noResults', { query })}</p>
                  <p className="mt-2 text-sm text-bone">{t('search.noResultsHint')}</p>
                </div>
              ) : (
                <section>
                  <p className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-bone">
                    {t('search.results')} — {results.products.length}
                  </p>
                  <ul className="space-y-2">
                    {results.products.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/producto/${p.slug}`}
                          onClick={close}
                          className="group flex items-center gap-4 border border-transparent bg-carbon/60 p-3 transition-all hover:border-gold/40 hover:bg-onyx"
                        >
                          <img src={p.images[0]?.src} alt="" className="h-16 w-12 object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-ivory transition-colors group-hover:text-gold">{p.name}</p>
                            <p className="text-xs text-bone">{t(`catalog.types.${p.category}`)} · {p.sku}</p>
                          </div>
                          <Price price={p.price} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {results.categories.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-bone">
                        {t('search.categoriesTitle')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {results.categories.map((c) => (
                          <Link key={c.id} to={`/catalogo?type=${c.id}`} onClick={close} className="border border-gold/25 px-3 py-1.5 text-sm text-silver hover:border-gold hover:text-gold">
                            {t(`catalog.types.${c.id}`)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}