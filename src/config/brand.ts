export const brandConfig = {
  name: 'SULTAN BLACK',
  tagline: 'Where Turkish Craft Meets Modern Luxury',
  whatsappNumber: '573117317614',
  instagramUrl: 'https://www.instagram.com/sultanblack_store',
  email: 'sales@sultanblack.com',
  address: 'Istanbul, Türkiye',
  defaultCurrency: 'COP',
  defaultLanguage: 'es',
  imageBaseUrl: '',
  currencyRatesMock: true,
  freeShippingThreshold: 300,
} as const

export const config = {
  // Centralized, replace-with-real-values later. Keep empty = feature hidden/disabled.
  WHATSAPP_NUMBER: '',
  INSTAGRAM_URL: '',
  EMAIL: '',
}

export type AppConfig = typeof brandConfig