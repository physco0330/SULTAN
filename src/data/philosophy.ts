export interface PhilosophyItem {
  icon: string
  title: string
  desc: string
}

/**
 * Elementos por defecto de la sección "La Filosofía Sultán" (Inicio y Nosotros).
 * El admin puede editarlos; si no se ha guardado nada, la tienda usa estos.
 */
export const DEFAULT_PHILOSOPHY_ITEMS: PhilosophyItem[] = [
  { icon: '✦', title: 'Calidad turca', desc: 'Tejidos seleccionados con una herencia de artesanía.' },
  { icon: '❖', title: 'Diseño original', desc: 'Siluetas dibujadas en Estambul, en ningún otro lugar.' },
  { icon: '◈', title: 'Materiales premium', desc: 'Seda, cachemira, lana y algodones finos.' },
  { icon: '✧', title: 'Atención al detalle', desc: 'Costuras milimétricas, herrajes dorados, acabado obsesivo.' },
  { icon: '➤', title: 'Exclusividad', desc: 'Ediciones pequeñas. Nunca producción en masa.' },
  { icon: '◆', title: 'Producción cuidada', desc: 'Lotes limitados, controlados en cada etapa.' },
]

/** Convierte el valor guardado (texto JSON) en una lista segura de elementos. */
export function parsePhilosophyItems(raw?: string): PhilosophyItem[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => ({
        icon: String(x?.icon ?? ''),
        title: String(x?.title ?? ''),
        desc: String(x?.desc ?? ''),
      }))
      .filter((x) => x.title || x.desc)
  } catch {
    return []
  }
}
