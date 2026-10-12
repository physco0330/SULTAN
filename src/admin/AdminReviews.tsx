import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Search } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { useUi } from '@/store/ui'
import { useLiveReload } from '@/hooks/useLiveReload'
import { Modal } from '@/components/Modal'
import { Spinner, EmptyRow, Th, Td, TableScroller, shortDate } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { AdminReview, AdminProduct, ReviewStatus } from '@/services/adminService'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: 'Publicada',
  pending: 'Pendiente',
  rejected: 'Rechazada',
}
const STATUS_TONE: Record<ReviewStatus, string> = {
  approved: 'border-emerald-400/40 text-emerald-300',
  pending: 'border-amber-400/40 text-amber-300',
  rejected: 'border-red-400/40 text-red-300',
}

export function AdminReviews() {
  const pushToast = useUi((s) => s.pushToast)
  const [items, setItems] = useState<AdminReview[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [demoCount, setDemoCount] = useState(0)
  const [purging, setPurging] = useState(false)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState<'' | ReviewStatus>('')
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [editing, setEditing] = useState<AdminReview | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', city: '', rating: 5, comment: '', productId: '', status: 'approved' as ReviewStatus,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AdminReview | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const res = await adminService.reviews({ status: status || undefined, q: q.trim() || undefined })
      setItems(res.items)
      setCounts(res.counts)
      setDemoCount(res.demoCount ?? 0)
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }, [status, q, pushToast])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load() })
  useEffect(() => {
    adminService.products().then((r) => setProducts(r.items)).catch(() => setProducts([]))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', city: '', rating: 5, comment: '', productId: '', status: 'approved' })
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (r: AdminReview) => {
    setEditing(r)
    setForm({
      name: r.name,
      city: r.city ?? '',
      rating: r.rating,
      comment: r.comment,
      productId: r.product_id ?? '',
      status: (r.status ?? 'approved') as ReviewStatus,
    })
    setErrors({})
    setFormOpen(true)
  }

  const save = async () => {
    const er: Record<string, string> = {}
    if (form.name.trim().length < 2) er.name = 'El nombre es obligatorio'
    if (form.rating < 1 || form.rating > 5) er.rating = 'Calificación inválida'
    if (form.comment.trim().length < 4) er.comment = 'Mínimo 4 caracteres'
    setErrors(er)
    if (Object.keys(er).length > 0) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        rating: form.rating,
        comment: form.comment.trim(),
        productId: form.productId || null,
        status: form.status,
      }
      if (editing) await adminService.updateReview(editing.id, payload)
      else await adminService.createReview(payload)
      pushToast(editing ? 'Reseña actualizada' : 'Reseña creada')
      setFormOpen(false)
      await load()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const moderate = async (r: AdminReview, next: ReviewStatus) => {
    try {
      await adminService.moderateReview(r.id, next)
      setItems((list) => list.map((x) => (x.id === r.id ? { ...x, status: next } : x)))
      setCounts((c) => ({
        ...c,
        [r.status]: Math.max((c[r.status] ?? 1) - 1, 0),
        [next]: (c[next] ?? 0) + 1,
      }))
      const label = next === 'approved' ? 'aprobada' : next === 'rejected' ? 'rechazada' : 'pendiente'
      pushToast(`Reseña ${label}`)
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminService.deleteReview(deleting.id)
      pushToast('Reseña eliminada')
      setDeleting(null)
      await load()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const purgeDemo = async () => {
    if (!window.confirm(
      `Se eliminarán ${demoCount} reseñas de demostración (personas que no existen). Esta acción no se puede deshacer.`,
    )) return
    setPurging(true)
    try {
      const res = await adminService.purgeDemoContent('reviews')
      pushToast(`Se eliminaron ${res.removed.reviews ?? 0} reseñas de demostración`, 'success')
      await load()
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'No se pudo limpiar', 'error')
    } finally {
      setPurging(false)
    }
  }

  const FILTERS: ['' | ReviewStatus, string][] = [
    ['', 'Todas'],
    ['pending', 'Pendientes'],
    ['approved', 'Publicadas'],
    ['rejected', 'Rechazadas'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border border-gold/15 bg-carbon/40 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por autor, comentario o producto…"
            className="w-full border border-gold/25 bg-night py-2.5 pl-9 pr-3 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([v, label]) => (
            <button
              key={v || 'all'}
              onClick={() => setStatus(v)}
              className={cn(
                'border px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-wider transition-colors',
                status === v ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:text-gold',
              )}
            >
              {label}
              {v && counts[v] ? ` (${counts[v]})` : ''}
            </button>
          ))}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gold px-4 py-2.5 text-[0.6rem] font-bold uppercase tracking-widest text-night hover:bg-gold-soft"
        >
          <Plus size={13} /> Nueva reseña
        </button>
      </div>

      {demoCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-xs leading-relaxed text-amber-200">
            Hay <strong>{demoCount}</strong> reseñas de demostración con nombres inventados y 5 estrellas.
            No se muestran en la tienda, pero conviene borrarlas antes de publicar.
          </p>
          <button
            onClick={purgeDemo}
            disabled={purging}
            className="flex items-center gap-2 border border-amber-400/50 px-3.5 py-2 text-[0.58rem] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-400/10 disabled:opacity-40"
          >
            {purging && <Spinner className="border-amber-400/30 border-t-amber-200" />}
            Eliminar reseñas demo
          </button>
        </div>
      )}

      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[880px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>Autor</Th>
                <Th>Valoración</Th>
                <Th>Producto</Th>
                <Th>Comentario</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {busy && items.length === 0 && <EmptyRow colSpan={6} message="Cargando…" />}
              {!busy && items.length === 0 && <EmptyRow colSpan={6} message="No hay reseñas para mostrar" />}
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-carbon/60">
                  <Td>
                    <p className="text-ivory">
                      {r.name}
                      {r.is_demo === 1 && (
                        <span className="ml-2 border border-amber-400/40 px-1.5 py-0.5 align-middle text-[0.5rem] font-bold uppercase tracking-wider text-amber-300">
                          demo
                        </span>
                      )}
                    </p>
                    {r.city && <p className="text-xs text-bone">{r.city}</p>}
                    <p className="text-[0.6rem] text-bone">{shortDate(r.created_at)}</p>
                  </Td>
                  <Td>
                    <span className="text-gold">
                      {'★'.repeat(r.rating)}
                      <span className="text-bone">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                  </Td>
                  <Td className="text-bone">{r.product_name ?? '—'}</Td>
                  <Td><span className="line-clamp-2 max-w-[280px] text-bone">{r.comment}</span></Td>
                  <Td>
                    <span
                      className={cn(
                        'border px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-wider',
                        STATUS_TONE[r.status] ?? 'border-bone/30 text-bone',
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'approved' && (
                        <button
                          onClick={() => moderate(r, 'approved')}
                          title="Aprobar"
                          aria-label="Aprobar reseña"
                          className="border border-gold/20 px-2 py-1 text-[0.58rem] uppercase tracking-wider text-bone hover:text-emerald-300"
                        >
                          Aprobar
                        </button>
                      )}
                      {r.status !== 'rejected' && (
                        <button
                          onClick={() => moderate(r, 'rejected')}
                          title="Rechazar"
                          aria-label="Rechazar reseña"
                          className="border border-gold/20 px-2 py-1 text-[0.58rem] uppercase tracking-wider text-bone hover:text-red-300"
                        >
                          Rechazar
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(r)}
                        title="Editar"
                        aria-label="Editar reseña"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleting(r)}
                        title="Eliminar"
                        aria-label="Eliminar reseña"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar reseña' : 'Nueva reseña'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Autor *</span>
              <input
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: '' })) }}
                className={cn(
                  'w-full border bg-night px-3 py-2.5 text-sm text-ivory focus:outline-none',
                  errors.name ? 'border-red-500/70' : 'border-gold/25 focus:border-gold',
                )}
              />
              {errors.name && <p className="pt-1 text-xs text-red-400">{errors.name}</p>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Ciudad</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Valoración *</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  className={cn(
                    'h-10 w-10 border text-lg transition-colors',
                    form.rating >= n ? 'border-gold bg-gold/10 text-gold' : 'border-gold/25 text-bone',
                  )}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Producto</span>
            <select
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              className="w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory focus:border-gold focus:outline-none"
            >
              <option value="">— Sin producto asociado —</option>
              {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Comentario *</span>
            <textarea
              value={form.comment}
              onChange={(e) => { setForm((f) => ({ ...f, comment: e.target.value })); setErrors((er) => ({ ...er, comment: '' })) }}
              rows={4}
              className={cn(
                'w-full resize-none border bg-night px-3 py-2.5 text-sm text-ivory focus:outline-none',
                errors.comment ? 'border-red-500/70' : 'border-gold/25 focus:border-gold',
              )}
            />
            {errors.comment && <p className="pt-1 text-xs text-red-400">{errors.comment}</p>}
          </label>

          <div>
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Estado</span>
            <div className="flex gap-1.5">
              {(['approved', 'pending', 'rejected'] as ReviewStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: st }))}
                  className={cn(
                    'flex-1 border px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-wider transition-colors',
                    form.status === st ? 'border-gold bg-gold/15 text-gold' : 'border-gold/25 text-bone hover:text-gold',
                  )}
                >
                  {STATUS_LABEL[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
            <button
              onClick={() => setFormOpen(false)}
              className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50"
            >
              {saving && <Spinner className="border-night/30 border-t-night" />} Guardar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Eliminar reseña" maxWidth="max-w-md">
        <div className="p-6">
          <p className="text-sm leading-relaxed text-bone">
            ¿Eliminar la reseña de <span className="text-ivory">“{deleting?.name}”</span>? Esta acción no se puede deshacer.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
              className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="flex items-center gap-2 bg-red-500/90 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500"
            >
              {deleteBusy && <Spinner className="border-white/30 border-t-white" />} Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}