import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { invalidateConfigCache } from '@/hooks/useStoreConfig'
import { useUi } from '@/store/ui'
import { usd, shortDate, StatusBadge, Spinner, EmptyRow, Th, Td, TableScroller } from '@/admin/ui'
import { cn } from '@/utils/cn'
import type { CouponRow, SubscriberRow, ContactRow, CustomerRow, AuditRow } from '@/services/adminService'

export type AdminSettingsSection = 'Empresa' | 'Cupones' | 'Suscriptores' | 'Contactos' | 'Clientes' | 'Auditoría'
const TABS: AdminSettingsSection[] = ['Empresa', 'Cupones', 'Suscriptores', 'Contactos', 'Clientes', 'Auditoría']

const input = 'w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

export function AdminSettings({
  section = 'Empresa',
  onSectionChange,
}: {
  section?: AdminSettingsSection
  onSectionChange?: (t: AdminSettingsSection) => void
}) {
  const setTab = (t: AdminSettingsSection) => (onSectionChange ? onSectionChange(t) : undefined)
  const tab = section
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 lg:hidden">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'border px-3.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] transition-colors',
              tab === t ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Empresa' && <SettingsForm />}
      {tab === 'Cupones' && <CouponsPanel />}
      {tab === 'Suscriptores' && <SubscribersPanel />}
      {tab === 'Contactos' && <ContactsPanel />}
      {tab === 'Clientes' && <CustomersPanel />}
      {tab === 'Auditoría' && <AuditPanel />}
    </div>
  )
}

function SettingsForm() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(() => {
    setBusy(true)
    adminService
      .settings()
      .then((r) => setForm(r.settings))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await adminService.saveSettings(form)
      invalidateConfigCache()
      pushToast('Configuración guardada')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const FIELDS: { key: string; label: string; type?: string }[] = [
    { key: 'company_name', label: 'Nombre de empresa' },
    { key: 'company_tagline', label: 'Eslogan' },
    { key: 'company_email', label: 'Email de contacto', type: 'email' },
    { key: 'company_phone', label: 'Teléfono' },
    { key: 'company_whatsapp', label: 'WhatsApp' },
    { key: 'company_address', label: 'Dirección' },
    { key: 'default_currency', label: 'Moneda por defecto' },
    { key: 'free_shipping_threshold', label: 'Umbral envío gratis (USD)' },
    { key: 'flat_shipping', label: 'Tarifa envío estándar (USD)' },
    { key: 'express_shipping', label: 'Tarifa envío exprés (USD)' },
    { key: 'instagram_url', label: 'Instagram URL' },
  ]

  if (busy) {
    return (
      <div className="flex items-center gap-3 py-16 text-bone">
        <Spinner /> Cargando configuración…
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="border border-gold/15 bg-carbon/40 p-6">
        <h3 className="font-display mb-5 text-sm tracking-[0.2em] text-ivory">INFORMACIÓN DE LA EMPRESA</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === 'company_tagline' || f.key === 'company_address' ? 'sm:col-span-2' : ''}>
              <label className="mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                className={input}
              />
            </div>
          ))}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-6 flex items-center justify-center bg-gold px-8 py-3 text-xs font-bold uppercase tracking-[0.24em] text-night hover:bg-gold-soft disabled:opacity-50"
        >
          {saving && <Spinner className="mr-2 border-night/30 border-t-night" />} Guardar configuración
        </button>
      </div>

      <div className="space-y-6">
        <div className="border border-gold/15 bg-carbon/40 p-6">
          <h3 className="font-display mb-3 text-sm tracking-[0.2em] text-ivory">VISIBILIDAD</h3>
          <p className="text-sm font-light leading-relaxed text-bone">
            El catálogo, el envío gratis y las tarifas de envío del storefront salen de esta configuración.
            Los datos de los formularios de contacto y newsletter se guardan en la base de datos y son administrables aquí.
          </p>
        </div>
        <div className="border border-gold/15 bg-carbon/40 p-6">
          <h3 className="font-display mb-3 text-sm tracking-[0.2em] text-ivory">SEGURIDAD</h3>
          <p className="text-sm font-light leading-relaxed text-bone">
            Los precios, descuentos y totales de los pedidos se recalculan y validan en el servidor; nunca se confía en los
            valores enviados por el cliente. Todo cambio queda registrado en el registro de auditoría.
          </p>
        </div>
      </div>
    </div>
  )
}

