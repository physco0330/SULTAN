import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, Cloud, ServerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { minMaxPrice } from '@/data/products'
import { useCatalog } from '@/hooks/useCatalog'
import { ProductGrid } from '@/components/ProductGrid'
import { FilterPanel } from '@/components/Filters/FilterPanel'
import { Drawer } from '@/components/Drawer'
import { EmptyState } from '@/components/EmptyState'
import { parseCatalogoParams, DEFAULT_FILTERS } from '@/components/Filters/filterState'
import type { CollectionId } from '@/types'

interface CatalogPageProps {
  gender?: 'men' | 'women'
  titleKey?: string
  presetCollection?: CollectionId
}

function toState(params: URLSearchParams) {
  const input = parseCatalogoParams(params)
  return {
    ...DEFAULT_FILTERS,
    genders: input.genders ?? [],
    categories: input.categories ?? [],
    sizes: input.sizes ?? [],
    colors: input.colors ?? [],
    collections: input.collections ?? [],
    availability: input.availability ?? [],
    minPrice: input.minPrice ?? DEFAULT_FILTERS.minPrice,
    maxPrice: input.maxPrice ?? DEFAULT_FILTERS.maxPrice,
    sort: input.sort ?? DEFAULT_FILTERS.sort,
  }
}

export default function Catalog({ gender, titleKey, presetCollection }: CatalogPageProps) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { products, online } = useCatalog()

  const base = useMemo(
    () => (gender ? products.filter((p) => p.gender === gender) : products),
    [products, gender],
  )
  const bounds = useMemo(() => minMaxPrice(products), [products])
  const state = useMemo(() => {
    const s = toState(params)
    if (gender && s.genders.length === 0) s.genders = [gender]
    if (presetCollection) s.collections = [presetCollection]
    return s
  }, [params, gender, presetCollection])

  const query = params.get('q')?.trim().toLowerCase() ?? ''

  const results = useMemo(() => {
    let list = base
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.material.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    }
    return list.filter((p) => {
      if (state.genders.length && !state.genders.includes(p.gender)) return false
      if (state.categories.length && !state.categories.includes(p.category)) return false
      if (state.sizes.length && !state.sizes.some((s) => p.sizes.includes(s))) return false
      if (state.colors.length && !state.colors.some((c) => p.colors.some((pc) => pc.id === c))) return false
      if (state.collections.length && !state.collections.includes(p.collection)) return false
      if (state.availability.length) {
        const a =
          p.stock === 0 ? 'out-of-stock' : p.stock <= 8 ? 'low-stock' : 'in-stock'
        if (!state.availability.includes(a)) return false
      }
      if (p.price < state.minPrice || p.price > state.maxPrice) return false
      return true
    })
  }, [base, query, state])

  const sorted = useMemo(() => {
    const arr = [...results]
    switch (state.sort) {
      case 'price-asc': return arr.sort((a, b) => a.price - b.price)
      case 'price-desc': return arr.sort((a, b) => b.price - a.price)
      case 'newest': return arr.sort((a, b) => Number(b.isNew) - Number(a.isNew))
      case 'bestsellers': return arr.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || b.reviews - a.reviews)
      case 'rated': return arr.sort((a, b) => b.rating - a.rating)
      default: return arr.sort((a, b) => Number(b.featured) - Number(a.featured))
    }
  }, [results, state.sort])

  const patch = (partial: Record<string, unknown>) => {
    const next = { ...state, ...partial }
    const sp = new URLSearchParams()
    next.genders.forEach((g: string) => sp.append('gender', g))
    next.categories.forEach((c: string) => sp.append('category', c))
    next.sizes.forEach((s: string) => sp.append('size', s))
    next.colors.forEach((c: string) => sp.append('color', c))
    next.collections.forEach((c: string) => sp.append('collection', c))
    next.availability.forEach((a: string) => sp.append('availability', a))
    next.minPrice > bounds.min && sp.set('min', String(next.minPrice))
    next.maxPrice < bounds.max && sp.set('max', String(next.maxPrice))
    next.sort !== 'relevance' && sp.set('sort', next.sort)
    query && sp.set('q', query)
    setParams(sp, { replace: true })
  }

  const reset = () => setParams(new URLSearchParams(), { replace: true })

  const activeCount = useMemo(() => {
    let n = 0
    const s = state
    if (s.genders.length) n++
    if (s.categories.length) n++
    if (s.sizes.length) n++
    if (s.colors.length) n++
    if (s.collections.length) n++
    if (s.availability.length) n++
    if (s.minPrice > bounds.min || s.maxPrice < bounds.max) n++
    if (s.sort !== 'relevance') n++
    return n
  }, [state, bounds])

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">
          {titleKey ? t(titleKey) : t('catalog.title')}
        </h1>
        {query && (
          <p className="mt-3 text-sm text-bone">
            “{query}” — {sorted.length} {t('catalog.productsShown')}
          </p>
        )}
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gold">
          {sorted.length} {t('catalog.productsShown')}
        </p>
        <p className={online ? 'mt-1 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.24em] text-bone' : 'mt-1 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.24em] text-bone/70'}>
          {online ? <Cloud size={11} className="text-gold" /> : <ServerOff size={11} className="text-bone/70" />}
          {online ? t('catalog.liveCatalog') : t('catalog.offlineCatalog')}
        </p>
      </header>

      <div className="mt-8 flex items-center justify-between gap-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 border border-gold/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold hover:bg-gold hover:text-night"
        >
          <SlidersHorizontal size={14} /> {t('nav.filterSort')}
          {activeCount > 0 && <span className="flex h-5 w-5 items-center justify-center bg-gold text-[0.65rem] font-bold text-night">{activeCount}</span>}
        </button>
      </div>

      <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-28 border border-gold/15 bg-carbon/60 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-gold">{t('catalog.filters')}</h2>
              {activeCount > 0 && (
                <button onClick={reset} className="text-xs text-bone underline-offset-2 hover:text-gold hover:underline">
                  {t('catalog.reset')}
                </button>
              )}
            </div>
            <FilterPanel state={state} onChange={(p) => patch(p as Record<string, unknown>)} bounds={bounds} />
          </div>
        </aside>

        <section aria-label={t('catalog.title')}>
          {sorted.length === 0 ? (
            <EmptyState
              action={
                <button onClick={reset} className="mt-4 border border-gold/50 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
                  {t('catalog.reset')}
                </button>
              }
            />
          ) : (
            <ProductGrid products={sorted} columns={3} />
          )}
        </section>
      </div>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('nav.filterSort')} position="left" size="lg">
        <div className="p-6">
          <FilterPanel state={state} onChange={(p) => patch(p as Record<string, unknown>)} bounds={bounds} />
          <div className="mt-6 flex gap-2">
            <button
              onClick={reset}
              className="flex-1 border border-gold/40 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night"
            >
              {t('catalog.reset')}
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              className="flex-1 bg-gold px-4 py-3 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft"
            >
              {t('catalog.apply')} ({sorted.length})
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}