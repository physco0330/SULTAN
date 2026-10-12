/**
 * Adaptador de demostración para la pasarela de pago.
 *
 * Simula el flujo completo (crear sesión → redirigir → webhook) sin
 * credenciales reales. Sirve para probar el checkout en desarrollo.
 *
 * Para producción, crea un adaptador real en providers/ y configura
 * PAYMENT_PROVIDER en .env.
 */
import { PAYMENT_STATUS } from '../index.mjs'

const sessions = new Map()

export const demoProvider = {
  name: 'demo',

  async createSession(order, returnUrl) {
    const reference = `DEMO-${order.number}-${Date.now().toString(36).slice(-6)}`
    const session = {
      orderNumber: order.number,
      amount: order.total,
      currency: order.currency,
      reference,
      token: reference,
      checkoutUrl: `${returnUrl}?reference=${reference}&amount=${order.total}&currency=${order.currency}`,
    }
    sessions.set(order.number, { ...session, status: PAYMENT_STATUS.PENDING })
    return session
  },

  async verifyWebhook(req) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const reference = String(body.reference || '').trim()
    if (!reference) return { type: 'payment.unknown', orderNumber: '', status: PAYMENT_STATUS.ERROR, reason: 'Sin referencia' }
    const orderNumber = reference.replace(/^DEMO-/, '').replace(/-[a-z0-9]+$/i, '')
    const session = sessions.get(orderNumber)
    if (!session) return { type: 'payment.unknown', orderNumber, status: PAYMENT_STATUS.ERROR, reason: 'Sesión no encontrada' }
    const approved = body.action !== 'reject'
    return {
      type: approved ? 'payment.approved' : 'payment.rejected',
      orderNumber,
      status: approved ? PAYMENT_STATUS.AUTHORIZED : PAYMENT_STATUS.REJECTED,
      transactionId: approved ? `TXN-${Date.now().toString(36).toUpperCase()}` : null,
      reason: approved ? null : body.reason || 'Pago rechazado',
    }
  },

  async getStatus(orderNumber) {
    const session = sessions.get(orderNumber)
    if (!session) return { orderNumber, status: PAYMENT_STATUS.PENDING }
    return { orderNumber, status: session.status, transactionId: session.transactionId ?? null }
  },
}

/** Marca un pago demo como aprobado (solo para pruebas manuales). */
export function approveDemoPayment(orderNumber) {
  const session = sessions.get(orderNumber)
  if (session) {
    session.status = PAYMENT_STATUS.AUTHORIZED
    session.transactionId = `TXN-${Date.now().toString(36).toUpperCase()}`
  }
  return session
}