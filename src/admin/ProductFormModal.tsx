import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useCategories, useCollections, createCategory, createCollection } from '@/hooks/useTaxonomies'
import { convertPrice } from '@/data/currencies'
import { useUi } from '@/store/ui'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { SIZES, FABRIC_COLORS } from '@/data/categories'
import { Spinner } from '@/admin/ui'
import { ProductThumb } from '@/admin/ProductThumb'
import { cn } from '@/utils/cn'
import { isFeatureEnabled } from '@/config/features'
import type { Gender, CollectionId, CategoryId, ProductQuality } from '@/types'
import type { AdminProduct, ProductImageRow } from '@/services/adminService'

const GENDERS: Gender[] = isFeatureEnabled('women') ? ['men', 'women', 'unisex'] : ['men', 'unisex']

/** Los precios en COP se escriben con separadores de miles ("3.649.000"). */
const copToNumber = (v: string) => Number(v.replace(/\D/g, ''))

/** Guarda en USD con decimales: redondear a dólares enteros cambiaba el precio al volver a COP. */
const usdFromCop = (cop: number) => Math.round(convertPrice(cop, 'COP', 'USD') * 1e6) / 1e6

/** Un precio guardado solo se reutiliza si es finito y razonable (evita datos corruptos o 0). */
const saneUsd = (n?: number | null) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e7 ? n : 0)

/** Valores iniciales de un producto nuevo. Se generan de cero cada vez: nada se hereda del anterior. */
const emptyForm = () => ({
  name: '',
  gender: 'unisex' as Gender,
  category: 'tshirts' as CategoryId,
  collection: 'new' as CollectionId,
  price: '',
  compareAtPrice: '',
  stock: '',
  material: 'Premium cotton blend',
  description: '',
  sizes: [] as string[],
  colors: ['black'] as string[],
  quality: 'turkish' as ProductQuality,
  active: true,
  featured: false,
  isNew: false,
  isLimited: false,
  isBestSeller: false,
  isOnSale: false,
  isCombo: false,
  comboItems: [] as { productId: string; name: string; qty: number }[],
})

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

