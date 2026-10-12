/**
 * Capa de pasarela de pago.
 *
 * El frontend no toca nunca datos de tarjeta: crea una sesión de pago,
 * redirige al cliente a la pasarela, y el servidor confirma el pedido
 * cuando la pasarela lo notifica por webhook.
 *
 * Para conectar una pasarela real (Wompi, PayU, Mercado Pago…):
 *   1. Crea un adaptador en server/payments/providers/ con createSession()
 *      y verifyWebhook().
 *   2. Regístralo en la variable PROVIDER abajo.
 *   3. Configura sus claves en .env (ver .env.example).
 */

export class PaymentError extends Error {
  constructor(message, { code = 'payment_error', status = 400 } = {}) {
    super(message)
    this.code = code
    this.status = status
  }
}

/* Estado de un pago, compartido por todas las pasarelas. */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  ERROR: 'error',
}

/** @typedef {Object} PaymentSession
 *  @property {string} orderNumber
 *  @property {number} amount   importe en la moneda de la pasarela
 *  @property {string} currency
 *  @property {string} checkoutUrl  URL a la que redirigir al cliente
 *  @property {string} [reference]  referencia interna de la pasarela
 *  @property {string} [token]
 */

/** @typedef {Object} WebhookPayload
 *  @property {string} type          p. ej. 'payment.approved'
 *  @property {string} orderNumber
 *  @property {string} status        uno de PAYMENT_STATUS
 *  @property {string} [transactionId]
 *  @property {string} [reason]
 */

/** @typedef {Object} PaymentProvider
 * @property {string} name
 * @property {(order: {number:string, total:number, currency:string, customer:{email:string,name:string}}, returnUrl:string) => Promise<PaymentSession>} createSession
 * @property {(req: {method:string, headers:Record<string,string>, body:unknown}, rawBody?:string) => Promise<WebhookPayload>} verifyWebhook
 * @property {(orderNumber: string) => Promise<WebhookPayload & {status:string}> getStatus
 */

/** Adaptadores disponibles. Añade aquí los que necesites. */
const ADAPTERS = {}

/**
 * Registra un adaptador de pasarela.
 * @param {string} name
 * @param {PaymentProvider} provider
 */
export function registerProvider(name, provider) {
  ADAPTERS[name] = provider
}

/** Devuelve el adaptador activo o lanza si no hay ninguno configurado. */
export function getProvider() {
  const active = String(process.env.PAYMENT_PROVIDER ?? '').trim().toLowerCase()
  if (!active) {
    throw new PaymentError(
      'No hay pasarela de pago configurada. Define PAYMENT_PROVIDER en .env y registra un adaptador.',
      { code: 'payment_not_configured', status: 503 },
    )
  }
  const provider = ADAPTERS[active]
  if (!provider) {
    throw new PaymentError(`Pasarela desconocida: ${active}`, { code: 'payment_not_configured', status: 503 })
  }
  return provider
}
