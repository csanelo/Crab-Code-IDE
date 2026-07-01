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

export interface ProvidersState {
  providers: ProviderConfig[]
  activeId: string | null
  activeModel: string | null
}

class ProvidersService {
  get(): Promise<ProvidersState> {
    return window.api.providers.get() as Promise<ProvidersState>
  }

  async upsert(config: {
    id: string
    catalogId: string
    name: string
    api: ProviderApi
    baseUrl: string
    models: StoredModel[]
    apiKey?: string
  }): Promise<ProvidersState> {
    return (await window.api.providers.upsert(config)) as ProvidersState
  }

  async remove(id: string): Promise<ProvidersState> {
    return (await window.api.providers.remove(id)) as ProvidersState
  }

  async setActive(payload: { id: string; model?: string }): Promise<ProvidersState> {
    return (await window.api.providers.setActive(payload)) as ProvidersState
  }

  test(id: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    return window.api.providers.test(id)
  }
}

export const providersService = new ProvidersService()