function CouponsPanel() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [form, setForm] = useState({ code: '', percent: '', minSubtotal: '' })
  const [busy, setBusy] = useState(true)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(() => {
    setBusy(true)
    adminService
      .settings()
      .then((r) => setCoupons(r.coupons))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!form.code.trim() || !form.percent) return
    try {
      await adminService.createCoupon({
        code: form.code.trim().toUpperCase(),
        percent: Number(form.percent),
        minSubtotal: Number(form.minSubtotal || 0),
        active: true,
      })
      setForm({ code: '', percent: '', minSubtotal: '' })
      pushToast('Cupón creado')
      load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo crear', 'error')
    }
  }

  const toggle = async (c: CouponRow) => {
    try {
      await adminService.patchCoupon(c.code, { active: c.active === 1 || c.active === true ? false : true })
      load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  const remove = async (c: CouponRow) => {
    try {
      await adminService.deleteCoupon(c.code)
      pushToast(`Cupón ${c.code} eliminado`)
      load()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="border border-gold/15 bg-carbon/40 p-6">
        <h3 className="font-display mb-4 text-sm tracking-[0.2em] text-ivory">NUEVO CUPÓN</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Código</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SULTAN10" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">%</label>
              <input value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))} placeholder="10" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone">Mín (USD)</label>
              <input value={form.minSubtotal} onChange={(e) => setForm((f) => ({ ...f, minSubtotal: e.target.value }))} placeholder="0" className={input} />
            </div>
          </div>
          <button onClick={add} className="flex w-full items-center justify-center gap-2 bg-gold py-3 text-xs font-bold uppercase tracking-[0.22em] text-night hover:bg-gold-soft">
            <Plus size={14} /> Crear cupón
          </button>
        </div>
      </div>

      <div className="overflow-hidden border border-gold/15 bg-carbon/40">
        <TableScroller>
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-gold/15">
              <tr>
                <Th>Código</Th>
                <Th>%</Th>
                <Th>Mínimo</Th>
                <Th>Estado</Th>
                <Th right>Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {busy && coupons.length === 0 && <EmptyRow colSpan={5} message="Cargando…" />}
              {!busy && coupons.length === 0 && <EmptyRow colSpan={5} message="Sin cupones" />}
              {coupons.map((c) => (
                <tr key={c.code} className="hover:bg-carbon/60">
                  <Td className="font-medium text-gold">{c.code}</Td>
                  <Td>{c.percent}%</Td>
                  <Td className="text-bone">{c.min_subtotal ? usd(c.min_subtotal) : '—'}</Td>
                  <Td><StatusBadge value={c.active === 1 || c.active === true ? 'active' : 'inactive'} label={(c.active === 1 || c.active === true) ? 'Activo' : 'Inactivo'} /></Td>
                  <Td right>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => toggle(c)} aria-label="Estado" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:text-gold">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => remove(c)} aria-label="Eliminar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
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
    </div>
  )
}

function SubscribersPanel() {
  const [items, setItems] = useState<SubscriberRow[]>([])
  const [busy, setBusy] = useState(true)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(() => {
    setBusy(true)
    adminService
      .subscribers()
      .then((r) => setItems(r.items))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: number) => {
    try {
      await adminService.deleteSubscriber(id)
      setItems((list) => list.filter((x) => x.id !== id))
      pushToast('Suscriptor eliminado')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div className="overflow-hidden border border-gold/15 bg-carbon/40">
      <TableScroller>
        <table className="w-full min-w-[520px]">
          <thead className="border-b border-gold/15">
            <tr><Th>Email</Th><Th>Fecha</Th><Th right>Acciones</Th></tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {busy && items.length === 0 && <EmptyRow colSpan={3} message="Cargando…" />}
            {!busy && items.length === 0 && <EmptyRow colSpan={3} message="Sin suscriptores" />}
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-carbon/60">
                <Td className="text-ivory">{s.email}</Td>
                <Td><span className="text-bone">{shortDate(s.created_at)}</span></Td>
                <Td right>
                  <button onClick={() => remove(s.id)} aria-label="Eliminar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  )
}

function ContactsPanel() {
  const [items, setItems] = useState<ContactRow[]>([])
  const [busy, setBusy] = useState(true)
  const pushToast = useUi((s) => s.pushToast)

  const load = useCallback(() => {
    setBusy(true)
    adminService
      .contacts()
      .then((r) => setItems(r.items))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: number) => {
    try {
      await adminService.deleteContact(id)
      setItems((list) => list.filter((x) => x.id !== id))
      pushToast('Mensaje eliminado')
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div className="overflow-hidden border border-gold/15 bg-carbon/40">
      <TableScroller>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-gold/15">
            <tr><Th>De</Th><Th>Asunto</Th><Th>Mensaje</Th><Th>Fecha</Th><Th right>Acciones</Th></tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {busy && items.length === 0 && <EmptyRow colSpan={5} message="Cargando…" />}
            {!busy && items.length === 0 && <EmptyRow colSpan={5} message="Sin mensajes" />}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-carbon/60">
                <Td>
                  <p className="text-ivory">{c.name}</p>
                  <p className="text-xs text-bone">{c.email}</p>
                </Td>
                <Td className="text-bone">{c.subject ?? '—'}</Td>
                <Td><span className="line-clamp-2 max-w-[260px] text-bone">{c.message}</span></Td>
                <Td><span className="text-bone">{shortDate(c.created_at)}</span></Td>
                <Td right>
                  <button onClick={() => remove(c.id)} aria-label="Eliminar" className="flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  )
}

function CustomersPanel() {
  const [items, setItems] = useState<CustomerRow[]>([])
  const [busy, setBusy] = useState(true)
  const pushToast = useUi((s) => s.pushToast)

  useEffect(() => {
    setBusy(true)
    adminService
      .customers()
      .then((r) => setItems(r.items))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  return (
    <div className="overflow-hidden border border-gold/15 bg-carbon/40">
      <TableScroller>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-gold/15">
            <tr><Th>Cliente</Th><Th>Ciudad</Th><Th>Pedidos</Th><Th right>Total gastado</Th></tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {busy && items.length === 0 && <EmptyRow colSpan={4} message="Cargando…" />}
            {!busy && items.length === 0 && <EmptyRow colSpan={4} message="Sin clientes" />}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-carbon/60">
                <Td>
                  <p className="text-ivory">{c.name}</p>
                  <p className="text-xs text-bone">{c.email ?? '—'}</p>
                </Td>
                <Td className="text-bone">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</Td>
                <Td>{c.order_count}</Td>
                <Td right className="font-medium">{usd(c.total_spent)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  )
}

function AuditPanel() {
  const [items, setItems] = useState<AuditRow[]>([])
  const [busy, setBusy] = useState(true)
  const pushToast = useUi((s) => s.pushToast)

  useEffect(() => {
    setBusy(true)
    adminService
      .audit()
      .then((r) => setItems(r.items))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'Error', 'error'))
      .finally(() => setBusy(false))
  }, [pushToast])

  return (
    <div className="overflow-hidden border border-gold/15 bg-carbon/40">
      <TableScroller>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-gold/15">
            <tr><Th>Fecha</Th><Th>Usuario</Th><Th>Acción</Th><Th>Entidad</Th><Th>Detalle</Th></tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {busy && items.length === 0 && <EmptyRow colSpan={5} message="Cargando…" />}
            {!busy && items.length === 0 && <EmptyRow colSpan={5} message="Sin actividad registrada" />}
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-carbon/60">
                <Td><span className="text-bone">{shortDate(a.created_at)}</span></Td>
                <Td className="text-ivory">{a.username}</Td>
                <Td><span className="text-gold">{a.action}</span></Td>
                <Td className="text-bone">{a.entity}</Td>
                <Td><span className="max-w-[320px] whitespace-normal text-bone">{a.detail || '—'}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroller>
    </div>
  )
}