import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { useUi } from '@/store/ui'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { CATEGORIES, SIZES, FABRIC_COLORS } from '@/data/categories'
import { Spinner } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { Gender, CollectionId, CategoryId } from '@/types'
import type { AdminProduct } from '@/services/adminService'

const GENDERS: Gender[] = ['men', 'women', 'unisex']
const COLLECTIONS: CollectionId[] = ['new', 'premium', 'limited', 'bestsellers', 'offers']

export function ProductFormModal({
  open,
  onClose,
  product,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  product: AdminProduct | null
  onSaved: (p: AdminProduct) => void
}) {
  const pushToast = useUi((s) => s.pushToast)
  const [form, setForm] = useState({
    name: '',
    gender: 'unisex' as Gender,
    category: 'tshirts' as CategoryId,
    collection: 'new' as CollectionId,
    price: '',
    compareAtPrice: '',
    stock: '0',
    material: 'Premium cotton blend',
    sku: '',
    description: '',
    sizes: [] as string[],
    colors: ['black'] as string[],
    active: true,
    featured: false,
    isNew: false,
    isLimited: false,
    isBestSeller: false,
    isOnSale: false,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (product) {
      setForm({
        name: product.name,
        gender: product.gender,
        category: product.category,
        collection: product.collection,
        price: String(product.price),
        compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
        stock: String(product.stock),
        material: product.material,
        sku: product.sku,
        description: product.description,
        sizes: product.sizes,
        colors: product.colors.map((c) => c.id),
        active: true,
        featured: product.featured,
        isNew: product.isNew,
        isLimited: product.isLimited,
        isBestSeller: product.isBestSeller,
        isOnSale: product.isOnSale,
      })
    } else {
      setForm((f) => ({ ...f, name: '', price: '', compareAtPrice: '', stock: '0', sku: '', description: '', costToUsd: '' }))
    }
  }, [open, product])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: '' }))
  }

  const validate = () => {
    const er: Record<string, string> = {}
    if (!form.name.trim()) er.name = 'El nombre es obligatorio'
    const price = Number(form.price)
    if (!Number.isFinite(price) || price <= 0) er.price = 'Precio inválido'
    if (form.compareAtPrice && (!Number.isFinite(Number(form.compareAtPrice)) || Number(form.compareAtPrice) <= 0))
      er.compareAtPrice = 'Precio inválido'
    if (!/^\d+$/.test(form.stock)) er.stock = 'Stock numérico'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const save = async () => {
    if (!validate() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      category: form.category,
      collection: form.collection,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      stock: Math.max(0, Number(form.stock)),
      material: form.material.trim() || 'Premium cotton blend',
      sku: form.sku.trim(),
      description: form.description.trim(),
      colors: FABRIC_COLORS.filter((c) => form.colors.includes(c.id)).map((c) => ({
        id: c.id,
        name: c.id.charAt(0).toUpperCase() + c.id.slice(1),
        hex: c.hex,
      })),
      sizes: form.sizes.length ? form.sizes : form.category === 'accessories' ? ['OS'] : ['S', 'M', 'L', 'XL', 'XXL'],
      featured: form.featured,
      isNew: form.isNew,
      isLimited: form.isLimited,
      isBestSeller: form.isBestSeller,
      isOnSale: form.isOnSale || !!form.compareAtPrice,
      active: form.active,
    }
    try {
      const res = product
        ? await adminService.updateProduct(product.id, payload)
        : await adminService.createProduct(payload)
      invalidateCatalogCache()
      pushToast(product ? 'Producto actualizado' : 'Producto creado')
      onSaved(res.product)
      onClose()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof typeof form, placeholder: string) => (
    <input
      value={typeof form[key] === 'string' ? (form[key] as string) : ''}
      onChange={(e) => set(key, e.target.value as never)}
      placeholder={placeholder}
      aria-invalid={!!errors[key]}
      className={cn(
        'w-full border bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:outline-none',
        errors[key] ? 'border-red-500/70' : 'border-gold/25 focus:border-gold',
      )}
    />
  )

  const label = 'mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone'
  const select = 'w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none'

  return (
    <Modal open={open} onClose={onClose} title={product ? `EDITAR — ${product.name}` : 'NUEVO PRODUCTO'} maxWidth="max-w-3xl">
      <div className="grid gap-5 p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={label}>Nombre *</label>
          {input('name', 'Ej. Bosphorus Overshirt')}
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label className={label}>Género</label>
          <div className="flex gap-1">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => set('gender', g)}
                className={cn(
                  'flex-1 border px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors',
                  form.gender === g ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Categoría</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value as CategoryId)} className={select}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Colección</label>
            <select value={form.collection} onChange={(e) => set('collection', e.target.value as CollectionId)} className={select}>
              {COLLECTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Precio (USD) *</label>
          {input('price', 'Ej. 890')}
          {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price}</p>}
        </div>
        <div>
          <label className={label}>Precio de oferta (USD)</label>
          {input('compareAtPrice', 'Opcional')}
        </div>
        <div>
          <label className={label}>Stock *</label>
          {input('stock', 'Ej. 24')}
          {errors.stock && <p className="mt-1 text-xs text-red-400">{errors.stock}</p>}
        </div>
        <div>
          <label className={label}>SKU</label>
          {input('sku', 'Auto si se deja vacío')}
        </div>
        <div className="md:col-span-2">
          <label className={label}>Material</label>
          {input('material', 'Ej. Moleskin cotton')}
        </div>
        <div className="md:col-span-2">
          <label className={label}>Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Descripción del producto…"
            className="w-full resize-none border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
          />
        </div>

        <div>
          <label className={label}>Tallas</label>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  set('sizes', form.sizes.includes(s) ? form.sizes.filter((x) => x !== s) : [...form.sizes, s])
                }
                className={cn(
                  'min-w-[2.4rem] border px-2.5 py-1.5 text-xs transition-colors',
                  form.sizes.includes(s) ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Colores</label>
          <div className="flex flex-wrap gap-2">
            {FABRIC_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.id}
                title={c.id}
                onClick={() =>
                  set('colors', form.colors.includes(c.id) ? form.colors.filter((x) => x !== c.id) : [...form.colors, c.id])
                }
                className={cn(
                  'h-7 w-7 rounded-full border transition-all',
                  form.colors.includes(c.id) ? 'border-gold ring-2 ring-gold/40 ring-offset-2 ring-offset-carbon' : 'border-bone/40',
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-3 border-t border-gold/15 pt-4 sm:grid-cols-3">
          {(
            [
              ['featured', 'Destacado'],
              ['isNew', 'Nuevo'],
              ['isLimited', 'Edición limitada'],
              ['isBestSeller', 'Más vendido'],
              ['isOnSale', 'En oferta'],
              ['active', 'Activo / visible'],
            ] as const
          ).map(([key, text]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-ivory">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="h-4 w-4 accent-[#C9A227]"
              />
              {text}
            </label>
          ))}
        </div>

        <div className="md:col-span-2 flex justify-end gap-2 border-t border-gold/15 pt-5">
          <button
            onClick={onClose}
            className="border border-gold/40 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-gold px-8 py-3 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50"
          >
            {saving && <Spinner className="border-night/30 border-t-night" />}
            {product ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </Modal>
  )
}