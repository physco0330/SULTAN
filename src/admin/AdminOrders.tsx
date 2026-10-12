import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Trash2, Plus, FileSpreadsheet, File as FileIcon, Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { useUi } from '@/store/ui'
import { useLiveReload } from '@/hooks/useLiveReload'
import { Modal } from '@/components/Modal'
import { OrderFormModal } from '@/admin/OrderFormModal'
import { PeriodPicker, periodLabel } from '@/admin/Calendar'
import type { PeriodValue } from '@/admin/Calendar'
import { usd, shortDate, StatusBadge, Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { exportCsv, exportXlsx, exportPdf } from '@/admin/exporters'
import { cn } from '@/utils/cn'
import type { AdminOrder, AdminOrderDetail, AdminOrderStatus } from '@/services/adminService'

const ORDER_STATUSES: AdminOrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
const PAGE_SIZE = 12

function orderToRow(o: AdminOrder): (string | number)[] {
  return [
    o.number,
    shortDate(o.created_at),
    o.customer_name,
    o.customer_email ?? '',
    o.quantity,
    o.subtotal_usd,
    o.shipping_usd,
    o.discount_usd,
    o.total_usd,
    o.status,
  ]
}

const EMPTY_PERIOD: PeriodValue = { mode: 'range', from: null, to: null }

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<AdminOrderStatus | ''>('')
  const [query, setQuery] = useState('')
  const [showDemo, setShowDemo] = useState<'exclude' | 'only' | 'all'>('exclude')
  const [period, setPeriod] = useState<PeriodValue>(EMPTY_PERIOD)
  const [advOpen, setAdvOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminOrder | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.orders()
      setOrders(res.items)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo cargar', 'error')
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])
  useLiveReload(() => { void load() })

  /* Filtros combinados sobre los datos reales ya cargados (sin recargar la página). */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (status && o.status !== status) return false
      if (showDemo === 'exclude' && o.is_demo === 1) return false
      if (showDemo === 'only' && o.is_demo !== 1) return false
      if (q) {
        const hay = `${o.number} ${o.customer_name} ${o.customer_email ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (period.from) {
        const created = new Date(o.created_at.replace(' ', 'T') + (o.created_at.length === 19 ? 'Z' : ''))
        if (Number.isNaN(created.getTime())) return true
        if (created < new Date(period.from)) return false
        if (period.to && created > new Date(period.to)) return false
      }
      return true
    })
  }, [orders, status, query, period, showDemo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  useEffect(() => { setPage(1) }, [status, query, period.from, period.to, showDemo])
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  const totals = useMemo(() => {
    const revenue = filtered.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_usd, 0)
    const units = filtered.reduce((s, o) => s + o.quantity, 0)
    return { revenue, units }
  }, [filtered])

  const filtersActive = !!status || !!query.trim() || !!period.from
  const clearFilters = () => {
    setStatus('')
    setQuery('')
    setPeriod(EMPTY_PERIOD)
  }

  const changeStatus = async (o: AdminOrder, next: string) => {
    if (o.status === next) return
    try {
      const res = await adminService.patchOrderStatus(o.id, next)
      setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: res.status } : x)))
      if (detail && detail.id === o.id) setDetail((d) => (d ? { ...d, status: res.status } : d))
      pushToast(`Pedido ${o.number} → ${STATUS_LABELS[res.status]}`)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await adminService.deleteOrder(deleting.id)
      invalidateCatalogCache()
      setOrders((list) => list.filter((x) => x.id !== deleting.id))
      if (detail && detail.id === deleting.id) setDetailOpen(false)
      pushToast(`Pedido ${deleting.number} eliminado (stock restaurado)`)
      setDeleting(null)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openDetail = async (o: AdminOrder) => {
    try {
      const res = await adminService.order(o.id)
      setDetail(res.order)
      setDetailOpen(true)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const exportData = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (filtered.length === 0) return pushToast('No hay datos para exportar', 'info')
    setExporting(true)
    const header = ['N°', 'Fecha', 'Cliente', 'Email', 'Artículos', 'Subtotal USD', 'Envío USD', 'Descuento USD', 'Total USD', 'Estado']
    const rows = filtered.map(orderToRow)
    const base = `pedidos-sultan-${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === 'xlsx') await exportXlsx(`${base}.xlsx`, 'Pedidos', header, rows)
      else if (format === 'csv') exportCsv(`${base}.csv`, header, rows)
      else await exportPdf(`${base}.pdf`, 'Pedidos — SULTAN BLACK', `${filtered.length} pedidos · ${new Date().toLocaleDateString('es-CO')}`, header, rows)
      pushToast(`Exportado a ${format.toUpperCase()}`)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------- barra de herramientas ---------- */}
      <div className="border border-gold/15 bg-carbon/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por Nº de pedido, cliente o correo…"
              className="w-full border border-gold/25 bg-night py-2.5 pl-9 pr-3 text-xs text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminOrderStatus | '')}
            className="border border-gold/25 bg-night px-3 py-2.5 text-xs text-ivory focus:border-gold focus:outline-none"
          >
            <option value="">Todos los estados</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <div className="w-[13.5rem]">
            <PeriodPicker value={period} onChange={setPeriod} />
          </div>
          <button
            onClick={() => setAdvOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 border px-3.5 py-2.5 text-[0.6rem] font-semibold uppercase tracking-widest transition-colors',
              advOpen ? 'border-gold bg-gold/10 text-gold' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
            )}
          >
            <SlidersHorizontal size={13} /> Avanzados
          </button>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 border border-gold/25 px-3 py-2.5 text-[0.6rem] font-semibold uppercase tracking-widest text-bone hover:text-gold"
            >
              <X size={12} /> Limpiar
            </button>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button onClick={() => exportData('xlsx')} disabled={exporting || filtered.length === 0} title="Exportar a Excel"
              className="flex items-center gap-2 border border-emerald-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40">
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button onClick={() => exportData('csv')} disabled={exporting || filtered.length === 0} title="Exportar CSV"
              className="flex items-center gap-2 border border-sky-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-sky-300 hover:bg-sky-400/10 disabled:opacity-40">
              <FileIcon size={13} /> CSV
            </button>
            <button onClick={() => exportData('pdf')} disabled={exporting || filtered.length === 0} title="Exportar a PDF"
              className="flex items-center gap-2 border border-red-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-red-300 hover:bg-red-400/10 disabled:opacity-40">
              {exporting ? <Spinner className="border-red-400/30 border-t-red-400" /> : <FileText size={13} />} PDF
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-gold px-4 py-2 text-[0.6rem] font-bold uppercase tracking-widest text-night hover:bg-gold-soft"
            >
              <Plus size={13} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* ---------- filtros avanzados ---------- */}
        {advOpen && (
          <div className="mt-3 grid gap-3 border-t border-gold/15 pt-3 sm:grid-cols-4">
            <div>
              <p className="mb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-bone">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setStatus('')} className={cn('border px-2.5 py-1.5 text-[0.58rem] uppercase tracking-wider', !status ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:text-gold')}>Todos</button>
                {ORDER_STATUSES.map((s) => (
                  <button key={s} onClick={() => setStatus(s)} className={cn('border px-2.5 py-1.5 text-[0.58rem] uppercase tracking-wider', status === s ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:text-gold')}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-bone">Contenido</p>
              <div className="flex flex-wrap gap-1.5">
                {([['exclude', 'Solo reales'], ['only', 'Solo demo'], ['all', 'Todos']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setShowDemo(v)}
                    className={cn('border px-2.5 py-1.5 text-[0.58rem] uppercase tracking-wider', showDemo === v ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:text-gold')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-bone">Período activo</p>
              <p className="border border-gold/15 bg-night px-3 py-2 text-xs text-ivory">{periodLabel(period)}</p>
            </div>
            <div>
              <p className="mb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-bone">Acciones</p>
              <button onClick={clearFilters} className="flex w-full items-center justify-center gap-2 border border-gold/25 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-bone hover:border-gold/60 hover:text-gold">
                <X size={12} /> Limpiar todos los filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- resumen ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-gold/15 bg-carbon/40 px-4 py-2.5 text-xs text-bone">
        <span>{filtered.length} pedidos · {totals.units} artículos</span>
        <span className="text-gold/80">Ingresos: {usd(totals.revenue)}</span>
      </div>

      {/* ---------- tabla ---------- */}
      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[1080px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>N°</Th>
                <Th>Fecha</Th>
                <Th>Cliente</Th>
                <Th>Artículos</Th>
                <Th>Subtotal</Th>
                <Th>Envío</Th>
                <Th>Desc.</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading && orders.length === 0 && <EmptyRow colSpan={10} message="Cargando…" />}
              {!loading && filtered.length === 0 && <EmptyRow colSpan={10} message="No hay pedidos que coincidan con los filtros" />}
              {pageItems.map((o) => (
                <tr key={o.id} className="hover:bg-carbon/60">
                  <Td className="text-gold">{o.number}</Td>
                  <Td><span className="text-bone">{shortDate(o.created_at)}</span></Td>
                  <Td>
                    <p className="text-ivory">{o.customer_name}</p>
                    <p className="text-xs text-bone">{o.customer_email}</p>
                  </Td>
                  <Td>{o.quantity} uds</Td>
                  <Td>{usd(o.subtotal_usd)}</Td>
                  <Td>{o.shipping_usd === 0 ? <span className="text-bone">Gratis</span> : usd(o.shipping_usd)}</Td>
                  <Td>{o.discount_usd > 0 ? <span className="text-gold">−{usd(o.discount_usd)}</span> : <span className="text-bone">—</span>}</Td>
                  <Td className="font-medium">{usd(o.total_usd)}</Td>
                  <Td>
                    <select
                      value={o.status}
                      onChange={(e) => changeStatus(o, e.target.value)}
                      className="border border-gold/25 bg-night px-2 py-1.5 text-xs text-ivory focus:border-gold focus:outline-none"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openDetail(o)} aria-label="Ver detalle" title="Ver detalle" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold">
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => setDeleting(o)}
                        aria-label="Eliminar pedido"
                        title="Eliminar pedido"
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

      {/* ---------- paginación ---------- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border border-gold/15 bg-carbon/40 px-4 py-2.5">
          <span className="text-xs text-bone">Página {safePage} de {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="flex h-8 w-8 items-center justify-center border border-gold/25 text-bone hover:text-gold disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .map((p, i, arr) => (
                <span key={p} className="flex items-center">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-bone">…</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={cn(
                      'h-8 min-w-8 border px-2 text-xs transition-colors',
                      p === safePage ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:text-gold',
                    )}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="flex h-8 w-8 items-center justify-center border border-gold/25 text-bone hover:text-gold disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? `Pedido ${detail.number}` : 'Detalle'} maxWidth="max-w-2xl">
        {detail && (
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 pb-4">
              <div>
                <p className="font-display text-lg text-ivory">{detail.customer_name}</p>
                <p className="text-sm text-bone">{detail.customer_email} · {detail.customer_phone ?? 'sin teléfono'}</p>
              </div>
              <StatusBadge value={detail.status} label={STATUS_LABELS[detail.status]} />
            </div>

            <div>
              <p className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Artículos</p>
              <ul className="space-y-2">
                {detail.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between border border-gold/10 px-4 py-2.5 text-sm">
                    <span className="text-ivory">
                      {it.name} <span className="text-xs text-bone">× {it.quantity}</span>
                      {it.size ? <span className="text-xs text-bone"> · {it.size}</span> : null}
                    </span>
                    <span className="text-silver">{usd(it.price_usd * it.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gold/15 pt-4 text-sm sm:grid-cols-4">
              <div><p className="text-[0.6rem] uppercase tracking-widest text-bone">Subtotal</p><p className="mt-1 text-ivory">{usd(detail.subtotal_usd)}</p></div>
              <div><p className="text-[0.6rem] uppercase tracking-widest text-bone">Envío</p><p className="mt-1 text-ivory">{detail.shipping_usd === 0 ? 'Gratis' : usd(detail.shipping_usd)}</p></div>
              <div><p className="text-[0.6rem] uppercase tracking-widest text-bone">Descuento</p><p className="mt-1 text-gold">{detail.discount_usd ? `−${usd(detail.discount_usd)}` : '—'}</p></div>
              <div><p className="text-[0.6rem] uppercase tracking-widest text-bone">Total</p><p className="mt-1 font-display text-lg text-gold">{usd(detail.total_usd)}</p></div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/15 pt-4">
              <p className="text-xs text-bone">
                {detail.ship_city || '—'}{detail.ship_country ? `, ${detail.ship_country}` : ''} · {shortDate(detail.created_at)}
                {detail.coupon_code ? <span className="ml-2 text-gold">Cupón: {detail.coupon_code}</span> : null}
              </p>
              <button onClick={() => window.print()} className="flex items-center gap-2 border border-gold/40 px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
                <FileText size={13} /> Imprimir
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => !deleteBusy && setDeleting(null)} title="Eliminar pedido" maxWidth="max-w-md">
        <div className="p-6">
          <p className="text-sm leading-relaxed text-bone">
            ¿Eliminar el pedido <span className="text-ivory">“{deleting?.number}”</span> de {deleting?.customer_name}?
            Se devolverá el stock de sus artículos y se registrará en auditoría.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} disabled={deleteBusy} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
              Cancelar
            </button>
            <button onClick={confirmDelete} disabled={deleteBusy} className="flex items-center gap-2 bg-red-500/90 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500">
              {deleteBusy && <Spinner className="border-white/30 border-t-white" />} Eliminar
            </button>
          </div>
        </div>
      </Modal>

      <OrderFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => setOrders((list) => [created, ...list])}
      />
    </div>
  )
}