interface PendingFile {
  key: string
  name: string
  dataUrl: string
}

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
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [images, setImages] = useState<ProductImageRow[]>([])
  const [pending, setPending] = useState<PendingFile[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState<null | 'category' | 'collection'>(null)
  const [creatingLabel, setCreatingLabel] = useState('')
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [productOptions, setProductOptions] = useState<AdminProduct[]>([])
  const [comboPick, setComboPick] = useState('')
  const categories = useCategories()
  const collections = useCollections()

  useEffect(() => {
    if (!open) return
    setErrors({})
    setPending([])
    setComboPick('')
    adminService
      .products()
      .then((r) => setProductOptions(r.items))
      .catch(() => setProductOptions([]))
    if (product) {
      setLoadingImages(true)
      adminService
        .productImages(product.id)
        .then((r) => setImages(r.items))
        .catch(() => setImages([]))
        .finally(() => setLoadingImages(false))
      setForm({
        name: product.name,
        gender: product.gender,
        category: product.category,
        collection: product.collection,
        /* Si el precio normal guardado está corrupto (o es 0) se ignora y solo se usa el cobrado. */
        price: String(Math.round(convertPrice(saneUsd(product.compareAtPrice) || saneUsd(product.price), 'USD', 'COP'))),
        compareAtPrice: saneUsd(product.compareAtPrice)
          ? String(Math.round(convertPrice(saneUsd(product.price), 'USD', 'COP')))
          : '',
        stock: String(product.stock),
        material: product.material,
        description: product.description,
        sizes: product.sizes,
        colors: product.colors.map((c) => c.id),
        quality: (product.quality ?? 'turkish') as ProductQuality,
        active: product.active ?? true,
        featured: product.featured,
        isNew: product.isNew,
        isLimited: product.isLimited,
        isBestSeller: product.isBestSeller,
        isOnSale: product.isOnSale,
        isCombo: !!product.isCombo,
        comboItems: product.comboItems ?? [],
      })
    } else {
      setImages([])
      setForm(emptyForm())
    }
  }, [open, product])

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted: PendingFile[] = []
    const rejected: string[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) { rejected.push(`${file.name} (formato)`); continue }
      if (file.size > MAX_IMAGE_BYTES) { rejected.push(`${file.name} (máx. 5 MB)`); continue }
      try {
        accepted.push({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('lectura'))
            reader.readAsDataURL(file)
          }),
        })
      } catch {
        rejected.push(`${file.name} (lectura)`)
      }
    }
    if (rejected.length > 0) pushToast(`Rechazado: ${rejected.join(', ')}`, 'error')
    if (accepted.length > 0) setPending((p) => [...p, ...accepted].slice(0, 10))
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeExistingImage = async (id: number) => {
    setImageBusy(true)
    try {
      await adminService.deleteImage(id)
      setImages((list) => list.filter((i) => i.id !== id))
      invalidateCatalogCache()
      pushToast('Imagen eliminada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setImageBusy(false)
    }
  }

  const makePrimary = async (id: number) => {
    setImageBusy(true)
    try {
      await adminService.updateImage(id, { isPrimary: true })
      if (product) {
        const r = await adminService.productImages(product.id)
        setImages(r.items)
      }
      invalidateCatalogCache()
      pushToast('Portada actualizada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cambiar la portada', 'error')
    } finally {
      setImageBusy(false)
    }
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: '' }))
  }

  /* --- Combos: agrupan prendas ya creadas y llevan su propio precio. --- */
  const addComboItem = () => {
    const picked = productOptions.find((p) => p.id === comboPick)
    if (!picked) return
    set('comboItems', [...form.comboItems, { productId: picked.id, name: picked.name, qty: 1 }])
    setComboPick('')
  }

  const removeComboItem = (index: number) => {
    set('comboItems', form.comboItems.filter((_, i) => i !== index))
  }

  const changeComboQty = (index: number, qty: number) => {
    set('comboItems', form.comboItems.map((ci, i) => (i === index ? { ...ci, qty: Math.max(1, Math.min(99, qty)) } : ci)))
  }

  const validate = () => {
    const er: Record<string, string> = {}
    if (!form.name.trim()) er.name = 'El nombre es obligatorio'
    const price = copToNumber(form.price)
    if (!Number.isFinite(price) || price <= 0) er.price = 'Precio inválido'
    const offer = copToNumber(form.compareAtPrice)
    if (form.compareAtPrice && (!Number.isFinite(offer) || offer <= 0)) er.compareAtPrice = 'Precio inválido'
    else if (form.compareAtPrice && offer >= price) er.compareAtPrice = 'La oferta debe ser menor que el precio normal'
    if (!/^\d+$/.test(form.stock)) er.stock = 'Indica el stock (número entero)'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const save = async () => {
    if (savingRef.current || !validate()) return
    savingRef.current = true
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      category: form.category,
      collection: form.collection,
      price: usdFromCop(copToNumber(form.compareAtPrice || form.price)),
      compareAtPrice: form.compareAtPrice ? usdFromCop(copToNumber(form.price)) : undefined,
      stock: Math.max(0, Number(form.stock)),
      material: form.material.trim() || 'Premium cotton blend',
      sku: product?.sku ?? '',
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
      isCombo: form.isCombo,
      comboItems: form.isCombo ? form.comboItems : [],
      quality: form.quality,
      active: form.active,
    }
    try {
      const res = product
        ? await adminService.updateProduct(product.id, payload)
        : await adminService.createProduct(payload)
      const savedId = res.product?.id
      let failedImages = 0
      let saved: AdminProduct = res.product
      if (pending.length > 0 && savedId) {
        for (const p of pending) {
          try {
            await adminService.uploadImages(savedId, [{ data: p.dataUrl, alt: '' }])
          } catch {
            failedImages += 1
          }
        }
        try {
          const imgs = await adminService.productImages(savedId)
          saved = { ...res.product, images: imgs.items.map((i) => ({ src: i.path, alt: i.alt })) }
        } catch {
          /* la lista se actualizará al recargar */
        }
      }
      invalidateCatalogCache()
      if (failedImages > 0) {
        pushToast(`Producto guardado, pero ${failedImages} imagen(es) no se pudieron subir`, 'error')
      } else {
        pushToast(
          product
            ? 'Producto actualizado'
            : pending.length > 0
              ? 'Producto creado con imágenes'
              : 'Producto creado',
        )
      }
      onSaved(saved)
      onClose()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      savingRef.current = false
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

        <div>
          <label className={label}>Calidad</label>
          <div className="flex gap-1">
            {(['turkish', 'original'] as ProductQuality[]).map((qq) => (
              <button
                key={qq}
                type="button"
                onClick={() => set('quality', qq)}
                className={cn(
                  'flex-1 border px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors',
                  form.quality === qq ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
                )}
              >
                {qq === 'turkish' ? 'Turca' : 'Original'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Categoría</label>
            <div className="flex gap-1.5">
              <select value={form.category} onChange={(e) => set('category', e.target.value as CategoryId)} className={select}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setCreating('category'); setCreatingLabel('') }}
                title="Nueva categoría"
                aria-label="Nueva categoría"
                className="flex w-10 shrink-0 items-center justify-center border border-gold/25 text-lg text-bone transition-colors hover:border-gold/60 hover:text-gold"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label className={label}>Colección</label>
            <div className="flex gap-1.5">
              <select value={form.collection} onChange={(e) => set('collection', e.target.value as CollectionId)} className={select}>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.label_es}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setCreating('collection'); setCreatingLabel('') }}
                title="Nueva colección"
                aria-label="Nueva colección"
                className="flex w-10 shrink-0 items-center justify-center border border-gold/25 text-lg text-bone transition-colors hover:border-gold/60 hover:text-gold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className={label}>Precio normal (COP) *</label>
          {input('price', 'Ej. 890')}
          {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price}</p>}
        </div>
        <div>
          <label className={label}>Precio de oferta (COP)</label>
          <p className="mb-1.5 text-[0.62rem] leading-relaxed text-bone">Si lo llenas, este es el precio que se cobra y el normal aparece tachado.</p>
          {input('compareAtPrice', 'Opcional')}
        </div>
        <div>
          <label className={label}>Stock *</label>
          {input('stock', 'Ej. 24')}
          {errors.stock && <p className="mt-1 text-xs text-red-400">{errors.stock}</p>}
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
              ['isCombo', 'Es combo de prendas'],
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

        {form.isCombo && (
          <div className="md:col-span-2 space-y-3 border-t border-gold/15 pt-5">
            <label className={label}>Prendas del combo</label>
            <p className="text-[0.62rem] leading-relaxed text-bone">
              Elige prendas ya creadas. El precio del combo es el precio de este producto; también puedes escribir el combo a mano en la descripción.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={comboPick}
                onChange={(e) => setComboPick(e.target.value)}
                className="min-w-[220px] flex-1 border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
              >
                <option value="">Añadir prenda…</option>
                {productOptions
                  .filter((o) => o.id !== product?.id && !form.comboItems.some((ci) => ci.productId === o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addComboItem}
                disabled={!comboPick}
                className="border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10 disabled:opacity-40"
              >
                Añadir
              </button>
            </div>
            <ul className="space-y-1">
              {form.comboItems.map((ci, i) => (
                <li key={`${ci.productId}-${i}`} className="flex items-center justify-between gap-3 border border-gold/15 bg-night px-3 py-2 text-sm text-ivory">
                  <span className="min-w-0 flex-1 truncate">{ci.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => changeComboQty(i, ci.qty - 1)} aria-label="−" className="flex h-6 w-6 items-center justify-center border border-gold/25 text-gold hover:bg-gold/10">−</button>
                      <span className="w-6 text-center">{ci.qty}</span>
                      <button type="button" onClick={() => changeComboQty(i, ci.qty + 1)} aria-label="+" className="flex h-6 w-6 items-center justify-center border border-gold/25 text-gold hover:bg-gold/10">+</button>
                    </span>
                    <button type="button" onClick={() => removeComboItem(i)} aria-label="Quitar prenda" className="text-bone hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
              {form.comboItems.length === 0 && <li className="text-xs text-bone">Sin prendas todavía.</li>}
            </ul>
          </div>
        )}

        <div className="md:col-span-2 border-t border-gold/15 pt-5">
          <label className={label}>Imágenes del producto</label>
          <p className="mb-3 text-[0.62rem] leading-relaxed text-bone">
            JPEG, PNG o WebP · máximo 5 MB por foto · la primera será la portada del catálogo.
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onPickFiles(e.dataTransfer.files) }}
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed border-gold/30 px-4 py-8 text-center transition-colors hover:border-gold/60 hover:bg-gold/5"
          >
            <span className="text-sm text-ivory">Arrastra las fotos aquí o haz clic para elegir</span>
            <span className="text-[0.62rem] text-bone">Se previsualizan antes de guardar</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
          </div>

          {loadingImages && (
            <p className="mt-3 flex items-center gap-2 text-xs text-bone"><Spinner /> Cargando imágenes…</p>
          )}

          {images.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Imágenes actuales</p>
              <div className="flex flex-wrap gap-2">
                {[...images].sort((a, b) => a.position - b.position || a.id - b.id).map((img) => (
                  <div key={img.id} className={cn('group relative h-24 w-19 overflow-hidden border', img.is_primary ? 'border-gold' : 'border-gold/15')} style={{ width: '4.75rem' }}>
                    <ProductThumb
                      src={img.path}
                      alt={img.alt || img.id.toString()}
                      className="h-full w-full"
                    />
                    {img.is_primary && (
                      <span className="absolute left-1 top-1 bg-gold px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-night">Portada</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-night/85 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!img.is_primary && (
                        <button type="button" onClick={() => void makePrimary(img.id)} disabled={imageBusy} title="Marcar como portada" aria-label="Marcar como portada" className="text-bone hover:text-gold disabled:opacity-40">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26L21.5 9.27l-4.75 4.37 1.13 6.36L12 17.1l-5.88 2.9 1.13-6.36L2.5 9.27l6.6-1.01L12 2z"/></svg>
                        </button>
                      )}
                      <button type="button" onClick={() => void removeExistingImage(img.id)} disabled={imageBusy} title="Eliminar imagen" aria-label="Eliminar imagen" className="text-bone hover:text-red-400 disabled:opacity-40">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-gold">Por publicar ({pending.length})</p>
              <div className="flex flex-wrap gap-2">
                {pending.map((p) => (
                  <div key={p.key} className="group relative h-24 w-19 overflow-hidden border border-gold/40" style={{ width: '4.75rem' }}>
                    <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                      aria-label={`Quitar ${p.name}`}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-night/85 text-bone hover:text-red-400"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                    <p className="absolute inset-x-0 bottom-0 truncate bg-night/85 px-1 py-0.5 text-[0.5rem] text-bone" title={p.name}>{p.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {creating && (
        <Modal open onClose={() => setCreating(null)} title={creating === 'category' ? 'Nueva categoría' : 'Nueva colección'} maxWidth="max-w-sm">
          <div className="space-y-4 p-6">
            <label className="block">
              <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">
                Nombre en español
              </span>
              <input
                value={creatingLabel}
                onChange={(e) => setCreatingLabel(e.target.value)}
                placeholder={creating === 'category' ? 'Ej. Blusas' : 'Ej. Temporada navideña'}
                className="w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') void submitCreating() }}
              />
            </label>
            <p className="text-[0.62rem] leading-relaxed text-bone">
              Se crea al instante y queda disponible en el catálogo y los filtros de la tienda.
            </p>
            <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
              <button onClick={() => setCreating(null)} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
                Cancelar
              </button>
              <button onClick={() => void submitCreating()} disabled={creatingBusy || creatingLabel.trim().length < 2} className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50">
                {creatingBusy && <Spinner className="border-night/30 border-t-night" />} Crear
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )

  async function submitCreating() {
    if (creatingLabel.trim().length < 2 || creatingBusy) return
    setCreatingBusy(true)
    try {
      const id = creating === 'category'
        ? await createCategory(creatingLabel.trim())
        : await createCollection(creatingLabel.trim())
      if (creating === 'category') set('category', id as CategoryId)
      else set('collection', id as CollectionId)
      setCreating(null)
      pushToast(creating === 'category' ? 'Categoría creada y seleccionada' : 'Colección creada y seleccionada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo crear', 'error')
    } finally {
      setCreatingBusy(false)
    }
  }
}