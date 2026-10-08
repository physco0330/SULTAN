import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { adminService } from '@/services/adminService'
import { invalidateCatalogCache } from '@/hooks/useCatalog'
import { useUi } from '@/store/ui'
import { Spinner } from '@/admin/ui'
import type { AdminProduct, AdminOrder, ShippingMethod } from '@/services/adminService'

const input =
  'w-full border border-gold/25 bg-night px-3 py-2 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

const SHIPPING_LABELS: { key: ShippingMethod; label: string }[] = [
  { key: 'standard', label: 'Estándar' },
  { key: 'express', label: 'Exprés' },
  { key: 'free', label: 'Sin coste' },
]

interface Line {
  productId: string
  quantity: number
  size: string
  color: string
}

export function OrderFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (order: AdminOrder) => void
}) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1, size: 'M', color: 'Black' }])
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', city: '', country: '', address: '', zip: '' })
  const [shipping, setShipping] = useState<ShippingMethod>('standard')
  const [promo, setPromo] = useState('')
  const [saving, setSaving] = useState(false)
  const pushToast = useUi((s) => s.pushToast)

  useEffect(() => {
    if (!open) return
    adminService
      .products()
      .then((r) => setProducts(r.items))
      .catch((e) => pushToast(e instanceof Error ? e.message : 'No se pudo cargar el catálogo', 'error'))
  }, [open, pushToast])

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const addLine = () => setLines((ls) => [...ls, { productId: '', quantity: 1, size: 'M', color: 'Black' }])
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))

  const save = async () => {
    const valid = lines.filter((l) => l.productId && l.quantity > 0)
    if (valid.length === 0) return pushToast('Agrega al menos un artículo válido', 'error')
    if (!customer.name.trim()) return pushToast('El nombre del cliente es obligatorio', 'error')
    const totals = valid.reduce((s, l) => {
      const p = products.find((x) => x.id === l.productId)
      return s + (p ? p.price * l.quantity : 0)
    }, 0)
    const confirmed = window.confirm(
      `Crear el pedido de ${customer.name} por ≈ $${totals} USD?\nSe validará el stock y se restará de inventario.`,
    )
    if (!confirmed) return
    setSaving(true)
    try {
      const res = await adminService.createOrder({
        items: valid.map((l) => ({ id: l.productId, quantity: l.quantity, size: l.size || 'M', color: l.color || 'Black' })),
        customer,
        shipping,
        promoCode: promo.trim() || undefined,
      })
      pushToast(`Pedido ${res.order.number} creado ($${res.order.total_usd})`)
      invalidateCatalogCache()
      onCreated(res.order)
      onClose()
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'No se pudo crear el pedido', 'error')
    } finally {
      setSaving(false)
    }
  }

  const byId = (id: string) => products.find((p) => p.id === id)

  return (
    <Modal open={open} onClose={onClose} title="Nuevo pedido" maxWidth="max-w-3xl">
      <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6">
        <div>
          <p className="mb-3 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Cliente</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Nombre *" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
            <input className={input} placeholder="Email" type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
            <input className={input} placeholder="Teléfono" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
            <input className={input} placeholder="Ciudad" value={customer.city} onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} />
            <input className={input} placeholder="País" value={customer.country} onChange={(e) => setCustomer((c) => ({ ...c, country: e.target.value }))} />
            <input className={input} placeholder="Código postal" value={customer.zip} onChange={(e) => setCustomer((c) => ({ ...c, zip: e.target.value }))} />
            <input className={`${input} sm:col-span-2`} placeholder="Dirección" value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Artículos</p>
            <button onClick={addLine} className="flex items-center gap-1.5 border border-gold/40 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-widest text-gold hover:bg-gold hover:text-night">
              <Plus size={12} /> Agregar línea
            </button>
          </div>
          <div className="space-y-3">
            {lines.map((l, i) => {
              const p = byId(l.productId)
              return (
                <div key={i} className="flex flex-wrap items-end gap-2 border border-gold/10 p-3">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Producto</label>
                    <select
                      className={input}
                      value={l.productId}
                      onChange={(e) => setLine(i, { productId: e.target.value })}
                    >
                      <option value="">— Seleccionar producto —</option>
                      {products.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.stock === 0}>
                          {x.name} · {x.sku} (${x.price} · stock {x.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Cant.</label>
                    <input type="number" min={1} className={input} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Talla</label>
                    <input className={input} value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} />
                  </div>
                  <div className="w-32">
                    <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Color</label>
                    <input className={input} value={l.color} onChange={(e) => setLine(i, { color: e.target.value })} />
                  </div>
                  <div className="pb-2 text-sm text-bone">≈ {p ? `$${p.price * l.quantity}` : '—'}</div>
                  <button onClick={() => removeLine(i)} aria-label="Quitar línea" className="mb-2 flex h-8 w-8 items-center justify-center border border-gold/20 text-bone hover:border-red-400/40 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Envío</label>
            <select className={input} value={shipping} onChange={(e) => setShipping(e.target.value as ShippingMethod)}>
              {SHIPPING_LABELS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[0.58rem] uppercase tracking-widest text-bone">Cupón (opcional)</label>
            <input className={input} value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="SULTAN10" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gold/15 pt-4">
          <button onClick={onClose} className="border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-gold hover:bg-gold/10">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-gold px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-night hover:bg-gold-soft disabled:opacity-50"
          >
            {saving && <Spinner className="border-night/30 border-t-night" />} Crear pedido
          </button>
        </div>
      </div>
    </Modal>
  )
}