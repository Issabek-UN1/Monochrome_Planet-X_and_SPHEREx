import { createContext, useContext } from 'react'
import type { Language } from './translations'

export interface I18nContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, fallback?: string) => string
}

export const I18N_STORAGE_KEY = 'monochrome_language'

export const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
})

export const useI18n = (): I18nContextType => {
  return useContext(I18nContext)
}
