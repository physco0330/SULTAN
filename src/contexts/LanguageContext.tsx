import { createContext, useContext, useEffect } from 'react'
import i18n, { applyDocumentLanguage } from '@/i18n'
import type { ReactNode } from 'react'

interface LanguageContextValue {
  setLanguage: (code: string) => void
  language: string
}

const LanguageContext = createContext<LanguageContextValue>({
  setLanguage: () => undefined,
  language: i18n.language,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const apply = () => applyDocumentLanguage(i18n.language)
    apply()
    i18n.on('languageChanged', apply)
    return () => {
      i18n.off('languageChanged', apply)
    }
  }, [])

  const value: LanguageContextValue = {
    language: i18n.language,
    setLanguage: (code) => {
      void i18n.changeLanguage(code)
    },
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}