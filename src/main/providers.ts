import { ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'

export type ProviderApi = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface StoredModel {
  id: string
  label: string
}

export interface ProviderConfig {
  id: string
  catalogId: string
  name: string
  api: ProviderApi
  baseUrl: string
  apiKeyEnc?: string
  models: StoredModel[]
}

export interface ProviderState {
  providers: ProviderConfig[]
  activeId: string | null
  activeModel: string | null
}

const DEFAULTS: ProviderState = {
  providers: [],
  activeId: null,
  activeModel: null
}

const store = new Store<{ providers: ProviderState }>({
  name: 'sreda-providers',
  defaults: { providers: DEFAULTS }
})

let cached: ProviderState = { ...DEFAULTS, ...store.get('providers') }

function persist(): void {
  store.set('providers', cached)
}

function encrypt(plain: string): string {
  if (!plain) return ''
  if (!safeStorage.isEncryptionAvailable()) return `plain:${plain}`
  return `enc:${safeStorage.encryptString(plain).toString('base64')}`
}

export function decrypt(value: string | undefined): string {
  if (!value) return ''
  if (value.startsWith('plain:')) return value.slice(6)
  if (value.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    } catch {
      return ''
    }
  }
  return value
}

export function getActiveProvider(): { config: ProviderConfig; apiKey: string; model: string } | null {
  const id = cached.activeId
  if (!id) return null
  const config = cached.providers.find((p) => p.id === id)
  if (!config) return null
  return {
    config,
    apiKey: decrypt(config.apiKeyEnc),
    model: cached.activeModel ?? config.models[0]?.id ?? ''
  }
}

export function getProviderConfigs(): Array<{
  catalogId: string
  api: ProviderApi
  baseUrl: string
  apiKey: string
}> {
  return cached.providers.map((p) => ({
    catalogId: p.catalogId,
    api: p.api,
    baseUrl: p.baseUrl,
    apiKey: decrypt(p.apiKeyEnc)
  }))
}

function sanitize(state: ProviderState): ProviderState {
  return {
    ...state,
    providers: state.providers.map((p) => ({
      ...p,
      apiKeyEnc: p.apiKeyEnc ? '***' : undefined
    }))
  }
}

export function registerProviders(ipcMain_: typeof ipcMain): void {
  ipcMain_.handle('providers:get', () => sanitize(cached))

  ipcMain_.handle('providers:upsert', (_e, partial: ProviderConfig & { apiKey?: string }) => {
    const existing = cached.providers.find((p) => p.id === partial.id)
    const apiKeyEnc =
      partial.apiKey !== undefined && partial.apiKey !== '***'
        ? encrypt(partial.apiKey)
        : existing?.apiKeyEnc
    const next: ProviderConfig = {
      id: partial.id,
      catalogId: partial.catalogId,
      name: partial.name,
      api: partial.api,
      baseUrl: partial.baseUrl,
      models: partial.models ?? [],
      apiKeyEnc
    }
    if (existing) {
      cached.providers = cached.providers.map((p) => (p.id === partial.id ? next : p))
    } else {
      cached.providers = [...cached.providers, next]
    }
    if (!cached.activeId) cached.activeId = next.id
    if (!cached.activeModel && next.models[0]) cached.activeModel = next.models[0].id
    persist()
    return sanitize(cached)
  })

  ipcMain_.handle('providers:remove', (_e, id: string) => {
    cached.providers = cached.providers.filter((p) => p.id !== id)
    if (cached.activeId === id) {
      cached.activeId = cached.providers[0]?.id ?? null
      cached.activeModel = cached.providers[0]?.models[0]?.id ?? null
    }
    persist()
    return sanitize(cached)
  })

  ipcMain_.handle('providers:set-active', (_e, payload: { id: string; model?: string }) => {
    const found = cached.providers.find((p) => p.id === payload.id)
    if (!found) return sanitize(cached)
    cached.activeId = found.id
    if (payload.model) cached.activeModel = payload.model
    else if (!found.models.some((m) => m.id === (cached.activeModel ?? ''))) {
      cached.activeModel = found.models[0]?.id ?? null
    }
    persist()
    return sanitize(cached)
  })

  ipcMain_.handle('providers:test', async (_e, id: string) => {
    const cfg = cached.providers.find((p) => p.id === id)
    if (!cfg) return { ok: false, error: 'Provider not found' }
    const key = decrypt(cfg.apiKeyEnc)
    if (!key) return { ok: false, error: 'API key not set' }
    try {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/models`
      const headers: Record<string, string> =
        cfg.api === 'anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${key}` }
      const res = await fetch(url, { headers })
      return { ok: res.ok, status: res.status }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
