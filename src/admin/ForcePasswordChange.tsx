import { useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { adminService } from '@/services/adminService'
import { setAdminToken } from '@/services/api'
import { useUi } from '@/store/ui'
import { Spinner } from '@/admin/ui'
import { cn } from '@/utils/cn'

const label = 'mb-1.5 block text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-bone'
const input =
  'w-full border border-gold/25 bg-night px-3 py-2.5 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none'

/** Reglas idénticas a las del backend (server/index.mjs → passwordStrength). */
const RULES: [RegExp, string][] = [
  [/.{10,}/, 'Mínimo 10 caracteres'],
  [/^.*[a-z].*$/, 'Al menos una minúscula'],
  [/^.*[A-Z].*$/, 'Al menos una mayúscula'],
  [/^.*\d.*$/, 'Al menos un número'],
  [/^.*[^A-Za-z0-9].*$/, 'Al menos un símbolo'],
]

/**
 * Pantalla de cambio obligatorio de contraseña. Mientras el servidor marque
 * la cuenta con must_change_password, el resto del panel queda bloqueado.
 */
export function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const pushToast = useUi((s) => s.pushToast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const met = (re: RegExp) => re.test(next)
  const strong = RULES.every(([re]) => met(re))
  const match = next.length > 0 && next === repeat

  const submit = async () => {
    setError('')
    if (!strong) return setError('La contraseña nueva no cumple todos los requisitos.')
    if (!match) return setError('Las contraseñas nuevas no coinciden.')
    setBusy(true)
    try {
      const res = await adminService.changePassword(current, next)
      setAdminToken(res.token)
      pushToast('Contraseña actualizada', 'success')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-night px-4 py-10">
      <div className="w-full max-w-md border border-gold/30 bg-carbon p-8">
        <ShieldCheck size={26} className="text-gold" />
        <h1 className="font-display mt-4 text-2xl font-semibold tracking-wide text-ivory">
          CAMBIA TU CONTRASEÑA
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-bone">
          La cuenta se creó con una contraseña temporal. Por seguridad, el panel permanece bloqueado
          hasta que definas una contraseña propia.
        </p>

        <div className="mt-7 space-y-4">
          <label className="block">
            <span className={label}>Contraseña actual *</span>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={input}
            />
          </label>

          <label className="block">
            <span className={label}>Contraseña nueva *</span>
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={input}
            />
          </label>

          <ul className="space-y-1">
            {RULES.map(([re, text]) => (
              <li
                key={text}
                className={cn(
                  'flex items-center gap-2 text-[0.68rem]',
                  met(re) ? 'text-emerald-300' : 'text-bone',
                )}
              >
                <span className={cn('inline-block size-1.5 rounded-full', met(re) ? 'bg-emerald-400' : 'bg-bone/40')} />
                {text}
              </li>
            ))}
          </ul>

          <label className="block">
            <span className={label}>Repetir contraseña nueva *</span>
            <input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={cn(input, repeat.length > 0 && !match && 'border-red-500/70')}
            />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || !strong || !match || !current}
            className="flex w-full items-center justify-center gap-2 bg-gold py-3.5 text-xs font-bold uppercase tracking-[0.26em] text-night transition-all hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner className="border-night/30 border-t-night" /> : <KeyRound size={13} />}
            Guardar contraseña
          </button>
        </div>
      </div>
    </div>
  )
}