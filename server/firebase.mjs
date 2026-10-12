import { existsSync, readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Credenciales de la cuenta de servicio de Firebase.
 * En Render: FIREBASE_SERVICE_ACCOUNT_JSON (contenido completo del JSON).
 * En tu PC: FIREBASE_SERVICE_ACCOUNT_PATH (ruta al archivo descargado).
 * Nunca se guarda la clave dentro del repositorio.
 */
function loadServiceAccount() {
  const inline = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim()
  if (inline) return JSON.parse(inline)

  const path = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim()
  if (path) {
    if (!existsSync(path)) throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH no existe: ${path}`)
    return JSON.parse(readFileSync(path, 'utf8'))
  }

  throw new Error(
    'Falta la clave de Firebase: define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH.',
  )
}

let firestore = null

/** Devuelve la conexión a Firestore, creándola la primera vez. */
export function getDb() {
  if (firestore) return firestore
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) })
  firestore = getFirestore()
  firestore.settings({ ignoreUndefinedProperties: true })
  return firestore
}
