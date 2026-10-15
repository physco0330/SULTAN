import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SIZES, FABRIC_COLORS } from '@/data/categories'
import { cn } from '@/utils/cn'
import type { FilterState, SortKey } from './filterState'
import type { Availability, CollectionId, Gender } from '@/types'
import { isFeatureEnabled } from '@/config/features'
import { useCategories, useCollections } from '@/hooks/useTaxonomies'
import { useStoreConfig } from '@/hooks/useStoreConfig'


type FilterCallbacks = Partial<FilterState>

function CheckGroup({
  options,
  value,
  onToggle,
  label,
}: {
  options: { id: string; label: string; swatch?: string }[]
  value: string[]
  onToggle: (id: string) => void
  label: string
}) {
  return (
    <fieldset className="border-b border-gold/15 pb-5">
      <legend className="pb-3 text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-bone">{label}</legend>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const checked = value.includes(opt.id)
          return (
            <label key={opt.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-silver transition-colors hover:text-gold">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt.id)}
                className="h-4 w-4"
              />
              {opt.swatch && (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded-full border border-gold/30"
                  style={{ backgroundColor: opt.swatch }}
                />
              )}
              <span>{opt.label}</span>
              <span className={cn('ml-auto transition-opacity', checked ? 'opacity-100' : 'opacity-0')}>✓</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function parseSortKeyLabel(o: SortKey): string {
  switch (o) {
    case 'price-asc': return 'sortPriceAsc'
    case 'price-desc': return 'sortPriceDesc'
    case 'bestsellers': return 'sortBestSellers'
    case 'rated': return 'sortRated'
    case 'relevance': return 'sortRelevance'
    case 'newest': return 'sortNewest'
  }
}

export function FilterPanel({
  state,
  onChange,
  bounds,
}: {
  state: FilterState
  onChange: (patch: FilterCallbacks) => void
  bounds: { min: number; max: number }
}) {
  const { t, i18n } = useTranslation()
  const cfg = useStoreConfig()

  const toggle = (field: 'genders' | 'categories' | 'sizes' | 'colors' | 'collections' | 'availability' | 'quality') => (id: string) => {
    const current = state[field] as string[]
    onChange({
      [field]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    } as FilterCallbacks)
  }

  const genders: { id: Gender; label: string }[] = [
    { id: 'men', label: t('catalog.men') },
    ...(isFeatureEnabled('women') ? [{ id: 'women' as Gender, label: t('catalog.women') }] : []),
  ]

  const availabilityOptions: { id: Availability; label: string }[] = [
    { id: 'in-stock', label: t('catalog.available') },
    { id: 'low-stock', label: t('catalog.lowStock') },
    { id: 'out-of-stock', label: t('catalog.soldOut') },
  ]

  const colorOptions = useMemo(() => {
    const hidden = new Set(cfg.hiddenColors ?? [])
    const base = FABRIC_COLORS.map((c) => ({
      id: c.id,
      label: c.id.charAt(0).toUpperCase() + c.id.slice(1),
      swatch: c.hex,
    }))
    const seen = new Set(base.map((c) => c.id))
    const extra = (cfg.customColors ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => ({ id: c.id, label: c.name || c.id, swatch: c.hex }))
    return [...base, ...extra].filter((c) => !hidden.has(c.id))
  }, [cfg.customColors, cfg.hiddenColors])

  const categories = useCategories()
  const allCollections = useCollections()

  const isSpanish = i18n.language?.startsWith('es')
  const collections: { id: CollectionId; label: string }[] = allCollections.map((c) => ({
    id: c.id as CollectionId,
    label: isSpanish ? c.label_es : c.label_en || c.label_es,
  }))


  const sortOpts: SortKey[] = ['relevance', 'newest', 'price-asc', 'price-desc', 'bestsellers', 'rated']

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="pb-3 text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-bone">{t('catalog.sortBy')}</span>
        <select
          value={state.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortKey })}
          className="mt-2 w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
        >
          {sortOpts.map((o) => (
            <option key={o} value={o} className="bg-carbon">
              {t(`catalog.${parseSortKeyLabel(o)}`)}
            </option>
          ))}
        </select>
      </label>

      <CheckGroup options={genders} value={state.genders} onToggle={toggle('genders')} label={t('catalog.gender')} />
      <CheckGroup
        options={categories.map((c) => ({ id: c.id, label: t(`catalog.types.${c.id}`, { defaultValue: c.label }) }))}
        value={state.categories}
        onToggle={toggle('categories')}
        label={t('catalog.type')}
      />
      <CheckGroup options={SIZES.map((s) => ({ id: s, label: s }))} value={state.sizes} onToggle={toggle('sizes')} label={t('catalog.size')} />
      <CheckGroup options={colorOptions} value={state.colors} onToggle={toggle('colors')} label={t('catalog.color')} />

      <fieldset className="border-b border-gold/15 pb-5">
        <legend className="pb-3 text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-bone">{t('catalog.price')}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label="min"
            value={state.minPrice}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => onChange({ minPrice: Number(e.target.value) })}
            className="w-full border border-gold/25 bg-night px-2 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
          />
          <span className="text-bone">—</span>
          <input
            type="number"
            aria-label="max"
            value={state.maxPrice}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
            className="w-full border border-gold/25 bg-night px-2 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
          />
        </div>
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          value={state.maxPrice}
          onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
          aria-label={t('catalog.price')}
          className="mt-3 w-full accent-gold"
        />
      </fieldset>

      <CheckGroup options={collections} value={state.collections} onToggle={toggle('collections')} label={t('catalog.collection')} />
      <CheckGroup
        options={[
          { id: 'original', label: t('catalog.qualityOptions.original') },
          { id: 'turkish', label: t('catalog.qualityOptions.turkish') },
        ]}
        value={state.quality}
        onToggle={toggle('quality')}
        label={t('catalog.quality')}
      />
      <CheckGroup options={availabilityOptions} value={state.availability} onToggle={toggle('availability')} label={t('catalog.availability')} />
    </div>
  )
}