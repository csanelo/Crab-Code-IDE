import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { en, RTL_LANGS, type Lang, type TKey } from './translations'
import { zh } from './locales/zh'
import { hi } from './locales/hi'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { ar } from './locales/ar'
import { bn } from './locales/bn'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { id } from './locales/id'

const dictionaries: Record<Lang, Record<TKey, string>> = {
  en,
  zh,
  hi,
  es,
  fr,
  ar,
  bn,
  pt,
  ru,
  id
}

export type Translate = (key: TKey, params?: Record<string, string | number>) => string

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

const I18nContext = createContext<I18nValue | null>(null)

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`
  )
}

let activeLang: Lang = 'en'

export function translate(key: TKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[activeLang] ?? en
  return interpolate(dict[key] ?? en[key] ?? key, params)
}

export function getActiveLang(): Lang {
  return activeLang
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    void window.api.settings.getGeneral().then((g) => {
      if (g?.language) setLangState(g.language as Lang)
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr'
    activeLang = lang
  }, [lang])

  activeLang = lang

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    void window.api.settings.setGeneral({ language: next })
  }, [])

  const t = useCallback<Translate>(
    (key, params) => {
      const dict = dictionaries[lang] ?? en
      return interpolate(dict[key] ?? en[key] ?? key, params)
    },
    [lang]
  )

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT(): Translate {
  return useI18n().t
}
