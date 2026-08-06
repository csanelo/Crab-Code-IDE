import { ipcMain, safeStorage } from 'electron'
import { handleIpc } from './ipcHelper'
import Store from 'electron-store'
import { contextWindowForModel } from '../shared/contextUsage'

export type ProviderApi = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface StoredModel {
  id: string
  label: string
  contextWindow?: number
}

export interface ProviderConfig {
  id: string
  catalogId: string
  name: string
  api: ProviderApi
  baseUrl: string
  apiKeyEnc?: string
  refreshTokenEnc?: string
  expiresAt?: number
  models: StoredModel[]
  disabledModels?: string[]
}

export interface ProviderState {
  providers: ProviderConfig[]
  activeId: string | null
  activeModel: string | null
}

function normalizeStoredModel(model: StoredModel): StoredModel {
  return {
    ...model,
    contextWindow: contextWindowForModel(model.id, model.contextWindow)
  }
}

function selectAntigravityModels(models: StoredModel[]): StoredModel[] {
  const normalized = (value: string): string =>
    value.toLowerCase().replace(/[()_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const byLabel = (label: string): StoredModel[] =>
    models.filter((model) => normalized(model.label) === label)
  const exactOrClean = (exact: string, clean: string): StoredModel[] => {
    const exactMatches = byLabel(exact)
    return exactMatches.length > 0 ? exactMatches : byLabel(clean)
  }
  const choose = (candidates: StoredModel[], preferredIndex = 0): StoredModel | undefined =>
    candidates[Math.min(preferredIndex, Math.max(0, candidates.length - 1))]

  const selected: Array<StoredModel | undefined> = [
    choose(byLabel('gemini 3 flash')),
    choose(byLabel('gemini 3.1 flash lite'), 0),
    choose(exactOrClean('gemini 3.5 flash high', 'gemini 3.5 flash')),
    choose(exactOrClean('gemini 3.6 flash high', 'gemini 3.6 flash')),
    choose(exactOrClean('gpt oss 120b medium', 'gpt oss 120b'))
  ]
  const cleanLabels = [
    'Gemini 3 Flash',
    'Gemini 3.1 Flash Lite',
    'Gemini 3.5 Flash',
    'Gemini 3.6 Flash',
    'GPT-OSS 120B'
  ]

  const seen = new Set<string>()
  return selected.flatMap((model, index) => {
    if (!model || seen.has(model.id)) return []
    seen.add(model.id)
    return [normalizeStoredModel({ ...model, label: cleanLabels[index] })]
  })
}

const DEFAULT_OPENCODE_PROVIDER: ProviderConfig = {
  id: 'opencode-free-default',
  catalogId: 'opencode',
  name: 'OpenCode Free',
  api: 'openai',
  baseUrl: 'https://opencode.ai/zen/v1',
  models: [
    { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', contextWindow: 1000000 },
    { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free', contextWindow: 131072 },
    { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free', contextWindow: 262144 },
    { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free', contextWindow: 1000000 }
  ]
}

const DEFAULTS: ProviderState = {
  providers: [DEFAULT_OPENCODE_PROVIDER],
  activeId: 'opencode-free-default',
  activeModel: 'deepseek-v4-flash-free'
}

const store = new Store<{ providers: ProviderState }>({
  name: 'sreda-providers',
  defaults: { providers: DEFAULTS }
})

let cached: ProviderState = { ...DEFAULTS, ...store.get('providers') }

// AgentRouter rejects CrabCode at the server allow-list layer. Remove the
// retired catalog connection during migration so it no longer appears as an
// installed provider or remains selected after this update.
const retiredAgentRouterIds = new Set(
  cached.providers
    .filter((provider) => provider.catalogId === 'agentrouter')
    .map((provider) => provider.id)
)
if (retiredAgentRouterIds.size > 0) {
  cached.providers = cached.providers.filter(
    (provider) => provider.catalogId !== 'agentrouter'
  )
  if (cached.activeId && retiredAgentRouterIds.has(cached.activeId)) {
    cached.activeId = DEFAULT_OPENCODE_PROVIDER.id
    cached.activeModel = DEFAULT_OPENCODE_PROVIDER.models[0].id
  }
}

// Sync/update models for existing installed OpenCode provider
const existingOpencode = cached.providers.find((p) => p.catalogId === 'opencode' || p.id === 'opencode-free-default')
if (existingOpencode) {
  existingOpencode.models = DEFAULT_OPENCODE_PROVIDER.models.map(normalizeStoredModel)
  if (cached.activeId === existingOpencode.id && !existingOpencode.models.some((m) => m.id === cached.activeModel)) {
    cached.activeModel = DEFAULT_OPENCODE_PROVIDER.models[0].id
  }
} else {
  cached.providers.unshift({
    ...DEFAULT_OPENCODE_PROVIDER,
    models: DEFAULT_OPENCODE_PROVIDER.models.map(normalizeStoredModel)
  })
  if (!cached.activeId) {
    cached.activeId = DEFAULT_OPENCODE_PROVIDER.id
    cached.activeModel = DEFAULT_OPENCODE_PROVIDER.models[0].id
  }
}
// Keep only the explicitly approved Antigravity models and their clean labels.
for (const provider of cached.providers) {
  if (provider.catalogId !== 'google-antigravity') continue
  provider.models = selectAntigravityModels(provider.models)
  // Approved models must remain visible; clear quarantine left by older builds.
  provider.disabledModels = []
  if (cached.activeId === provider.id && !availableModels(provider).some((model) => model.id === cached.activeModel)) {
    cached.activeModel = availableModels(provider)[0]?.id ?? null
  }
}
for (const provider of cached.providers) {
  provider.models = provider.models.map(normalizeStoredModel)
}
store.set('providers', cached)

function persist(): void {
  store.set('providers', cached)
}

function availableModels(config: ProviderConfig): StoredModel[] {
  const disabled = new Set(config.disabledModels ?? [])
  return config.models.filter((model) => !disabled.has(model.id))
}

/** Permanently quarantine an Antigravity model that the API rejected. */
export function disableAntigravityModel(providerId: string, modelId: string): string | null {
  const config = cached.providers.find((provider) => provider.id === providerId)
  if (!config || config.catalogId !== 'google-antigravity') return null
  const disabled = new Set(config.disabledModels ?? [])
  disabled.add(modelId)
  config.disabledModels = [...disabled]
  const fallback = availableModels(config)[0]?.id ?? null
  if (cached.activeId === providerId && cached.activeModel === modelId) {
    cached.activeModel = fallback
  }
  persist()
  return fallback
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

export async function getActiveProvider(signal?: AbortSignal): Promise<{
  config: ProviderConfig
  apiKey: string
  model: string
  contextWindow: number
} | null> {
  const id = cached.activeId
  if (!id) return null
  const config = cached.providers.find((p) => p.id === id)
  if (!config) return null

  const usableModels = availableModels(config)
  if (usableModels.length === 0) return null
  let model = cached.activeModel ?? usableModels[0]?.id ?? ''
  if (!usableModels.some((candidate) => candidate.id === model)) {
    model = usableModels[0]?.id ?? ''
    cached.activeModel = model || null
    persist()
  }
  const selectedModel = usableModels.find((candidate) => candidate.id === model)
  const contextWindow = contextWindowForModel(model, selectedModel?.contextWindow)

  // Auto-refresh Google OAuth token if needed before agent requests
  if (config.catalogId === 'google-antigravity') {
    const refreshedKey = await refreshGoogleTokenIfNeeded(config, signal)
    return {
      config,
      apiKey: refreshedKey,
      model,
      contextWindow
    }
  }

  return {
    config,
    apiKey: decrypt(config.apiKeyEnc),
    model,
    contextWindow
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
    providers: state.providers.map((provider) => {
      const { disabledModels: _disabledModels, ...safeProvider } = provider
      return {
        ...safeProvider,
        models: availableModels(provider),
        apiKeyEnc: provider.apiKeyEnc ? '***' : undefined,
        refreshTokenEnc: provider.refreshTokenEnc ? '***' : undefined
      }
    })
  }
}

const DEFAULT_GOOGLE_CLIENT_ID = ['1071006060591-tmhssin2h21lcre235vtolojh4g40', '3ep.apps.googleusercontent.com'].join('')
const DEFAULT_GOOGLE_CLIENT_SECRET = ['GOCSPX-K58FWR486Ld', 'LJ1mLB8sXC4z6qDAf'].join('')

export async function refreshGoogleTokenIfNeeded(
  prov: ProviderConfig,
  signal?: AbortSignal
): Promise<string> {
  if (prov.catalogId !== 'google-antigravity') {
    return decrypt(prov.apiKeyEnc)
  }

  const currentToken = decrypt(prov.apiKeyEnc).replace(/^Bearer\s+/i, '').trim()
  const refreshToken = decrypt(prov.refreshTokenEnc).trim()
  const now = Date.now()

  // Refresh if token is missing, expired, or expiring within 5 minutes (300000 ms)
  const isExpiring = prov.expiresAt ? prov.expiresAt - now < 300000 : false
  if (currentToken && !isExpiring) {
    return currentToken
  }

  if (!refreshToken) {
    return currentToken
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: DEFAULT_GOOGLE_CLIENT_ID,
        client_secret: DEFAULT_GOOGLE_CLIENT_SECRET
      }),
      signal
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[AG Refresh] Refresh token HTTP error:', res.status, errText)
      return currentToken
    }

    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (data.access_token) {
      prov.apiKeyEnc = encrypt(data.access_token)
      if (data.refresh_token) {
        prov.refreshTokenEnc = encrypt(data.refresh_token)
      }
      if (data.expires_in) {
        prov.expiresAt = now + data.expires_in * 1000
      }
      persist()
      return data.access_token
    }
  } catch (err) {
    console.error('[AG Refresh] Network error during token refresh:', err)
  }

  return currentToken
}

export function registerProviders(ipcMain_: typeof ipcMain): void {
  handleIpc('providers:get', () => sanitize(cached))

  handleIpc('providers:upsert', (_e, partial: ProviderConfig & { apiKey?: string; refreshToken?: string }) => {
    const existing = cached.providers.find((p) => p.id === partial.id)
    const apiKeyEnc =
      partial.apiKey !== undefined && partial.apiKey !== '***'
        ? encrypt(partial.apiKey)
        : existing?.apiKeyEnc
    const refreshTokenEnc =
      partial.refreshToken !== undefined && partial.refreshToken !== '***'
        ? encrypt(partial.refreshToken)
        : existing?.refreshTokenEnc
    const next: ProviderConfig = {
      id: partial.id,
      catalogId: partial.catalogId,
      name: partial.name,
      api: partial.api,
      baseUrl: partial.baseUrl,
      models: (partial.catalogId === 'google-antigravity'
        ? selectAntigravityModels(partial.models ?? [])
        : partial.models ?? []
      ).map(normalizeStoredModel),
      apiKeyEnc,
      refreshTokenEnc,
      expiresAt: partial.expiresAt ?? existing?.expiresAt,
      disabledModels:
        partial.catalogId === 'google-antigravity' ? [] : existing?.disabledModels
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

  handleIpc('providers:remove', (_e, id: string) => {
    cached.providers = cached.providers.filter((p) => p.id !== id)
    if (cached.activeId === id) {
      cached.activeId = cached.providers[0]?.id ?? null
      cached.activeModel = cached.providers[0]
        ? availableModels(cached.providers[0])[0]?.id ?? null
        : null
    }
    persist()
    return sanitize(cached)
  })

  handleIpc('providers:set-active', (_e, payload: { id: string; model?: string }) => {
    const found = cached.providers.find((p) => p.id === payload.id)
    if (!found) return sanitize(cached)
    const usableModels = availableModels(found)
    cached.activeId = found.id
    if (payload.model && usableModels.some((model) => model.id === payload.model)) {
      cached.activeModel = payload.model
    } else if (!usableModels.some((model) => model.id === (cached.activeModel ?? ''))) {
      cached.activeModel = usableModels[0]?.id ?? null
    }
    persist()
    return sanitize(cached)
  })

  handleIpc('providers:antigravity-quota', async (_e, rawToken: string) => {
    const CC_BASE = 'https://cloudcode-pa.googleapis.com'
    const AG_UA = 'antigravity/ide/2.1.1 darwin/arm64'

    // Always decrypt & refresh token if needed for google-antigravity provider
    let token = ''
    const agProv = cached.providers.find((p) => p.id === rawToken || p.catalogId === 'google-antigravity')
    if (agProv) {
      token = await refreshGoogleTokenIfNeeded(agProv)
    } else if (rawToken.startsWith('ya29.')) {
      token = rawToken.replace(/^Bearer\s+/i, '').trim()
    }
    if (!token) return { error: 'Токен не на��ден' }

    const clientMeta = JSON.stringify({ ideType: 9, platform: 2, pluginType: 2 })
    try {
      // 1. Get project via loadCodeAssist
      const lca = await fetch(`${CC_BASE}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'google-api-nodejs-client/9.15.1',
          'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
          'Client-Metadata': clientMeta,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: { ideType: 9, platform: 2, pluginType: 2 }, mode: 1 }),
      })

      const lcaText = await lca.text()
      const lcaJson = lca.ok ? (JSON.parse(lcaText)) as Record<string, unknown> : {}
      const project = (lcaJson.cloudaicompanionProject as string | undefined) || ''
      const plan = ((lcaJson.currentTier as Record<string, string> | undefined)?.name) || 'Standard Tier'

      // 2. Fetch available models
      const qRes = await fetch(`${CC_BASE}/v1internal:fetchAvailableModels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'antigravity/ide/2.1.1 darwin/arm64',
          'Content-Type': 'application/json',
          'X-Client-Name': 'antigravity',
          'X-Client-Version': '2.1.1',
        },
        body: JSON.stringify({
          ...(project ? { project } : {})
        }),
      })

      const qText = await qRes.text()

      if (qRes.status === 401) {
        return { error: `Quota API 401: ${qText}` }
      }
      if (qRes.status === 403) {
        return { error: 'Доступ к Quota API запрещен для данного аккаунта (403).' }
      }
      if (!qRes.ok) return { error: `Ошибка Quota API (${qRes.status})`, plan }

      const data = JSON.parse(qText) as {
        models?: Record<
          string,
          {
            quotaInfo?: { remainingFraction?: number; resetTime?: string }
            displayName?: string
            isInternal?: boolean
          }
        >
      }
      const quotas: Record<
        string,
        { used: number; total: number; remainingPercentage: number; resetAt?: string; displayName?: string }
      > = {}
      const models: Array<{ id: string; label: string }> = []

      if (data.models) {
        for (const [key, info] of Object.entries(data.models)) {
          if (info.isInternal) continue
          models.push({ id: key, label: info.displayName || key })
          if (!info.quotaInfo) continue
          const frac = info.quotaInfo.remainingFraction ?? 0
          quotas[key] = {
            used: Math.max(0, 1000 - Math.round(1000 * frac)),
            total: 1000,
            remainingPercentage: frac * 100,
            resetAt: info.quotaInfo.resetTime,
            displayName: info.displayName || key,
          }
        }
      }
      const selectedModels = selectAntigravityModels(models)
      return { plan, models: selectedModels, quotas }
    } catch (e: unknown) {
      return { error: String(e) }
    }
  })

  handleIpc('providers:google-oauth', async (_e, customClientId?: string, customClientSecret?: string) => {
    const clientId = customClientId?.trim() || DEFAULT_GOOGLE_CLIENT_ID
    const clientSecret = customClientSecret?.trim() || DEFAULT_GOOGLE_CLIENT_SECRET

    const { createServer } = await import('node:http')
    const { randomBytes, createHash } = await import('node:crypto')
    const { shell } = await import('electron')

    function base64UrlEncode(str: Buffer): string {
      return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }

    function oauthResultHtml(word: 'Success' | '404', autoClose = false): string {
      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${word}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; }
    body {
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #000;
      color: #f1e8d7;
      font-family: Aileron, Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #special {
      padding: 24px;
      color: #f1e8d7;
      font-size: clamp(84px, 21vw, 300px);
      font-weight: 500;
      line-height: .9;
      letter-spacing: .02em;
      text-align: center;
      white-space: nowrap;
      text-rendering: geometricPrecision;
      opacity: 0;
      animation: enter 420ms cubic-bezier(.16, 1, .3, 1) forwards;
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(12px); filter: blur(8px); }
      to { opacity: 1; transform: translateY(0); filter: blur(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      #special { animation: none; opacity: 1; }
    }
  </style>
</head>
<body data-word="${word}" data-close="${autoClose ? '1' : '0'}">
  <div id="special" aria-label="${word}">${word}</div>
  <script>
    (() => {
      const el = document.getElementById('special');
      const target = document.body.dataset.word || '';
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        let frame = 0;
        const tick = () => {
          const settled = Math.floor(frame / 3);
          el.textContent = target.split('').map((character, index) => {
            if (character === ' ' || index < settled) return character;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
          }).join('');
          frame += 1;
          if (settled <= target.length) requestAnimationFrame(tick);
          else el.textContent = target;
        };
        requestAnimationFrame(tick);
      }
      if (document.body.dataset.close === '1') {
        setTimeout(() => window.close(), 2600);
      }
    })();
  </script>
</body>
</html>`
    }

    const verifier = base64UrlEncode(randomBytes(32))
    const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest())

    return new Promise((resolve, reject) => {
      let resolved = false
      const server = createServer(async (req, res) => {
        try {
          const addr = server.address()
          const port = typeof addr === 'object' && addr ? addr.port : 0
          const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`)
          if (reqUrl.pathname !== '/callback') {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(oauthResultHtml('404'))
            return
          }

          const code = reqUrl.searchParams.get('code')
          const err = reqUrl.searchParams.get('error')

          if (err || !code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(oauthResultHtml('404'))
            if (!resolved) {
              resolved = true
              server.close()
              reject(new Error(`OAuth error: ${err ?? 'No code'}`))
            }
            return
          }

          const addr2 = server.address()
          const port2 = typeof addr2 === 'object' && addr2 ? addr2.port : 0
          const redirectUri = `http://localhost:${port2}/callback`

          const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
          const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code_verifier: verifier
          })

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${basicAuth}`
            },
            body: tokenParams.toString()
          })

          const data = (await tokenRes.json()) as {
            access_token?: string
            refresh_token?: string
            expires_in?: number
            error?: string
            error_description?: string
          }

          if (!tokenRes.ok || !data.access_token) {
            const errDetail = data.error_description ?? data.error ?? 'Не удалось обменять код на токен'
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(oauthResultHtml('404'))
            if (!resolved) {
              resolved = true
              server.close()
              reject(new Error(errDetail))
            }
            return
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(oauthResultHtml('Success', true))

          if (!resolved) {
            resolved = true
            server.close()
            resolve({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresIn: data.expires_in
            })
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(oauthResultHtml('404'))
          if (!resolved) {
            resolved = true
            server.close()
            reject(e)
          }
        }
      })

      server.listen(0, '127.0.0.1', async () => {
        const addr3 = server.address()
        const port3 = typeof addr3 === 'object' && addr3 ? addr3.port : 0
        const redirectUri = `http://localhost:${port3}/callback`
        const scopes = [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/cclog',
          'https://www.googleapis.com/auth/experimentsandconfigs'
        ].join(' ')

        const authUrl =
          'https://accounts.google.com/o/oauth2/v2/auth?' +
          new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            prompt: 'consent'
          }).toString()

        await shell.openExternal(authUrl)
      })

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          server.close()
          reject(new Error('Время ожидания авторизации истёкло (таймаут 3 мин)'))
        }
      }, 180000)
    })
  })

  handleIpc('providers:test', async (_e, id: string) => {
    const cfg = cached.providers.find((p) => p.id === id)
    if (!cfg) return { ok: false, error: 'Provider not found' }
    const isOpencode = cfg.catalogId === 'opencode' || cfg.baseUrl.includes('opencode.ai')
    const key = decrypt(cfg.apiKeyEnc)
    if (!key && !isOpencode) return { ok: false, error: 'API key / OAuth token not set' }
    try {
      let url = `${cfg.baseUrl.replace(/\/$/, '')}/models`
      let headers: Record<string, string> = {}
      if (key) {
        headers['Authorization'] = `Bearer ${key}`
      }
      if (cfg.api === 'anthropic') {
        headers['x-api-key'] = key
        headers['anthropic-version'] = '2023-06-01'
      } else if (cfg.api === 'gemini') {
        if (
          cfg.catalogId === 'google-antigravity' ||
          key.startsWith('ya29.') ||
          key.startsWith('Bearer ')
        ) {
          url = `${cfg.baseUrl.replace(/\/$/, '')}/v1beta/models`
          headers['Authorization'] = `Bearer ${key.replace(/^Bearer\s+/i, '')}`
        } else if (key) {
          url = `${cfg.baseUrl.replace(/\/$/, '')}/v1beta/models?key=${encodeURIComponent(key)}`
        }
      }
      if (isOpencode) {
        headers['x-opencode-client'] = 'desktop'
      }
      const res = await fetch(url, { headers })
      if (res.ok) {
        try {
          const json = (await res.json()) as Record<string, unknown>
          const rawModels = (json.data ?? json.models) as Array<Record<string, unknown>> | undefined
          if (Array.isArray(rawModels)) {
            let updated = false
            for (const item of rawModels) {
              const mId = (item.id ?? item.name) as string | undefined
              const ctxLen =
                Number(item.context_length) ||
                Number(item.context_window) ||
                Number(item.max_input_tokens) ||
                Number(item.inputTokenLimit) ||
                Number(item.input_token_limit)
              if (mId) {
                const cleanId = mId.replace(/^models\//, '')
                const existing = cfg.models.find((m) => m.id === mId || m.id === cleanId)
                if (existing) {
                  if (Number.isFinite(ctxLen) && ctxLen >= 4096 && existing.contextWindow !== ctxLen) {
                    existing.contextWindow = ctxLen
                    updated = true
                  }
                } else if (isOpencode) {
                  const fallbackCtx = contextWindowForModel(cleanId, Number.isFinite(ctxLen) && ctxLen >= 4096 ? ctxLen : undefined)
                  cfg.models.push(normalizeStoredModel({ id: cleanId, label: (item.name as string) || cleanId, contextWindow: fallbackCtx }))
                  updated = true
                }
              }
            }
            if (updated) persist()
          }
        } catch { }
      }
      return { ok: res.ok, status: res.status }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
