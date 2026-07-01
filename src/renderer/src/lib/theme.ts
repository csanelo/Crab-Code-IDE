
import { getThemeDef, THEME_VAR_KEYS, type ThemeBase } from '../theme/themes'

export type Theme = ThemeBase

const ID_KEY = 'sreda.themeId'
const LEGACY_KEY = 'sreda.theme'

let currentId = 'crab-dark'

try {
  const savedId = localStorage.getItem(ID_KEY)
  if (savedId) {
    currentId = savedId
  } else {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === 'light') currentId = 'crab-light'
    else if (legacy === 'dark') currentId = 'crab-dark'
  }
} catch {
}

export function getTheme(): Theme {
  return getThemeDef(currentId).base
}

export function getThemeId(): string {
  return currentId
}

export function applyThemeId(id: string): void {
  const def = getThemeDef(id)
  currentId = def.id
  const root = document.documentElement
  root.setAttribute('data-theme', def.base)
  for (const key of THEME_VAR_KEYS) root.style.removeProperty(key)
  for (const [key, value] of Object.entries(def.vars)) root.style.setProperty(key, value)
  try {
    localStorage.setItem(ID_KEY, def.id)
    localStorage.setItem(LEGACY_KEY, def.base)
  } catch {
  }
}

export function applyTheme(base: Theme): void {
  applyThemeId(base === 'light' ? 'crab-light' : 'crab-dark')
}

export function initTheme(): void {
  applyThemeId(currentId)
}
