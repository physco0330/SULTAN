import { useEffect, useState } from 'react'
import { LayoutDashboard, Package, ShoppingBag, LogOut, Wifi, ServerOff, Mail, Users, ClipboardList, Banknote, ShieldCheck, PencilRuler, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAdminToken, setAdminToken } from '@/services/api'
import { adminService } from '@/services/adminService'
import { AdminLogin } from '@/admin/AdminLogin'
import { AdminDashboard } from '@/admin/AdminDashboard'
import { AdminProducts } from '@/admin/AdminProducts'
import { AdminOrders } from '@/admin/AdminOrders'
import { AdminSettings, type AdminSettingsSection } from '@/admin/AdminSettings'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'
import type { AdminUser } from '@/services/adminService'

type Section = 'dashboard' | 'products' | 'orders' | AdminSettingsSection

const NAV: { key: Section; label: string; icon: typeof LayoutDashboard; group: 'general' | 'ventas' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'general' },
  { key: 'products', label: 'Productos', icon: Package, group: 'ventas' },
  { key: 'orders', label: 'Pedidos', icon: ShoppingBag, group: 'ventas' },
]

const CONFIG_NAV: { key: AdminSettingsSection; label: string; icon: typeof PencilRuler }[] = [
  { key: 'Empresa', label: 'Empresa', icon: PencilRuler },
  { key: 'Cupones', label: 'Cupones', icon: Banknote },
  { key: 'Suscriptores', label: 'Suscriptores', icon: Mail },
  { key: 'Contactos', label: 'Contactos', icon: ClipboardList },
  { key: 'Clientes', label: 'Clientes', icon: Users },
  { key: 'Reseñas', label: 'Reseñas', icon: MessageSquare },
  { key: 'Auditoría', label: 'Auditoría', icon: ShieldCheck },
]

const SECTION_TITLE: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Productos',
  orders: 'Pedidos',
  Empresa: 'Configuración · Empresa',
  Cupones: 'Configuración · Cupones',
  Suscriptores: 'Configuración · Suscriptores',
  Contactos: 'Configuración · Contactos',
  Clientes: 'Configuración · Clientes',
  Reseñas: 'Configuración · Reseñas',
  Auditoría: 'Configuración · Auditoría',
}

export default function Admin() {
  const { t } = useTranslation()
  const pushToast = useUi((s) => s.pushToast)
  const [checking, setChecking] = useState(!!getAdminToken())
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authorized, setAuthorized] = useState(!getAdminToken() ? false : true)
  const [section, setSection] = useState<Section>('dashboard')
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) return
    let dead = false
    setChecking(true)
    adminService
      .me()
      .then((r) => {
        if (dead) return
        setUser(r.user)
        setAuthorized(true)
      })
      .catch((err) => {
        if (dead) return
        if (err instanceof Error && (err as unknown as { status?: number }).status !== 401) {
          setOnline(false)
        } else {
          setAdminToken(null)
        }
        setAuthorized(false)
      })
      .finally(() => {
        if (!dead) setChecking(false)
      })
    return () => {
      dead = true
    }
  }, [])

  const logout = () => {
    setAdminToken(null)
    setUser(null)
    setAuthorized(false)
    pushToast('Sesión cerrada', 'info')
  }

  if (checking) return null
  if (!authorized || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night px-4">
        <AdminLogin
          onSuccess={(u) => {
            setUser(u)
            setAuthorized(true)
            setOnline(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-night text-ivory">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gold/15 bg-carbon/60 lg:flex">
        <div className="border-b border-gold/15 px-6 py-6">
          <button onClick={() => setSection('dashboard')} className="text-left">
            <img src="/logo.jpg" alt="SULTAN BLACK" className="h-10 w-auto object-contain" />
            <span className="mt-1 block pl-0.5 text-[0.58rem] font-medium uppercase tracking-[0.6em] text-silver">Administración</span>
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6" aria-label="Panel de administración">
          <div>
            <p className="mb-2 px-2 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-bone">Principal</p>
            <ul className="space-y-1">
              {NAV.filter((n) => n.group === 'general' || n.group === 'ventas').map((n) => (
                <li key={n.key}>
                  <SidebarItem active={section === n.key} onClick={() => setSection(n.key)} icon={n.icon} label={n.label} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 px-2 text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-bone">Configuración</p>
            <ul className="space-y-1">
              {CONFIG_NAV.map((n) => (
                <li key={n.key}>
                  <SidebarItem active={section === n.key} onClick={() => setSection(n.key)} icon={n.icon} label={n.label} />
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="border-t border-gold/15 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 text-[0.65rem] font-bold text-gold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ivory">{user.name}</p>
              <p className={cn('flex items-center gap-1 text-[0.58rem] uppercase tracking-[0.2em]', online ? 'text-emerald-400' : 'text-bone/70')}>
                {online ? <Wifi size={10} /> : <ServerOff size={10} />}
                {online ? 'Conectado' : 'Sin servidor'}
              </p>
            </div>
            <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="flex h-9 w-9 items-center justify-center border border-gold/30 text-gold hover:bg-gold hover:text-night">
              <LogOut size={14} />
            </button>
          </div>
          <p className="mt-3 text-[0.58rem] uppercase tracking-[0.2em] text-bone">{user.role} · {user.username}</p>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-gold/15 bg-night/95 px-4 py-4 backdrop-blur-sm lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-wide text-ivory md:text-2xl">{SECTION_TITLE[section]}</h1>
              <p className="mt-0.5 text-[0.6rem] uppercase tracking-[0.3em] text-bone">
                Inicio / {SECTION_TITLE[section].split(' · ').join(' / ')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.24em]', online ? 'text-emerald-400' : 'text-bone/70')}>
                {online ? <Wifi size={11} /> : <ServerOff size={11} />}
                {online ? 'API conectada' : 'Servidor no disponible'}
              </span>
              <button
                onClick={logout}
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center border border-gold/40 text-gold transition-colors hover:bg-gold hover:text-night lg:hidden"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* Navegación móvil (horizontal) */}
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden" aria-label="Secciones">
            {[...NAV, ...CONFIG_NAV].map((n) => (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] transition-colors',
                  section === n.key ? 'border-gold bg-gold text-night' : 'border-gold/25 text-bone hover:border-gold/60 hover:text-gold',
                )}
              >
                <n.icon size={13} /> {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 py-8 lg:px-8">
          {section === 'dashboard' && <AdminDashboard onNavigate={setSection} />}
          {section === 'products' && <AdminProducts />}
          {section === 'orders' && <AdminOrders />}
          {section !== 'dashboard' && section !== 'products' && section !== 'orders' && (
            <AdminSettings section={section} onSectionChange={setSection} />
          )}
        </main>

        <footer className="border-t border-gold/15 px-8 py-4 text-center text-[0.58rem] uppercase tracking-[0.24em] text-bone">
          {t('admin.kicker')} · {user.role}
        </footer>
      </div>
    </div>
  )
}

function SidebarItem({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof LayoutDashboard
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-[0.72rem] font-medium uppercase tracking-[0.2em] transition-all',
        active
          ? 'border-gold bg-gold/10 text-gold'
          : 'border-transparent text-bone hover:border-gold/40 hover:bg-gold/5 hover:text-ivory',
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}