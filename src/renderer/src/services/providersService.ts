<<<<<<< HEAD
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
=======
export type ProviderApi = "openai" | "anthropic" | "gemini" | "custom";

export interface StoredModel {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: string;
  catalogId: string;
  name: string;
  api: ProviderApi;
  baseUrl: string;
  apiKeyEnc?: string;
  models: StoredModel[];
}

export interface ProvidersState {
  providers: ProviderConfig[];
  activeId: string | null;
  activeModel: string | null;
}

type ProvidersListener = (state: ProvidersState) => void;

class ProvidersService {
  private listeners = new Set<ProvidersListener>();

  private publish(state: ProvidersState): ProvidersState {
    for (const listener of this.listeners) listener(state);
    return state;
  }

  subscribe(listener: ProvidersListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(): Promise<ProvidersState> {
    return window.api.providers.get() as Promise<ProvidersState>;
  }

  async upsert(config: {
    id: string;
    catalogId: string;
    name: string;
    api: ProviderApi;
    baseUrl: string;
    models: StoredModel[];
    apiKey?: string;
  }): Promise<ProvidersState> {
    const state = (await window.api.providers.upsert(config)) as ProvidersState;
    return this.publish(state);
  }

  async remove(id: string): Promise<ProvidersState> {
    const state = (await window.api.providers.remove(id)) as ProvidersState;
    return this.publish(state);
  }

  async setActive(payload: {
    id: string;
    model?: string;
  }): Promise<ProvidersState> {
    const state = (await window.api.providers.setActive(
      payload,
    )) as ProvidersState;
    return this.publish(state);
  }

  test(id: string): Promise<{ ok: boolean; status?: number; error?: string }> {
    return window.api.providers.test(id);
  }
}

export const providersService = new ProvidersService();
>>>>>>> baf0023 (release: CrabCode 0.2.8)
