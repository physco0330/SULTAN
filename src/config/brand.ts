export const brandConfig = {
  name: 'SULTAN BLACK',
  tagline: 'Where Turkish Craft Meets Modern Luxury',
  whatsappNumber: '',
  instagramUrl: '',
  email: '',
  address: 'Istanbul, Türkiye',
  defaultCurrency: 'USD',
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