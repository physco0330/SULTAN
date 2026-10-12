import { useEffect, useRef } from 'react'
import { subscribeDataVersion } from '@/utils/liveSync'

/** Vuelve a cargar los datos sin refrescar la página: cada intervalo, al volver
 *  a la ventana, y cuando otra pestaña o la tienda publica cambios. */
export function useLiveReload(reload: () => void, intervalMs = 15000) {
  const ref = useRef(reload)

  useEffect(() => {
    ref.current = reload
  })

  useEffect(() => {
    const run = () => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (document.visibilityState === 'visible' && !typing) ref.current()
    }
    const id = window.setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    const unsubscribe = subscribeDataVersion(run)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', run)
      unsubscribe()
    }
  }, [intervalMs])
}
