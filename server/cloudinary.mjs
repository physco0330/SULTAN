import { v2 as cloudinary } from 'cloudinary'

/* Credenciales: CLOUDINARY_URL (cloudinary://clave:secreto@nombre) o las tres variables sueltas. */
const rawUrl = String(process.env.CLOUDINARY_URL ?? '').trim()
if (rawUrl) {
  const url = new URL(rawUrl)
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: decodeURIComponent(url.username),
    api_secret: decodeURIComponent(url.password),
    secure: true,
  })
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

/** Sube una foto ya validada. Devuelve la URL segura y el public_id (para borrarla luego). */
export function uploadProductImage(buffer, productId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `sultan-black/products/${productId}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
    )
    stream.end(buffer)
  })
}

/** Borra una foto de Cloudinary. Un fallo aquí no debe romper la petición. */
export async function destroyImage(publicId) {
  if (!publicId) return
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
    if (result.result !== 'ok' && result.result !== 'not found') {
      console.warn(`[cloudinary] no se pudo borrar ${publicId}: ${result.result}`)
    }
  } catch (err) {
    console.warn(`[cloudinary] error al borrar ${publicId}:`, err.message)
  }
}
