/* Cross-tab live data sync. Every admin mutation bumps the global data
 * version (locally AND over a BroadcastChannel), so open storefront tabs
 * refresh silently without any manual page reload. */

type Listener = () => void
const listeners = new Set<Listener>()
let channel: BroadcastChannel | null = null
try {
  if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('sultan-live-data')
} catch {
  channel = null
}
channel?.addEventListener('message', (e) => {
  if (e.data?.type === 'data:changed') listeners.forEach((l) => l())
})

export function bumpDataVersion() {
  listeners.forEach((l) => l())
  try {
    channel?.postMessage({ type: 'data:changed' })
  } catch {
    /* channel closed */
  }
}

export function subscribeDataVersion(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}