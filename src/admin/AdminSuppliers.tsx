import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Search, Truck, Power } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { useUi } from '@/store/ui'
import { useLiveReload } from '@/hooks/useLiveReload'
import { Modal } from '@/components/Modal'
import { Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { SupplierRow } from '@/services/adminService'

const CATEGORY_SUGGESTIONS = ['Textiles', 'Confección', 'Accesorios', 'Calzado', 'Marroquinería', 'Logística', 'Empaques', 'Otro']

const EMPTY_FORM = {
  company: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  category: '',
  notes: '',
  active: true,
}

export function AdminSuppliers() {
  const pushToast = useUi((s) => s.pushToast)
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<SupplierRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.suppliers()
      setRows(res.items)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => { load() }, [load])
  useLiveReload(() => { void load() })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      `${r.company} ${r.tax_id ?? ''} ${r.email ?? ''} ${r.category ?? ''}`.toLowerCase().includes(q),
    )
  }, [rows, query])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (row: SupplierRow) => {
    setEditing(row)
    setForm({
      company: row.company,
      taxId: row.tax_id ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      category: row.category ?? '',
      notes: row.notes ?? '',
      active: !!row.active,
    })
    setErrors({})
    setFormOpen(true)
  }

  const validate = () => {
    const er: Record<string, string> = {}
    if (form.company.trim().length < 2) er.company = 'La empresa es obligatoria'
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = 'Correo no válido'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const save = async () => {
    if (!validate() || saving) return
    setSaving(true)
    const payload = {
      company: form.company.trim(),
      taxId: form.taxId.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      category: form.category.trim(),
      notes: form.notes.trim(),
      active: form.active,
    }
    try {
      if (editing) await adminService.updateSupplier(editing.id, payload)
      else await adminService.createSupplier(payload)
      setFormOpen(false)
      pushToast(editing ? 'Proveedor actualizado' : 'Proveedor registrado')
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: SupplierRow) => {
    try {
      await adminService.patchSupplier(row.id, { active: !row.active })
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, active: r.active ? 0 : 1 } : r)))
      pushToast(`${row.company}: ${row.active ? 'desactivado' : 'activado'}`)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cambiar el estado', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminService.deleteSupplier(deleting.id)
      setDeleting(null)
      pushToast('Proveedor eliminado')
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const input = (key: keyof typeof form, label: string, placeholder = '') => (
    <label className="block">
      <span className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">{label}</span>
      <input
        value={form[key] as string}
        onChange={(e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((er) => ({ ...er, [key]: '' })) }}
        placeholder={placeholder}
        className={cn(
          'w-full border bg-night px-3 py-2.5 text-xs text-ivory placeholder:text-bone/60 focus:outline-none',
          errors[key] ? 'border-red-500/70 focus:border-red-500' : 'border-gold/25 focus:border-gold',
        )}
      />
      {errors[key] && <p className="pt-1 text-[0.62rem] text-red-400">{errors[key]}</p>}
    </label>
  )

  return (
    <div className="space-y-4">
      {/* ---------- barra de herramientas ---------- */}
      <div className="flex flex-wrap items-center gap-2 border border-gold/15 bg-carbon/40 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa, NIT o correo…"
            className="w-full border border-gold/25 bg-night py-2.5 pl-9 pr-3 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gold px-4 py-2.5 text-[0.62rem] font-bold uppercase tracking-widest text-night hover:bg-gold-soft"
        >
          <Plus size={14} /> Nuevo proveedor
        </button>
      </div>

      <div className="flex items-center justify-between border border-gold/15 bg-carbon/40 px-4 py-2.5 text-xs text-bone">
        <span>{filtered.length} proveedores · {rows.filter((r) => r.active).length} activos</span>
      </div>

      {/* ---------- tabla ---------- */}
      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>Empresa</Th>
                <Th>NIT / Identificación</Th>
                <Th>Contacto</Th>
                <Th>Categoría</Th>
                <Th>Creado</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading && rows.length === 0 && <EmptyRow colSpan={7} message="Cargando…" />}
              {!loading && filtered.length === 0 && (
                <EmptyRow colSpan={7} message={rows.length === 0 ? 'Aún no hay proveedores registrados. Crea el primero con “Nuevo proveedor”.' : 'Ningún proveedor coincide con la búsqueda'} />
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-carbon/60">
                  <Td>
                    <p className="text-ivory">{r.company}</p>
                    {r.notes && <p className="line-clamp-1 max-w-[240px] text-xs text-bone" title={r.notes}>{r.notes}</p>}
                  </Td>
                  <Td><span className="text-bone">{r.tax_id ?? '—'}</span></Td>
                  <Td>
                    <p className="text-xs text-bone">{r.phone ?? '—'}</p>
                    <p className="text-xs text-bone">{r.email ?? '—'}</p>
                  </Td>
                  <Td><span className="text-bone">{r.category ?? '—'}</span></Td>
                  <Td><span className="text-bone">{shortDate(r.created_at)}</span></Td>
                  <Td>
                    <span className={cn(
                      'border px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-wider',
                      r.active ? 'border-emerald-400/40 text-emerald-300' : 'border-bone/30 text-bone',
                    )}>
                      {r.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleActive(r)} title={r.active ? 'Desactivar' : 'Activar'} aria-label={r.active ? 'Desactivar proveedor' : 'Activar proveedor'}
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold">
                        <Power size={13} />
                      </button>
                      <button onClick={() => openEdit(r)} title="Editar" aria-label="Editar proveedor"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleting(r)} title="Eliminar" aria-label="Eliminar proveedor"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
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

      {/* ---------- modal crear/editar ---------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Editar ${editing.company}` : 'Nuevo proveedor'} maxWidth="max-w-lg">
        <div className="space-y-4 p-6">
          {input('company', 'Empresa / nombre comercial *', 'Textiles Antioquia SAS')}
          <div className="grid gap-4 sm:grid-cols-2">
            {input('taxId', 'NIT / identificación fiscal', '900123456-7')}
            {input('phone', 'Teléfono', '+57 604 555 0000')}
          </div>
          {input('email', 'Correo electrónico', 'compras@empresa.com')}
          {input('address', 'Dirección', 'Cra 50 # 30-40, Medellín')}
          <div>
            <p className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Categoría de productos</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: f.category === c ? '' : c }))}
                  className={cn(
                    'border px-2.5 py-1.5 text-[0.6rem] uppercase tracking-wider transition-colors',
                    form.category === c ? 'border-gold bg-gold/15 text-gold' : 'border-gold/25 text-bone hover:text-gold',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              value={CATEGORY_SUGGESTIONS.includes(form.category) ? '' : form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Otra categoría…"
              className="mt-2 w-full border border-gold/25 bg-night px-3 py-2 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
          </div>
          <label className="block">
            <span className="pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone">Notas / observaciones</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Condiciones de pago, tiempos de entrega, referencias…"
              className="w-full resize-none border border-gold/25 bg-night px-3 py-2.5 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 accent-[#c9a227]"
            />
            <span className="text-xs text-ivory">Proveedor activo</span>
          </label>
          <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
            <button onClick={() => setFormOpen(false)} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50">
              {saving && <Spinner className="border-night/30 border-t-night" />} Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------- confirmación eliminar ---------- */}
      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Eliminar proveedor" maxWidth="max-w-md">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3 border border-gold/10 p-3">
            <span className="flex h-10 w-10 items-center justify-center border border-gold/20 text-gold"><Truck size={16} /></span>
            <div>
              <p className="text-sm text-ivory">{deleting?.company}</p>
              <p className="text-[0.62rem] text-bone">Se eliminará el registro del proveedor.</p>
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

function shortDate(iso: string) {
  const d = new Date(iso.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CO')
}
