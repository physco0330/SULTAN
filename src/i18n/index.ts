import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { DEFAULT_LANGUAGE } from '@/data/languages'

import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import ar from './locales/ar.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import id from './locales/id.json'
import hi from './locales/hi.json'
import bn from './locales/bn.json'
import ur from './locales/ur.json'
import pa from './locales/pa.json'
import tr from './locales/tr.json'

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  ru: { translation: ru },
  ar: { translation: ar },
  zh: { translation: zh },
  ja: { translation: ja },
  id: { translation: id },
  hi: { translation: hi },
  bn: { translation: bn },
  ur: { translation: ur },
  pa: { translation: pa },
  tr: { translation: tr },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: 'en',
    supportedLngs: Object.keys(resources),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'sultan-language',
    },
  })

export function applyDocumentLanguage(lang: string) {
  const code = lang.split('-')[0]
  const dir = code === 'ar' || code === 'ur' ? 'rtl' : 'ltr'
  document.documentElement.lang = code
  document.documentElement.dir = dir
  document.title = 'SULTAN BLACK | The Art of Luxury'
}

export default i18n