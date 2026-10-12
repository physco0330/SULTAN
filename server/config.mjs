import { existsSync } from 'node:fs'

export const IS_PROD = process.env.NODE_ENV === 'production'
export const IS_TEST = process.env.NODE_ENV === 'test'

/* ------------------------------------------------------------------ */
/* Red y cabeceras                                                     */
/* ------------------------------------------------------------------ */

export const PORT = Number(process.env.PORT || 4001)

export const CORS_ORIGINS = String(process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

/** Dominio propio del frontend, para permitirlo junto a los orígenes explícitos. */
export const SITE_URL = String(process.env.SITE_URL ?? '').trim().replace(/\/$/, '')

export function allowedOrigins() {
  const set = new Set(CORS_ORIGINS)
  if (SITE_URL) set.add(SITE_URL)
  return [...set]
}

/* ------------------------------------------------------------------ */
/* Secretos                                                            */
/* ------------------------------------------------------------------ */

export const SULTAN_SECRET = String(process.env.SULTAN_SECRET ?? '').trim()

/* ------------------------------------------------------------------ */
/* Servicios externos                                                  */
/* ------------------------------------------------------------------ */

/** Firebase: JSON completo (Render) o ruta a un archivo (PC). */
export function firebaseConfigured() {
  return Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim() || String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim())
}

export function cloudinaryConfigured() {
  if (String(process.env.CLOUDINARY_URL ?? '').trim()) return true
  return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every((k) =>
    String(process.env[k] ?? '').trim(),
  )
}

/* ------------------------------------------------------------------ */
/* Validación de arranque                                              */
/* ------------------------------------------------------------------ */

/**
 * Comprueba que la configuración sea válida. Devuelve la lista de problemas.
 * Un error aquí detiene el arranque: es preferible no arrancar a arrancar
 * exponiendo datos o firmando tokens con claves débiles.
 */
export function validateConfig() {
  const errors = []
  const warnings = []

  if (IS_PROD) {
    if (!SULTAN_SECRET) {
      errors.push('SULTAN_SECRET es obligatorio en producción.')
    } else if (SULTAN_SECRET.length < 32) {
      errors.push(`SULTAN_SECRET debe tener al menos 32 caracteres (tiene ${SULTAN_SECRET.length}).`)
    } else if (SULTAN_SECRET === 'cambia-esto-por-una-clave-larga-y-aleatoria') {
      errors.push('SULTAN_SECRET sigue con el valor de ejemplo: cámbialo por uno aleatorio.')
    }

    if (!allowedOrigins().length) {
      errors.push('ALLOWED_ORIGINS o SITE_URL es obligatorio en producción (orígenes del frontend separados).')
    }
  } else {
    if (!SULTAN_SECRET) {
      warnings.push('SULTAN_SECRET no definido: se generará uno temporal (las sesiones caducan al reiniciar).')
    }
    if (!allowedOrigins().length) {
      warnings.push('ALLOWED_ORIGINS no definido: se aceptarán únicamente peticiones del mismo origen.')
    }
  }

  if (!firebaseConfigured()) {
    errors.push(
      'Falta la clave de Firebase: define FIREBASE_SERVICE_ACCOUNT_JSON (contenido del JSON, en Render) o FIREBASE_SERVICE_ACCOUNT_PATH (ruta al archivo, en tu PC).',
    )
  } else if (!String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim()) {
    const path = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH).trim()
    if (!existsSync(path)) errors.push(`FIREBASE_SERVICE_ACCOUNT_PATH no existe: ${path}`)
  }

  const cloudinaryMsg =
    'Faltan credenciales de Cloudinary: define CLOUDINARY_URL (cloudinary://clave:secreto@nombre) o las tres variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET. Sin ellas no se pueden subir fotos.'
  if (!cloudinaryConfigured()) {
    if (IS_PROD) errors.push(cloudinaryMsg)
    else warnings.push(cloudinaryMsg)
  } else if (String(process.env.CLOUDINARY_URL ?? '').trim() && !String(process.env.CLOUDINARY_URL).trim().startsWith('cloudinary://')) {
    errors.push('CLOUDINARY_URL no tiene el formato cloudinary://clave:secreto@nombre.')
  }

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`PORT no válido: ${process.env.PORT}`)
  }

  return { errors, warnings, ok: errors.length === 0 }
}

/** Imprime el resumen de configuración sin revelar secretos. */
export function describeConfig() {
  const { errors, warnings } = validateConfig()
  console.log('[config] entorno   :', IS_PROD ? 'production' : IS_TEST ? 'test' : 'development')
  console.log('[config] orígenes  :', allowedOrigins().join(', ') || '(solo mismo origen)')
  console.log('[config] secreto   :', SULTAN_SECRET ? 'definido' : 'NO definido')
  console.log('[config] firebase  :', firebaseConfigured() ? 'clave definida' : 'NO definida')
  console.log('[config] cloudinary:', cloudinaryConfigured() ? 'credenciales definidas' : 'NO definidas')
  for (const w of warnings) console.warn(`[config] AVISO: ${w}`)
  for (const e of errors) console.error(`[config] ERROR: ${e}`)
  return { errors, warnings, ok: errors.length === 0 }
}
