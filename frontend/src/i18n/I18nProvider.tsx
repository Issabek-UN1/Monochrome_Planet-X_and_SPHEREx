import React, { useEffect, useState } from 'react'
import { translations, type Language } from './translations'
import { I18nContext, I18N_STORAGE_KEY } from './context'

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParam = new URL(window.location.href).searchParams.get('lang')
        if (urlParam === 'ru' || urlParam === 'en') {
          return urlParam
        }
        const saved = localStorage.getItem(I18N_STORAGE_KEY)
        if (saved === 'ru' || saved === 'en') {
          return saved
        }
      } catch {
        // Fallback to default
      }
    }
    return 'en'
  })

  const setLang = (nextLang: Language) => {
    setLangState(nextLang)
    try {
      localStorage.setItem(I18N_STORAGE_KEY, nextLang)
    } catch {
      // Storage access blocked or unavailable
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const t = (key: string, fallback?: string): string => {
    const dict = translations[lang]
    if (dict && dict[key] !== undefined) {
      return dict[key]
    }
    const enDict = translations.en
    if (enDict && enDict[key] !== undefined) {
      return enDict[key]
    }
    return fallback ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
