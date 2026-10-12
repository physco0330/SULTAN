/**
 * Rutas de pasarela de pago.
 *
 * Flujo:
 *   1. POST /api/payments/session  → crea el pedido y devuelve checkoutUrl
 *   2. El cliente paga en la pasarela y vuelve a returnUrl
 *   3. La pasarela notifica por POST /api/payments/webhook
 *   4. El pedido pasa a confirmed solo cuando el pago está autorizado
 */
import express from 'express'
import { getProvider, PaymentError, PAYMENT_STATUS } from '../payments/index.mjs'

export function paymentRoutes({ orders, audit, rateLimit }) {
  const router = express.Router()

  /**
   * Crea una sesión de pago para un pedido.
   * El cuerpo ya debe traer el pedido validado (lo llama /api/orders internamente
   * o tras validar items + stock + cupón).
   */
  router.post('/session', rateLimit('payment', 20), async (req, res) => {
    const orderNumber = String(req.body.orderNumber ?? '').trim().toUpperCase()
    if (!orderNumber) return res.status(422).json({ error: 'Número de pedido requerido' })

    const order = await orders.findByNumber(orderNumber)
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })
    if (order.status !== 'pending') {
      return res.status(409).json({ error: `El pedido ya está ${order.status}` })
    }

    const returnUrl = String(req.body.returnUrl || '').trim()
    if (!/^https?:\/\//.test(returnUrl)) {
      return res.status(422).json({ error: 'returnUrl debe ser una URL válida' })
    }

    try {
      const provider = getProvider()
      const session = await provider.createSession(
        { number: order.number, total: order.total_usd, currency: order.currency, customer: { email: order.customer_email, name: order.customer_name } },
        returnUrl,
      )
      await audit('cliente', 'payment.session', 'orders', order.number, `Sesión de pago creada (${session.reference})`)
      res.json({ checkoutUrl: session.checkoutUrl, reference: session.reference, status: PAYMENT_STATUS.PENDING })
    } catch (err) {
      if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message, code: err.code })
      console.error('[pago] error al crear sesión:', err.message)
      res.status(502).json({ error: 'No se pudo iniciar el pago' })
    }
  })

/**
 * Webhook de la pasarela. Cada adaptador verifica la firma y devuelve
 * el payload normalizado; aquí solo aplicamos el estado al pedido.
 * Usa express.raw para recibir el body sin procesar (necesario para
 * verificar firmas HMAC de la pasarela real).
 */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const provider = getProvider()
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {})
    let parsed
    try {
      parsed = JSON.parse(rawBody || '{}')
    } catch {
      return res.status(400).json({ error: 'Body no es JSON válido' })
    }
    const payload = await provider.verifyWebhook({
      method: req.method,
      headers: req.headers,
      body: parsed,
    })

    if (!payload.orderNumber || !payload.status) {
      return res.status(400).json({ error: 'Payload incompleto' })
    }

    const order = await orders.findByNumber(payload.orderNumber)
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })

    if (payload.status === PAYMENT_STATUS.AUTHORIZED) {
      await orders.changeStatusByNumber(order.number, 'confirmed')
      await audit('sistema', 'payment.approved', 'orders', order.number, `Pago autorizado (${payload.transactionId ?? 'sin txn'})`)
    } else if (payload.status === PAYMENT_STATUS.REJECTED) {
      await orders.changeStatusByNumber(order.number, 'cancelled')
      await audit('sistema', 'payment.rejected', 'orders', order.number, payload.reason || 'Pago rechazado')
    }

    res.json({ ok: true })
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message, code: err.code })
    console.error('[pago] error en webhook:', err.message)
    res.status(502).json({ error: 'Error al procesar la notificación' })
  }
})

  /** Estado del pago de un pedido (para sondeo del frontend). */
  router.get('/status/:orderNumber', async (req, res) => {
    const orderNumber = String(req.params.orderNumber ?? '').trim().toUpperCase()
    try {
      const provider = getProvider()
      const status = await provider.getStatus(orderNumber)
      res.json(status)
    } catch (err) {
      if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message, code: err.code })
      res.status(502).json({ error: 'No se pudo consultar el estado' })
    }
  })

  return router
}