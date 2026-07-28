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
  refreshTokenEnc?: string;
  expiresAt?: number;
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
    refreshToken?: string;
    expiresAt?: number;
  }): Promise<ProvidersState> {
    const state = (await window.api.providers.upsert(config)) as ProvidersState;
    return this.publish(state);
  }

  async remove(id: string): Promise<ProvidersState> {
    const state = (await window.api.providers.remove(id)) as ProvidersState;
    return this.publish(state);
  }

  async googleOauth(
    customClientId?: string,
  ): Promise<{ accessToken?: string; authUrl?: string }> {
    if (typeof window.api?.providers?.googleOauth === "function") {
      return window.api.providers.googleOauth(customClientId) as Promise<{
        accessToken?: string;
        authUrl?: string;
      }>;
    }
    const clientId =
      customClientId?.trim() ||
      "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: "http://localhost:20128/callback",
        response_type: "code",
        scope:
          "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs",
        access_type: "offline",
        prompt: "consent",
      }).toString();
    window.open(authUrl, "_blank");
    return { authUrl };
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
