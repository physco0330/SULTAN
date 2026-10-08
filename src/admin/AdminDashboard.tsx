import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, ShoppingBag, Package, AlertTriangle, Star, Users, Mail, Truck, FileSpreadsheet, File as FileIcon, FileText, RefreshCw, Receipt } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { useUi } from '@/store/ui'
import { PeriodSelector } from '@/admin/PeriodSelector'
import { Section, StatCard, StatusBadge, shortDate, usd, Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { exportCsv, exportXlsx, exportPdf } from '@/admin/exporters'
import type { AdminStats, PeriodKey } from '@/services/adminService'

export function AdminDashboard({ onNavigate }: { onNavigate?: (s: 'orders' | 'products') => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [busy, setBusy] = useState(true)
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [exporting, setExporting] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(
    (p: PeriodKey) => {
      setBusy(true)
      return adminService
        .stats(p)
        .then(setStats)
        .catch((e) => pushToast(e instanceof Error ? e.message : 'Error al cargar', 'error'))
        .finally(() => setBusy(false))
    },
    [pushToast],
  )

  useEffect(() => {
    let dead = false
    adminService
      .stats(period)
      .then((s) => {
        if (!dead) setStats(s)
      })
      .catch(() => {
        /* toast */
      })
      .finally(() => {
        if (!dead) setBusy(false)
      })
    return () => {
      dead = true
    }
  }, [period])

  if (busy && !stats) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-bone">
        <Spinner /> Cargando datos…
      </div>
    )
  }
  if (!stats) return null

  const monthlyRevenue = stats.revenueByMonth
  const maxRev = Math.max(...monthlyRevenue.map((m) => m.revenue), 1)
  const ticket = stats.revenue.orders > 0 ? Math.round(stats.revenue.total / stats.revenue.orders) : 0

  const exportStats = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setExporting(true)
    const header = ['Métrica', 'Valor']
    const rows: (string | number)[][] = [
      ['Periodo', stats.period.label],
      ['Ingresos (USD)', stats.revenue.total],
      ['Pedidos', stats.revenue.orders],
      ['Ticket promedio (USD)', ticket],
      ['Productos activos', stats.products.total],
      ['Stock bajo', stats.products.lowStock],
      ['Agotados', stats.products.outOfStock],
      ['Suscriptores', stats.social.subscribers],
      ['Contactos', stats.social.contacts],
    ]
    for (const m of stats.revenueByMonth) rows.push([`Ingresos ${m.label} (USD)`, m.revenue])
    const base = `resumen-sultan-${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === 'xlsx') await exportXlsx(`${base}.xlsx`, 'Resumen', header, rows)
      else if (format === 'csv') exportCsv(`${base}.csv`, header, rows)
      else await exportPdf(`${base}.pdf`, 'Resumen de ventas — SULTAN BLACK', `${stats.period.label} · ${new Date().toLocaleDateString('es-CO')}`, header, rows)
      pushToast(`Exportado a ${format.toUpperCase()}`)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => exportStats('xlsx')} disabled={exporting} title="Exportar a Excel" className="flex items-center gap-2 border border-emerald-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => exportStats('csv')} disabled={exporting} title="Exportar CSV" className="flex items-center gap-2 border border-sky-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-sky-300 hover:bg-sky-400/10 disabled:opacity-40">
            <FileIcon size={13} /> CSV
          </button>
          <button onClick={() => exportStats('pdf')} disabled={exporting} title="Exportar a PDF" className="flex items-center gap-2 border border-red-400/40 px-3.5 py-2 text-[0.6rem] font-semibold uppercase tracking-widest text-red-300 hover:bg-red-400/10 disabled:opacity-40">
            {exporting ? <Spinner className="border-red-400/30 border-t-red-400" /> : <FileText size={13} />} PDF
          </button>
          <span className="mx-2 hidden h-6 w-px bg-gold/15 sm:block" />
          <p className="text-lg text-bone">{stats.period.label}</p>
          <button
            onClick={() => load(period)}
            title="Actualizar"
            className="ml-1 flex h-9 w-9 items-center justify-center border border-gold/40 text-gold hover:bg-gold hover:text-night"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos" value={usd(stats.revenue.total)} icon={DollarSign} delta={stats.revenue.delta} hint="vs periodo anterior" />
        <StatCard label="Pedidos" value={stats.revenue.orders} icon={ShoppingBag} delta={stats.ordersDelta} hint="vs periodo anterior" />
        <StatCard label="Ticket promedio" value={usd(ticket)} icon={Receipt} />
        <StatCard label="Productos activos" value={stats.products.total} icon={Package} />
        <StatCard label="Stock bajo" value={stats.products.lowStock} icon={AlertTriangle} />
        <StatCard label="Agotados" value={stats.products.outOfStock} icon={Truck} />
        <StatCard label="Suscriptores" value={stats.social.subscribers} icon={Users} />
        <StatCard label="Mensajes contacto" value={stats.social.contacts} icon={Mail} />
      </div>

      <Section title={`INGRESOS — ${stats.period.label.toUpperCase()}`} action={<Star size={14} className="text-gold/40" />}>
        <div className="flex h-52 items-end gap-3 px-5 py-5">
          {monthlyRevenue.map((m) => (
            <div key={m.month} className="group flex flex-1 flex-col items-center gap-2">
              <span className="text-[0.62rem] text-gold opacity-0 transition-opacity group-hover:opacity-100">
                {m.revenue > 0 ? usd(m.revenue) : '$0'}
              </span>
              <div
                className="w-full border border-gold/25 bg-gradient-to-t from-gold/30 to-gold/10 transition-all group-hover:border-gold/60"
                style={{ height: `${Math.max((m.revenue / maxRev) * 100, 4)}%` }}
              />
              <span className="text-[0.6rem] uppercase tracking-wider text-bone">{m.label}</span>
              <span className="text-[0.6rem] text-bone">{m.orders} pedidos</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="PEDIDOS RECIENTES"
          action={
            onNavigate && (
              <button onClick={() => onNavigate('orders')} className="text-xs text-gold underline underline-offset-4">
                Ver pedidos
              </button>
            )
          }
        >
          <TableScroller>
            <table className="w-full min-w-[540px]">
              <thead className="border-b border-gold/15">
                <tr>
                  <Th>N°</Th>
                  <Th>Cliente</Th>
                  <Th>Total</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {stats.recentOrders.map((o) => (
                  <tr key={String(o.id)} className="hover:bg-carbon/60">
                    <Td className="text-gold">{String(o.number)}</Td>
                    <Td>{String(o.customer_name)}</Td>
                    <Td>{usd(Number(o.total_usd))}</Td>
                    <Td><span className="text-bone">{shortDate(String(o.created_at))}</span></Td>
                    <Td><StatusBadge value={String(o.status)} /></Td>
                  </tr>
                ))}
                {stats.recentOrders.length === 0 && <EmptyRow colSpan={5} message="Sin pedidos en este periodo" />}
              </tbody>
            </table>
          </TableScroller>
        </Section>

        <div className="space-y-6">
          <Section title="MÁS VENDIDOS">
            <ul className="divide-y divide-gold/10">
              {stats.topSelling.map((s, i) => (
                <li key={s.productId ?? s.name} className="flex items-center gap-4 px-5 py-3">
                  <span className="font-display text-lg text-gold/70">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ivory">{s.name}</p>
                    <p className="text-xs text-bone">{s.qty} unidades vendidas</p>
                  </div>
                  <span className="text-sm font-medium text-ivory">{usd(s.revenue)}</span>
                </li>
              ))}
              {stats.topSelling.length === 0 && <li className="px-5 py-10 text-center text-sm text-bone">Sin ventas todavía</li>}
            </ul>
          </Section>

          <Section title="STOCK BAJO">
            <ul className="divide-y divide-gold/10">
              {stats.lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                  <img src={p.images[0]?.src} alt="" className="h-12 w-9 border border-gold/15 object-cover" />
                  <Link to={`/producto/${p.slug}`} className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-gold">
                    {p.name}
                  </Link>
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: p.stock <= 3 ? '#f87171' : '#C9A227' }}>
                    {p.stock} uds
                  </span>
                </li>
              ))}
              {stats.lowStockProducts.length === 0 && <li className="px-5 py-10 text-center text-sm text-bone">Todo en stock sano</li>}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}