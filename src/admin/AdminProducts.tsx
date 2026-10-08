import { useCallback, useEffect, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Eye, EyeOff, Star } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { useUi } from '@/store/ui'
import { ProductFormModal } from '@/admin/ProductFormModal'
import { Modal } from '@/components/Modal'
import { usd, StatusBadge, Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { AdminProduct } from '@/services/adminService'

export function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminProduct | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await adminService.products(q)
      setProducts(res.items)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cargar', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const id = setTimeout(() => load(query.trim() || undefined), 350)
    return () => clearTimeout(id)
  }, [query, load])

  const toggleActive = async (p: AdminProduct) => {
    try {
      const res = await adminService.patchProduct(p.id, { active: !p.active })
      invalidateCatalogCache()
      setProducts((list) => list.map((x) => (x.id === p.id ? res.product : x)))
      pushToast(res.product.active ? 'Producto activado' : 'Producto desactivado', 'info')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const toggleFeatured = async (p: AdminProduct) => {
    try {
      const res = await adminService.patchProduct(p.id, { featured: !p.featured })
      invalidateCatalogCache()
      setProducts((list) => list.map((x) => (x.id === p.id ? res.product : x)))
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminService.deleteProduct(deleting.id)
      invalidateCatalogCache()
      setProducts((list) => list.filter((x) => x.id !== deleting.id))
      pushToast('Producto eliminado')
      setDeleting(null)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const onSaved = (p: AdminProduct) => {
    setProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o SKU…"
              className="w-full border border-gold/25 bg-night py-2.5 pl-9 pr-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
          </div>
          <span className="text-xs text-bone">{products.length} productos</span>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 bg-gold px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-night hover:bg-gold-soft"
        >
          <Plus size={14} /> Nuevo producto
        </button>
      </div>

      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>Producto</Th>
                <Th>Precio</Th>
                <Th>Oferta</Th>
                <Th>Stock</Th>
                <Th>Colección</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading && products.length === 0 && <EmptyRow colSpan={7} message="Cargando…" />}
              {!loading && products.length === 0 && <EmptyRow colSpan={7} message="No hay productos que coincidan con la búsqueda" />}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-carbon/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <img src={p.images[0]?.src} alt="" className="h-14 w-11 shrink-0 border border-gold/15 object-cover" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ivory">{p.name}</p>
                        <p className="text-xs text-bone">{p.sku}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{usd(p.price)}</Td>
                  <Td>{p.compareAtPrice ? <span className="text-gold">{usd(p.compareAtPrice)}</span> : <span className="text-bone">—</span>}</Td>
                  <Td>
                    <span className={cn('font-medium', p.stock === 0 ? 'text-red-400' : p.stock <= 8 ? 'text-gold' : 'text-ivory')}>
                      {p.stock}
                    </span>
                  </Td>
                  <Td className="text-bone">{p.collection}</Td>
                  <Td>
                    <StatusBadge value={p.active ? 'active' : 'inactive'} label={p.active ? 'Activo' : 'Inactivo'} />
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(p)}
                        aria-label="Destacado"
                        title="Destacado"
                        className={cn('flex h-8 w-8 items-center justify-center border border-gold/20 transition-colors', p.featured ? 'bg-gold/10 text-gold' : 'text-bone hover:text-gold')}
                      >
                        <Star size={13} className={cn(p.featured && 'fill-gold')} />
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        aria-label={p.active ? 'Desactivar' : 'Activar'}
                        title={p.active ? 'Desactivar' : 'Activar'}
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone transition-colors hover:text-gold"
                      >
                        {p.active ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(p)
                          setFormOpen(true)
                        }}
                        aria-label="Editar"
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone transition-colors hover:text-gold"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleting(p)}
                        aria-label="Eliminar"
                        title="Eliminar"
                        className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone transition-colors hover:border-red-400/40 hover:text-red-400"
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

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={editing} onSaved={onSaved} />

      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Confirmar eliminación" maxWidth="max-w-md">
        <div className="p-6">
          <p className="text-sm leading-relaxed text-bone">
            ¿Estás seguro de eliminar <span className="text-ivory">“{deleting?.name}”</span>? Esta acción no se puede deshacer.
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