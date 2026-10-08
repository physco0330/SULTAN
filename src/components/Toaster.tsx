import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useUi } from '@/store/ui'
import { cn } from '@/utils/cn'

export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex items-center gap-3 border px-4 py-3 text-sm shadow-xl shadow-black/60 backdrop-blur animate-fade-up',
            t.type === 'success' && 'border-gold/40 bg-carbon/95 text-ivory',
            t.type === 'error' && 'border-red-800 bg-carbon/95 text-ivory',
            t.type === 'info' && 'border-silver/30 bg-carbon/95 text-ivory',
          )}
        >
          {t.type === 'success' && <CheckCircle2 size={16} className="text-gold" />}
          {t.type === 'error' && <XCircle size={16} className="text-red-400" />}
          {t.type === 'info' && <Info size={16} className="text-silver" />}
          <span className="text-left">{t.message}</span>
        </button>
      ))}
    </div>
  )
}