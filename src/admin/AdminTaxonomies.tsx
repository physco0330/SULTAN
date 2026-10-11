import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Tags, Layers } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { invalidateTaxonomyCache } from '@/hooks/useTaxonomies'
import { useUi } from '@/store/ui'
import { Modal } from '@/components/Modal'
import { Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { CollectionRow } from '@/hooks/useTaxonomies'

interface CategoryRow {
  id: string
  label_es: string
  label_en: string
  label_tr: string
  sort: number
}

type Tab = 'categories' | 'collections'

export function AdminTaxonomies() {
  const pushToast = useUi((s) => s.pushToast)
  const [tab, setTab] = useState<Tab>('categories')
  const [catRows, setCatRows] = useState<CategoryRow[]>([])
  const [colRows, setColRows] = useState<CollectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ kind: Tab; id: string; labelEs: string; labelEn: string } | null>(null)
  const [creating, setCreating] = useState<Tab | null>(null)
  const [formLabel, setFormLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<{ kind: Tab; id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, cols] = await Promise.all([
        adminService.categories(),
        adminService.collections(),
      ])
      setCatRows(cats.items)
      setColRows(cols.items)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cargar', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => { load() }, [load])

  const saveEdit = async () => {
    if (!editing || formLabel.trim().length < 2 || busy) return
    setBusy(true)
    try {
      if (editing.kind === 'categories') {
        await adminService.updateCategory(editing.id, { labelEs: formLabel.trim(), labelEn: editing.labelEn })
      } else {
        await adminService.updateCollection(editing.id, { labelEs: formLabel.trim(), labelEn: editing.labelEn })
      }
      invalidateTaxonomyCache()
      setEditing(null)
      pushToast('Nombre actualizado')
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    if (!creating || formLabel.trim().length < 2 || busy) return
    setBusy(true)
    try {
      if (creating === 'categories') await adminService.createCategory({ labelEs: formLabel.trim() })
      else await adminService.createCollection({ labelEs: formLabel.trim() })
      invalidateTaxonomyCache()
      setCreating(null)
      setFormLabel('')
      pushToast('Creado correctamente')
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo crear', 'error')
    } finally {
      setBusy(false)
    }
  }

  const move = async (kind: Tab, id: string, dir: -1 | 1) => {
    const rows = kind === 'categories' ? [...catRows] : [...colRows]
    const idx = rows.findIndex((r) => r.id === id)
    const target = rows[idx + dir]
    if (!target) return
    const ids = rows.map((r) => r.id)
    ids[idx] = target.id
    ids[idx + dir] = id
    setBusy(true)
    try {
      if (kind === 'categories') await adminService.reorderCategories(ids)
      else await adminService.reorderCollections(ids)
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo reordenar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      if (deleting.kind === 'categories') await adminService.deleteCategory(deleting.id)
      else await adminService.deleteCollection(deleting.id)
      invalidateTaxonomyCache()
      setDeleting(null)
      pushToast('Eliminado')
      await load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const catCount = (id: string) => catRows.find((c) => c.id === id)
  void catCount

  return (
    <div className="space-y-4">
      {/* ---------- pestañas ---------- */}
      <div className="flex flex-wrap items-center gap-2 border border-gold/15 bg-carbon/40 p-3">
        <button
          onClick={() => setTab('categories')}
          className={cn('flex items-center gap-2 border px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-widest transition-colors',
            tab === 'categories' ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold')}
        >
          <Tags size={14} /> Categorías ({catRows.length})
        </button>
        <button
          onClick={() => setTab('collections')}
          className={cn('flex items-center gap-2 border px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-widest transition-colors',
            tab === 'collections' ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold')}
        >
          <Layers size={14} /> Colecciones ({colRows.length})
        </button>
        <button
          onClick={() => { setCreating(tab); setFormLabel('') }}
          className="ms-auto flex items-center gap-2 bg-gold px-4 py-2.5 text-[0.62rem] font-bold uppercase tracking-widest text-night hover:bg-gold-soft"
        >
          <Plus size={14} /> {tab === 'categories' ? 'Nueva categoría' : 'Nueva colección'}
        </button>
      </div>

      <p className="border border-gold/15 bg-carbon/40 px-4 py-3 text-xs leading-relaxed text-bone">
        {tab === 'categories'
          ? 'Las categorías organizan el catálogo y alimentan los filtros de la tienda. No se pueden eliminar las que tienen productos asignados.'
          : 'Las colecciones agrupan productos por temporada o campaña (Nueva colección, Ofertas…). Aparecen en la tienda y el formulario de productos.'}
      </p>

      {/* ---------- tabla ---------- */}
      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>Nombre (español)</Th>
                <Th>Identificador</Th>
                <Th>Inglés</Th>
                {tab === 'collections' && <Th>Estado</Th>}
                <Th right>Orden y acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading && <EmptyRow colSpan={5} message="Cargando…" />}
              {!loading && tab === 'categories' && catRows.map((c, i) => (
                <tr key={c.id} className="hover:bg-carbon/60">
                  <Td className="text-ivory">{c.label_es}</Td>
                  <Td><span className="text-xs text-bone">{c.id}</span></Td>
                  <Td><span className="text-xs text-bone">{c.label_en}</span></Td>
                  <Td right>
                    <RowActions
                      upDisabled={i === 0}
                      downDisabled={i === catRows.length - 1}
                      onUp={() => move('categories', c.id, -1)}
                      onDown={() => move('categories', c.id, 1)}
                      onEdit={() => { setEditing({ kind: 'categories', id: c.id, labelEs: c.label_es, labelEn: c.label_en }); setFormLabel(c.label_es) }}
                      onDelete={() => setDeleting({ kind: 'categories', id: c.id, name: c.label_es })}
                    />
                  </Td>
                </tr>
              ))}
              {!loading && tab === 'collections' && colRows.map((c, i) => (
                <tr key={c.id} className="hover:bg-carbon/60">
                  <Td className="text-ivory">{c.label_es}</Td>
                  <Td><span className="text-xs text-bone">{c.id}</span></Td>
                  <Td><span className="text-xs text-bone">{c.label_en}</span></Td>
                  <Td>
                    <span className={cn('border px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-wider',
                      c.active ? 'border-emerald-400/40 text-emerald-300' : 'border-bone/30 text-bone')}>
                      {c.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </Td>
                  <Td right>
                    <RowActions
                      upDisabled={i === 0}
                      downDisabled={i === colRows.length - 1}
                      onUp={() => move('collections', c.id, -1)}
                      onDown={() => move('collections', c.id, 1)}
                      onEdit={() => { setEditing({ kind: 'collections', id: c.id, labelEs: c.label_es, labelEn: c.label_en }); setFormLabel(c.label_es) }}
                      onDelete={() => setDeleting({ kind: 'collections', id: c.id, name: c.label_es })}
                    />
                  </Td>
                </tr>
              ))}
              {!loading && tab === 'categories' && catRows.length === 0 && <EmptyRow colSpan={5} message="No hay categorías" />}
              {!loading && tab === 'collections' && colRows.length === 0 && <EmptyRow colSpan={5} message="No hay colecciones" />}
            </tbody>
          </table>
        </TableScroller>
      </div>

      {/* ---------- modal crear / editar ---------- */}
      <Modal
        open={!!creating || !!editing}
        onClose={() => { setCreating(null); setEditing(null) }}
        title={creating ? (creating === 'categories' ? 'Nueva categoría' : 'Nueva colección') : 'Editar nombre'}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Nombre en español *</span>
            <input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder={creating === 'collections' ? 'Ej. Temporada navideña' : 'Ej. Blusas'}
              className="w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
          </label>
          <p className="text-[0.62rem] leading-relaxed text-bone">
            El identificador se genera automáticamente a partir del nombre. Aparecerá de inmediato en el formulario de productos y los filtros de la tienda.
          </p>
          <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
            <button onClick={() => { setCreating(null); setEditing(null) }} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
              Cancelar
            </button>
            <button
              onClick={() => (creating ? create() : saveEdit())}
              disabled={busy || formLabel.trim().length < 2}
              className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50"
            >
              {busy && <Spinner className="border-night/30 border-t-night" />} {creating ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => !busy && setDeleting(null)} title="Confirmar eliminación" maxWidth="max-w-md">
        <div className="p-6">
          <p className="text-sm leading-relaxed text-bone">
            ¿Eliminar <span className="text-ivory">“{deleting?.name}”</span>? Si tiene productos asignados, el sistema impedirá la eliminación.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} disabled={busy} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
              Cancelar
            </button>
            <button onClick={confirmDelete} disabled={busy} className="flex items-center gap-2 bg-red-500/90 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500">
              {busy && <Spinner className="border-white/30 border-t-white" />} Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function RowActions({
  upDisabled, downDisabled, onUp, onDown, onEdit, onDelete,
}: {
  upDisabled: boolean
  downDisabled: boolean
  onUp: () => void
  onDown: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onUp} disabled={upDisabled} title="Subir" aria-label="Subir" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold disabled:opacity-30">
        <ArrowUp size={13} />
      </button>
      <button onClick={onDown} disabled={downDisabled} title="Bajar" aria-label="Bajar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold disabled:opacity-30">
        <ArrowDown size={13} />
      </button>
      <button onClick={onEdit} title="Editar" aria-label="Editar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold">
        <Pencil size={13} />
      </button>
      <button onClick={onDelete} title="Eliminar" aria-label="Eliminar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
        <Trash2 size={13} />
      </button>
    </div>
  )
}
