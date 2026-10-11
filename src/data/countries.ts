/**
 * Países disponibles y su moneda oficial por defecto (códigos ISO 4217).
 * Sultan opera envíos nacionales en Colombia; el resto de países se muestran
 * como referencia informativa de precios mientras no haya operación comercial.
 */
export interface Country {
  /** ISO 3166-1 alfa-2 */
  code: string
  name: string
  /** código de bandera para <CountryFlag> */
  flag: string
  currency: string
  /** prefijo telefónico internacional, usado para normalizar WhatsApp */
  dial: string
}

export const COUNTRIES: Country[] = [
  { code: 'CO', name: 'Colombia', flag: 'CO', currency: 'COP', dial: '57' },
  { code: 'US', name: 'Estados Unidos', flag: 'US', currency: 'USD', dial: '1' },
  { code: 'MX', name: 'México', flag: 'MX', currency: 'MXN', dial: '52' },
  { code: 'PA', name: 'Panamá', flag: 'PA', currency: 'USD', dial: '507' },
  { code: 'CL', name: 'Chile', flag: 'CL', currency: 'CLP', dial: '56' },
  { code: 'AR', name: 'Argentina', flag: 'AR', currency: 'ARS', dial: '54' },
  { code: 'BR', name: 'Brasil', flag: 'BR', currency: 'BRL', dial: '55' },
  { code: 'PE', name: 'Perú', flag: 'PE', currency: 'PEN', dial: '51' },
  { code: 'UY', name: 'Uruguay', flag: 'UY', currency: 'UYU', dial: '598' },
  { code: 'EC', name: 'Ecuador', flag: 'EC', currency: 'USD', dial: '593' },
  { code: 'ES', name: 'España', flag: 'ES', currency: 'EUR', dial: '34' },
  { code: 'FR', name: 'Francia', flag: 'FR', currency: 'EUR', dial: '33' },
  { code: 'DE', name: 'Alemania', flag: 'DE', currency: 'EUR', dial: '49' },
  { code: 'IT', name: 'Italia', flag: 'IT', currency: 'EUR', dial: '39' },
  { code: 'GB', name: 'Reino Unido', flag: 'GB', currency: 'GBP', dial: '44' },
  { code: 'CA', name: 'Canadá', flag: 'CA', currency: 'CAD', dial: '1' },
  { code: 'AU', name: 'Australia', flag: 'AU', currency: 'AUD', dial: '61' },
  { code: 'TR', name: 'Turquía', flag: 'TR', currency: 'TRY', dial: '90' },
  { code: 'RU', name: 'Rusia', flag: 'RU', currency: 'RUB', dial: '7' },
  { code: 'CN', name: 'China', flag: 'CN', currency: 'CNY', dial: '86' },
  { code: 'JP', name: 'Japón', flag: 'JP', currency: 'JPY', dial: '81' },
  { code: 'IN', name: 'India', flag: 'IN', currency: 'INR', dial: '91' },
  { code: 'AE', name: 'Emiratos Árabes Unidos', flag: 'AE', currency: 'AED', dial: '971' },
  { code: 'PK', name: 'Pakistán', flag: 'PK', currency: 'PKR', dial: '92' },
  { code: 'BD', name: 'Bangladés', flag: 'BD', currency: 'BDT', dial: '880' },
  { code: 'ID', name: 'Indonesia', flag: 'ID', currency: 'IDR', dial: '62' },
]

export const DEFAULT_COUNTRY = 'CO'

export function getCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]
}

/** Normaliza un número a formato internacional para enlaces wa.me.
 *  Quita espacios, guiones y paréntesis; conserva el prefijo si ya viene. */
export function normalizeWhatsApp(raw: string, defaultDial = '57'): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return null
  // si ya viene con prefijo internacional explícito (empieza por 00)
  if (digits.startsWith('00')) digits = digits.slice(2)
  // si el número trae menos de 11 dígitos, anteponemos el prefijo del país
  if (digits.length <= 10 && !digits.startsWith(defaultDial)) {
    digits = defaultDial + digits
  }
  return digits.length >= 11 && digits.length <= 15 ? digits : null
}

export function whatsappUrl(raw: string, defaultDial = '57'): string | null {
  const n = normalizeWhatsApp(raw, defaultDial)
  return n ? `https://wa.me/${n}` : null
}
