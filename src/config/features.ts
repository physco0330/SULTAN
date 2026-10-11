/**
 * Feature flags centralizados del sistema.
 * Para reactivar el módulo de Mujer en el futuro: cambiar `enabled: false` a `true`.
 * No elimina código ni datos: solo oculta accesos y bloquea rutas.
 */

export const FEATURES = {
  /** Módulo Mujer (women). Temporalmente desactivado por decisión de negocio. */
  women: {
    enabled: false,
    label: 'Módulo Mujer',
  },
} as const

export function isFeatureEnabled(key: keyof typeof FEATURES): boolean {
  return FEATURES[key].enabled
}

/** Géneros activos para el catálogo y filtros públicos. */
export const ACTIVE_GENDERS = isFeatureEnabled('women')
  ? (['men', 'women'] as const)
  : (['men'] as const)
