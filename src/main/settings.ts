import type { IpcMain } from 'electron'
import Store from 'electron-store'

export type ShellKind = 'auto' | 'cmd' | 'powershell' | 'pwsh' | 'bash' | 'gitbash'

export type UiLang = 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ar' | 'bn' | 'pt' | 'ru' | 'id'

export type UiTheme = 'dark' | 'light'

export interface GeneralSettings {
  language: UiLang
  theme: UiTheme
  themeId: string
  defaultShell: ShellKind
  enterToSend: boolean
  autosave: boolean
  restoreOnStart: boolean
  autoUpdate: boolean
  telemetry: boolean
  terminalAutoScroll: boolean
  richFileIcons: boolean
}

const DEFAULTS: GeneralSettings = {
  language: 'en',
  theme: 'dark',
  themeId: 'crab-dark',
  defaultShell: 'auto',
  enterToSend: true,
  autosave: true,
  restoreOnStart: true,
  autoUpdate: true,
  telemetry: false,
  terminalAutoScroll: true,
  richFileIcons: true
}

const store = new Store<{ general: GeneralSettings }>({
  name: 'sreda-general',
  defaults: { general: DEFAULTS }
})

let cached: GeneralSettings = { ...DEFAULTS, ...store.get('general'), autosave: true }

export function getGeneralSettings(): GeneralSettings {
  return cached
}

export function registerSettings(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get-general', () => cached)
  ipcMain.handle('settings:set-general', (_e, partial: Partial<GeneralSettings>) => {
    cached = { ...cached, ...partial, autosave: true }
    store.set('general', cached)
    return cached
  })
}
