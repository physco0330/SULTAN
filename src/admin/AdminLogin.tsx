import { useState } from 'react'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { ApiError, setAdminToken } from '@/services/api'
import { useUi } from '@/store/ui'
import { Spinner } from '@/admin/ui'
import type { AdminUser } from '@/services/adminService'

export function AdminLogin({ onSuccess }: { onSuccess: (user: AdminUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pushToast = useUi((s) => s.pushToast)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await adminService.login(username.trim(), password)
      setAdminToken(res.token)
      pushToast(`Bienvenido, ${res.user.name}`)
      onSuccess(res.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full border border-gold/25 bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm border border-gold/20 bg-carbon/60 p-8 shadow-2xl shadow-black/50">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-gold/40 text-gold">
            <Lock size={18} />
          </div>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-wide text-ivory">PANEL DE ADMINISTRACIÓN</h1>
          <p className="mt-1 text-[0.62rem] uppercase tracking-[0.3em] text-bone">SULTAN BLACK · Acceso restringido</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
            <input
              className={inputCls}
              style={{ paddingLeft: '2.4rem' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              autoComplete="username"
              required
            />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone" />
            <input
              className={inputCls}
              style={{ paddingLeft: '2.4rem' }}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bone hover:text-gold"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {error && <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 bg-gold py-3.5 text-xs font-bold uppercase tracking-[0.26em] text-night transition-all hover:bg-gold-soft disabled:opacity-50"
          >
            {busy ? <Spinner className="border-night/30 border-t-night" /> : 'Ingresar'}
          </button>
        </form>

        <p className="mt-5 text-center text-[0.62rem] leading-relaxed text-bone">
          Demo: <span className="text-gold">admin</span> / <span className="text-gold">sultan2026</span>
        </p>
      </div>
    </div>
  )
}