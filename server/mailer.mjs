/**
 * Servicio de email y notificaciones al negocio.
 *
 * Usa la API HTTP del proveedor configurado (Resend, SendGrid, Mailgun…)
 * mediante fetch global, sin dependencias adicionales.
 *
 * Configuración en .env:
 *   MAIL_API_KEY=...        clave del proveedor
 *   MAIL_API_URL=...        endpoint (por defecto Resend)
 *   MAIL_FROM=...           remitente
 *   ADMIN_EMAIL=...         correo del negocio (notificaciones de pedidos)
 *   ADMIN_WHATSAPP=...      WhatsApp del negocio (notificación por WhatsApp)
 */

const MAIL_API_KEY = String(process.env.MAIL_API_KEY ?? '').trim()
const MAIL_API_URL = (process.env.MAIL_API_URL ?? 'https://api.resend.com/emails').replace(/\/$/, '')
const MAIL_FROM = String(process.env.MAIL_FROM ?? '').trim()
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL ?? '').trim()
const ADMIN_WHATSAPP = String(process.env.ADMIN_WHATSAPP ?? '').trim()
const CALLMEBOT_API_KEY = String(process.env.CALLMEBOT_API_KEY ?? '').trim()

/* Tasa interna USD→COP usada por el panel. Los correos muestran pesos. */
const COP_RATE = 4100
const cop = (usd) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    Math.round(Number(usd ?? 0) * COP_RATE),
  )

export const mailerConfig = {
  configured: Boolean(MAIL_API_KEY && MAIL_FROM),
  from: MAIL_FROM,
  adminEmail: ADMIN_EMAIL,
  adminWhatsapp: ADMIN_WHATSAPP,
  whatsappConfigured: Boolean(ADMIN_WHATSAPP && CALLMEBOT_API_KEY),
}

/**
 * Envía un email a través de la API del proveedor.
 * Si no hay configuración, lo registra en consola (desarrollo).
 */
export async function sendMail({ to, subject, html, text }) {
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    console.warn('[correo] destino inválido:', to)
    return { ok: false, error: 'destino inválido' }
  }
  if (!mailerConfig.configured) {
    console.log(`[correo·demo] Para: ${to}\n  Asunto: ${subject}\n  ${text || html?.slice(0, 120) || ''}`)
    return { ok: true, demo: true }
  }

  try {
    const res = await fetch(MAIL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: MAIL_FROM, to, subject, html, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[correo] el proveedor respondió ${res.status}:`, body.slice(0, 200))
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[correso] fallo de red:', err.message)
    return { ok: false, error: err.message }
  }
}

/** Email de confirmación al cliente. */
export async function sendOrderConfirmation(order, items) {
  const subject = `Confirmación de tu pedido ${order.number} — SULTAN BLACK`
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#1a1a1a">
      <h1 style="color:#C9A227">Gracias por tu pedido</h1>
      <p>Hola ${order.customer_name}, hemos recibido tu pedido <strong>${order.number}</strong>.</p>
      <table width="100%" cellpadding="8" style="border-collapse:collapse">
        ${items.map((i) => `<tr><td>${i.name} × ${i.quantity}</td><td style="text-align:right">${cop(i.price_usd)}</td></tr>`).join('')}
        <tr><td>Envío</td><td style="text-align:right">${cop(order.shipping_usd)}</td></tr>
        <tr><td>Descuento</td><td style="text-align:right">−${cop(order.discount_usd)}</td></tr>
        <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${cop(order.total_usd)}</strong></td></tr>
      </table>
      <p>Coordinaremos la entrega por WhatsApp o correo.</p>
      <p style="color:#888;font-size:12px">SULTAN BLACK · Diseñado en Estambul</p>
    </div>`
  return sendMail({ to: order.customer_email, subject, html, text: `Pedido ${order.number} recibido. Total ${cop(order.total_usd)}` })
}

/** Notificación al negocio cuando llega un pedido. */
export async function notifyNewOrder(order, items) {
  const subject = `Nuevo pedido ${order.number} — ${cop(order.total_usd)}`
  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;margin:auto">
      <h1 style="color:#C9A227">Nuevo pedido</h1>
      <p><strong>${order.number}</strong> · ${order.customer_name} · ${order.customer_email}</p>
      <p>${order.ship_city}, ${order.ship_country} — ${order.ship_address}</p>
      <table width="100%" cellpadding="6">
        ${items.map((i) => `<tr><td>${i.name} × ${i.quantity}</td><td style="text-align:right">${cop(i.price_usd)}</td></tr>`).join('')}
        <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${cop(order.total_usd)}</strong></td></tr>
      </table>
      <p>Estado: ${order.status}</p>
    </div>`
  const results = []
  if (ADMIN_EMAIL) results.push(await sendMail({ to: ADMIN_EMAIL, subject, html, text: `Pedido ${order.number} por ${cop(order.total_usd)}` }))
  else console.log(`[correo·demo] Notificación al negocio: pedido ${order.number} por ${cop(order.total_usd)}`)
  if (mailerConfig.whatsappConfigured) {
    results.push(await sendWhatsapp(`Nuevo pedido ${order.number} de ${order.customer_name} por ${cop(order.total_usd)}. Revisa el panel de SULTAN BLACK.`))
  }
  return results
}

/**
 * Aviso por WhatsApp al negocio usando CallMeBot (servicio gratuito).
 * Requiere ADMIN_WHATSAPP (con indicativo) y CALLMEBOT_API_KEY.
 * El número debe haber activado el bot: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
export async function sendWhatsapp(text) {
  if (!ADMIN_WHATSAPP || !CALLMEBOT_API_KEY) return { ok: false, skipped: true }
  const url =
    'https://api.callmebot.com/whatsapp.php' +
    `?phone=${encodeURIComponent(ADMIN_WHATSAPP)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(CALLMEBOT_API_KEY)}`
  try {
    const res = await fetch(url)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    console.error('[whatsapp] fallo de red:', err.message)
    return { ok: false, error: err.message }
  }
}

/** Notificación por WhatsApp (mensaje de texto plano vía wa.me). */
export function whatsappOrderLink(order) {
  if (!ADMIN_WHATSAPP) return null
  const msg = encodeURIComponent(`Nuevo pedido ${order.number} de ${order.customer_name} por ${cop(order.total_usd)}. Revisar panel.`)
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`
}