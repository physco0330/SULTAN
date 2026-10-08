import { useCallback, useEffect, useState } from 'react'
import { Eye, FileText, Trash2, Plus, FileSpreadsheet, File as FileIcon } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { useUi } from '@/store/ui'
import { Modal } from '@/components/Modal'
import { PeriodSelector } from '@/admin/PeriodSelector'
import { OrderFormModal } from '@/admin/OrderFormModal'
import { usd, shortDate, StatusBadge, Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { exportCsv, exportXlsx, exportPdf } from '@/admin/exporters'
import { cn } from '@/utils/cn'
import type { AdminOrder, AdminOrderDetail, AdminOrderStatus, PeriodKey } from '@/services/adminService'

const ORDER_STATUSES: AdminOrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

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

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AdminOrderStatus | ''>('')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<AdminOrder | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(
    async (status: AdminOrderStatus | '' , per: PeriodKey) => {
      setLoading(true)
      try {
        const res = await adminService.orders(status || undefined, per)
        setOrders(res.items)
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'No se pudo cargar', 'error')
      } finally {
        setLoading(false)
      }
    },
    [pushToast],
  )

  useEffect(() => {
    load(filter, period)
  }, [filter, period, load])

  const changeStatus = async (o: AdminOrder, status: string) => {
    if (o.status === status) return
    try {
      const res = await adminService.patchOrderStatus(o.id, status)
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
    if (orders.length === 0) return pushToast('No hay datos para exportar', 'info')
    setExporting(true)
    const header = ['N°', 'Fecha', 'Cliente', 'Email', 'Artículos', 'Subtotal USD', 'Envío USD', 'Descuento USD', 'Total USD', 'Estado']
    const rows = orders.map(orderToRow)
    const base = `pedidos-sultan-${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === 'xlsx') await exportXlsx(`${base}.xlsx`, 'Pedidos', header, rows)
      else if (format === 'csv') exportCsv(`${base}.csv`, header, rows)
      else await exportPdf(`${base}.pdf`, 'Pedidos — SULTAN BLACK', `${orders.length} pedidos · ${new Date().toLocaleDateString('es-CO')}`, header, rows)
      pushToast(`Exportado a ${format.toUpperCase()}`)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <div className="flex flex-wrap gap-1.5">
            {(['', ...ORDER_STATUSES] as (AdminOrderStatus | '')[]).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setFilter(s)}
                className={cn(
                  'border px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.18em] transition-colors',
                  filter === s ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
                )}
              >
                {s ? STATUS_LABELS[s] : 'Todos'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportData('xlsx')}
            disabled={exporting || orders.length === 0}
            title="Exportar a Excel"
            className="flex items-center gap-2 border border-emerald-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            onClick={() => exportData('csv')}
            disabled={exporting || orders.length === 0}
            title="Exportar CSV"
            className="flex items-center gap-2 border border-sky-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-sky-300 hover:bg-sky-400/10 disabled:opacity-40"
          >
            <FileIcon size={13} /> CSV
          </button>
          <button
            onClick={() => exportData('pdf')}
            disabled={exporting || orders.length === 0}
            title="Exportar a PDF"
            className="flex items-center gap-2 border border-red-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-red-300 hover:bg-red-400/10 disabled:opacity-40"
          >
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

      <div className="flex items-center justify-between border border-gold/15 bg-carbon/40 px-4 py-2.5 text-xs text-bone">
        <span>{orders.length} pedidos</span>
        <span className="text-gold/80">{period === 'all' ? 'Todo el historial' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Mes actual' : 'Año actual'}</span>
      </div>

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
                <Th>Desc.</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading && orders.length === 0 && <EmptyRow colSpan={9} message="Cargando…" />}
              {!loading && orders.length === 0 && <EmptyRow colSpan={9} message="No hay pedidos que coincidan" />}
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-carbon/60">
                  <Td className="text-gold">{o.number}</Td>
                  <Td><span className="text-bone">{shortDate(o.created_at)}</span></Td>
                  <Td>
                    <p className="text-ivory">{o.customer_name}</p>
                    <p className="text-xs text-bone">{o.customer_email}</p>
                  </Td>
                  <Td>{o.quantity} uds</Td>
                  <Td>{usd(o.subtotal_usd)}</Td>
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