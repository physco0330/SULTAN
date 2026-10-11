import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Star, StarOff, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { useUi } from '@/store/ui'
import { Modal } from '@/components/Modal'
import { Spinner, EmptyRow } from '@/admin/ui'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { cn } from '@/utils/cn'
import type { AdminProduct } from '@/services/adminService'
import type { ImageStatus, ProductImageRow } from '@/services/adminService'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

const STATUS_LABELS: Record<ImageStatus, string> = {
  published: 'Publicada',
  pending: 'Pendiente',
  disabled: 'Desactivada',
}
const STATUS_TONES: Record<ImageStatus, string> = {
  published: 'border-emerald-400/40 text-emerald-300',
  pending: 'border-amber-400/40 text-amber-300',
  disabled: 'border-bone/30 text-bone',
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

interface PendingImage {
  key: string
  name: string
  dataUrl: string
  size: number
}

export function AdminImages() {
  const pushToast = useUi((s) => s.pushToast)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [productId, setProductId] = useState('')
  const [images, setImages] = useState<ProductImageRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingImages, setLoadingImages] = useState(false)
  const [pending, setPending] = useState<PendingImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<ProductImageRow | null>(null)
  const [editAlt, setEditAlt] = useState('')
  const [editStatus, setEditStatus] = useState<ImageStatus>('published')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<ProductImageRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await adminService.products()
      setProducts(res.items)
      if (res.items.length > 0) setProductId((cur) => cur || res.items[0].id)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cargar el catálogo', 'error')
    } finally {
      setLoadingProducts(false)
    }
  }, [pushToast])

  const loadImages = useCallback(async (id: string) => {
    if (!id) { setImages([]); return }
    setLoadingImages(true)
    try {
      const res = await adminService.productImages(id)
      setImages(res.items)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudieron cargar las imágenes', 'error')
    } finally {
      setLoadingImages(false)
    }
  }, [pushToast])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadImages(productId) }, [productId, loadImages])

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted: PendingImage[] = []
    const rejected: string[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) { rejected.push(`${file.name} (formato)`); continue }
      if (file.size > MAX_FILE_BYTES) { rejected.push(`${file.name} (5 MB máx)`); continue }
      try {
        accepted.push({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: await fileToDataUrl(file),
          size: file.size,
        })
      } catch {
        rejected.push(`${file.name} (lectura)`)
      }
    }
    if (rejected.length > 0) pushToast(`Rechazado: ${rejected.join(', ')}`, 'error')
    if (accepted.length > 0) {
      setPending((p) => [...p, ...accepted].slice(0, 10))
      pushToast(`${accepted.length} imagen(es) lista(s) para subir`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const upload = async () => {
    if (!productId || pending.length === 0) return
    setUploading(true)
    try {
      await adminService.uploadImages(
        productId,
        pending.map((p) => ({ data: p.dataUrl, alt: '' })),
      )
      setPending([])
      await loadImages(productId)
      invalidateCatalogCache()
      pushToast('Imágenes publicadas en el catálogo')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudieron subir las imágenes', 'error')
    } finally {
      setUploading(false)
    }
  }

  const move = async (image: ProductImageRow, direction: -1 | 1) => {
    const ordered = [...images].sort((a, b) => a.position - b.position || a.id - b.id)
    const index = ordered.findIndex((i) => i.id === image.id)
    const target = ordered[index + direction]
    if (!target) return
    const ids = ordered.map((i) => i.id)
    ids[index] = target.id
    ids[index + direction] = image.id
    setBusyId(image.id)
    try {
      await adminService.reorderImages(ids)
      await loadImages(productId)
      invalidateCatalogCache()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo reordenar', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const setPrimary = async (image: ProductImageRow) => {
    if (image.is_primary) return
    setBusyId(image.id)
    try {
      await adminService.updateImage(image.id, { isPrimary: true })
      await loadImages(productId)
      invalidateCatalogCache()
      pushToast('Portada actualizada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cambiar la portada', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      await adminService.updateImage(editing.id, { alt: editAlt, status: editStatus })
      setEditing(null)
      await loadImages(productId)
      invalidateCatalogCache()
      pushToast('Imagen actualizada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminService.deleteImage(deleting.id)
      setDeleting(null)
      await loadImages(productId)
      invalidateCatalogCache()
      pushToast('Imagen eliminada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const ordered = useMemo(() => [...images].sort((a, b) => a.position - b.position || a.id - b.id), [images])
  const primary = ordered.find((i) => i.is_primary && i.status === 'published')

  return (
    <div className="space-y-5">
      {/* ---------- selector de producto ---------- */}
      <div className="grid gap-3 border border-gold/15 bg-carbon/40 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Producto del catálogo</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={loadingProducts}
            className="w-full border border-gold/25 bg-night px-3 py-2.5 text-xs text-ivory focus:border-gold focus:outline-none disabled:opacity-50"
          >
            {loadingProducts && <option>Cargando…</option>}
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.sku || p.id}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-bone">
          {ordered.length} imagen(es) · <span className="text-gold">{primary ? 'con portada' : 'sin portada'}</span>
        </p>
      </div>

      {/* ---------- subida con vista previa ---------- */}
      <div className="border border-gold/15 bg-carbon/40 p-4">
        <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Subir imágenes (JPEG, PNG o WebP · máx. 5 MB c/u)</p>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files) }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-gold/30 px-4 py-10 text-center transition-colors hover:border-gold/60 hover:bg-gold/5"
        >
          <ImagePlus size={26} className="text-gold" />
          <p className="text-sm text-ivory">Arrastra las fotos aquí o haz clic para elegir</p>
          <p className="text-xs text-bone">Vista previa antes de publicar · máximo 10 por carga</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </div>

        {pending.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Vista previa ({pending.length})</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {pending.map((p) => (
                <div key={p.key} className="group relative aspect-[3/4] overflow-hidden border border-gold/25 bg-ash">
                  <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                    aria-label={`Quitar ${p.name}`}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-night/80 text-bone hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                  <p className="absolute inset-x-0 bottom-0 truncate bg-night/85 px-2 py-1 text-[0.6rem] text-bone" title={p.name}>{p.name}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={upload}
                disabled={uploading || !productId}
                className="flex items-center gap-2 bg-gold px-5 py-2.5 text-[0.62rem] font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50"
              >
                {uploading ? <Spinner className="border-night/30 border-t-night" /> : <ImagePlus size={14} />}
                {uploading ? 'Publicando…' : `Publicar ${pending.length} imagen(es)`}
              </button>
              <button onClick={() => setPending([])} disabled={uploading} className="text-[0.62rem] uppercase tracking-widest text-bone hover:text-gold">
                Descartar
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---------- galería del producto ---------- */}
      <div>
        <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Galería del producto</p>
        {loadingImages ? (
          <div className="flex items-center justify-center border border-gold/15 bg-carbon/40 py-16 text-bone">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="border border-gold/15 bg-carbon/40">
            <EmptyRow colSpan={1} message="Este producto aún no tiene imágenes. Sube la primera arriba." />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ordered.map((img, index) => (
              <div key={img.id} className={cn('group relative border bg-carbon/40 transition-colors', img.is_primary ? 'border-gold' : 'border-gold/15')}>
                <div className="relative aspect-[3/4] overflow-hidden bg-ash">
                  <img src={img.path} alt={img.alt || 'Imagen del catálogo'} className="h-full w-full object-cover" />
                  {img.is_primary && (
                    <span className="absolute left-2 top-2 bg-gold px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-night">Portada</span>
                  )}
                  <span className={cn('absolute right-2 top-2 border px-2 py-0.5 text-[0.55rem] uppercase tracking-wider', STATUS_TONES[img.status])}>
                    {STATUS_LABELS[img.status]}
                  </span>
                </div>
                <div className="space-y-2 p-2.5">
                  <p className="truncate text-xs text-ivory" title={img.alt || '—'}>{img.alt || <span className="text-bone">Sin descripción</span>}</p>
                  <p className="text-[0.6rem] text-bone">Posición {index + 1}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <button onClick={() => setPrimary(img)} disabled={!!img.is_primary} title="Marcar como portada" aria-label="Marcar como portada"
                      className="flex h-7 w-7 items-center justify-center border border-gold/20 text-bone hover:text-gold disabled:opacity-40">
                      {img.is_primary ? <StarOff size={12} /> : <Star size={12} />}
                    </button>
                    <button onClick={() => move(img, -1)} disabled={index === 0} title="Subir" aria-label="Subir posición"
                      className="flex h-7 w-7 items-center justify-center border border-gold/20 text-bone hover:text-gold disabled:opacity-30">
                      <ArrowUp size={12} />
                    </button>
                    <button onClick={() => move(img, 1)} disabled={index === ordered.length - 1} title="Bajar" aria-label="Bajar posición"
                      className="flex h-7 w-7 items-center justify-center border border-gold/20 text-bone hover:text-gold disabled:opacity-30">
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={() => { setEditing(img); setEditAlt(img.alt ?? ''); setEditStatus(img.status) }}
                      title="Editar" aria-label="Editar imagen"
                      className="flex h-7 items-center justify-center border border-gold/20 px-2 text-[0.6rem] uppercase tracking-wider text-bone hover:text-gold"
                    >
                      Editar
                    </button>
                    <button onClick={() => setDeleting(img)} title="Eliminar" aria-label="Eliminar imagen"
                      className="flex h-7 w-7 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                    {busyId === img.id && (
                      <span className="ms-auto text-[0.6rem] text-gold"><Loader2 size={12} className="animate-spin" /></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- vista previa del catálogo público ---------- */}
      {ordered.length > 0 && (
        <div className="border border-gold/15 bg-carbon/40 p-4">
          <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Vista previa — como se verá en la ficha del producto</p>
          <div className="flex gap-3">
            <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden border border-gold/15">
              <img src={(primary ?? ordered[0]).path} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ordered.filter((i) => i.status === 'published').map((img) => (
                <div key={img.id} className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden border border-gold/15">
                  <img src={img.path} alt="" className="h-full w-full object-cover" />
                  {img.is_primary && <span className="absolute inset-x-0 bottom-0 bg-gold py-0.5 text-center text-[0.5rem] font-bold uppercase text-night">Portada</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- modal editar ---------- */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar imagen" maxWidth="max-w-md">
        {editing && (
          <div className="space-y-4 p-6">
            <div className="aspect-[3/4] max-h-56 overflow-hidden border border-gold/15">
              <img src={editing.path} alt="" className="h-full w-full object-cover" />
            </div>
            <label className="block">
              <span className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Descripción (alt)</span>
              <input
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                maxLength={160}
                placeholder="Vestido de seda — vista frontal"
                className="w-full border border-gold/25 bg-night px-3 py-2.5 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
              />
            </label>
            <div>
              <p className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Estado</p>
              <div className="flex gap-2">
                {(Object.keys(STATUS_LABELS) as ImageStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={cn(
                      'border px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-wider transition-colors',
                      editStatus === s ? 'border-gold bg-gold/15 text-gold' : 'border-gold/25 text-bone hover:text-gold',
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
              <button onClick={() => setEditing(null)} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50">
                {savingEdit && <Spinner className="border-night/30 border-t-night" />} Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- confirmación eliminar ---------- */}
      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Eliminar imagen" maxWidth="max-w-md">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3 border border-gold/10 p-3">
            {deleting && <img src={deleting.path} alt="" className="h-20 w-16 object-cover" />}
            <div className="min-w-0">
              <p className="truncate text-xs text-ivory">{deleting?.alt || 'Sin descripción'}</p>
              <p className="text-[0.62rem] text-bone">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} disabled={deleteBusy} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
              Cancelar
            </button>
            <button onClick={confirmDelete} disabled={deleteBusy} className="flex items-center gap-2 bg-red-500/90 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500">
              {deleteBusy && <Spinner className="border-white/30 border-t-white" />} Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
