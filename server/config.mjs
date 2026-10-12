import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const IS_PROD = process.env.NODE_ENV === 'production'
export const IS_TEST = process.env.NODE_ENV === 'test'

/* ------------------------------------------------------------------ */
/* Rutas de datos                                                     */
/* ------------------------------------------------------------------ */

/**
 * Carpeta donde viven la base de datos y las imágenes subidas.
 *
 * En un entorno efímero (Render Free, Heroku, un contenedor temporal) esto
 * debe apuntar a un disco persistente: define SULTAN_DATA_DIR=/data.
 * Si no se define, se usa `server/data` dentro del repositorio.
 */
function resolveDataDir() {
  const raw = String(process.env.SULTAN_DATA_DIR ?? '').trim()
  if (!raw) return join(__dirname, 'data')
  return isAbsolute(raw) ? resolve(raw) : resolve(process.cwd(), raw)
}

export const DATA_DIR = resolveDataDir()

/** Las imágenes se guardan junto a la base de datos para no perderlas al reiniciar. */
export const UPLOADS_DIR = join(DATA_DIR, 'uploads')

/** El directorio de datos debe existir y tener espacio de escritura. */
export function ensureDataDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR]) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch (err) {
      throw new Error(
        `No se pudo crear el directorio de datos "${dir}": ${err.message}. ` +
          'Revisa SULTAN_DATA_DIR y los permisos de escritura.',
      )
    }
  }
  try {
    statSync(DATA_DIR)
  } catch {
    throw new Error(`El directorio de datos "${DATA_DIR}" no es accesible.`)
  }
}

/** Aviso temprano si el directorio parece efímero y no hay nada que lo respalde. */
export function dataDirIsEphemeral() {
  if (IS_TEST) return false
  if (process.env.SULTAN_DATA_DIR) return false
  if (!IS_PROD) return false
  /* Sin SULTAN_DATA_DIR en producción los datos se pierden en cada despliegue. */
  return !existsSync(resolve(DATA_DIR, '.persisted'))
}

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
/* Validación de arranque                                              */
/* ------------------------------------------------------------------ */

/**
 * Comprueba que la configuración sea válida. Devuelve la lista de problemas.
 * En producción, un error aquí detiene el arranque: es preferible no
 * arrancar a arrancar exponiendo datos o firmando tokens con claves débiles.
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

    if (!process.env.SULTAN_DATA_DIR) {
      errors.push(
        'SULTAN_DATA_DIR es obligatorio en producción: sin un disco persistente, cada despliegue borra la base de datos y las imágenes.',
      )
    }
  } else {
    if (!SULTAN_SECRET) {
      warnings.push('SULTAN_SECRET no definido: se generará uno temporal (las sesiones caducan al reiniciar).')
    }
    if (!allowedOrigins().length) {
      warnings.push('ALLOWED_ORIGINS no definido: se aceptarán únicamente peticiones del mismo origen.')
    }
  }

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`PORT no válido: ${process.env.PORT}`)
  }

  return { errors, warnings, ok: errors.length === 0 }
}

/** Imprime el resumen de configuración sin revelar secretos. */
export function describeConfig() {
  const { errors, warnings } = validateConfig()
  console.log('[config] datos     :', DATA_DIR)
  console.log('[config] imágenes  :', UPLOADS_DIR)
  console.log('[config] orígenes :', allowedOrigins().join(', ') || '(solo mismo origen)')
  console.log('[config] entorno   :', IS_PROD ? 'production' : IS_TEST ? 'test' : 'development')
  console.log('[config] secreto   :', SULTAN_SECRET ? 'definido' : 'NO definido')
  for (const w of warnings) console.warn(`[config] AVISO: ${w}`)
  for (const e of errors) console.error(`[config] ERROR: ${e}`)
  return { errors, warnings, ok: errors.length === 0 }
}