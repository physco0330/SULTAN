import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
  /* El idioma vive en estado para forzar el re-render de los consumidores
   * (bandera, etiqueta nativa y resaltado del selector). */
  const [language, setLanguageState] = useState<string>(() => i18n.language)

  useEffect(() => {
    const apply = (lng: string) => {
      applyDocumentLanguage(lng)
      setLanguageState(lng)
    }
    apply(i18n.language)
    i18n.on('languageChanged', apply)
    return () => {
      i18n.off('languageChanged', apply)
    }
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (code) => {
        void i18n.changeLanguage(code)
      },
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
