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
  refreshTokenEnc?: string
  expiresAt?: number
  models: StoredModel[]
}

export interface ProviderState {
  providers: ProviderConfig[]
  activeId: string | null
  activeModel: string | null
}

const DEFAULT_OPENCODE_PROVIDER: ProviderConfig = {
  id: 'opencode-free-default',
  catalogId: 'opencode',
  name: 'OpenCode Free',
  api: 'openai',
  baseUrl: 'https://opencode.ai/zen/v1',
  models: [
    { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free' },
    { id: 'mimo-v2.5-free', label: 'MiMo V2.5 Free' },
    { id: 'ling-3.0-flash-free', label: 'Ling 3.0 Flash Free' },
    { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free' },
    { id: 'north-mini-code-free', label: 'North Mini Code Free' },
    { id: 'laguna-s-2.1-free', label: 'Laguna S 2.1 Free' }
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

// Sync/update models for existing installed OpenCode provider
const existingOpencode = cached.providers.find((p) => p.catalogId === 'opencode' || p.id === 'opencode-free-default')
if (existingOpencode) {
  existingOpencode.models = DEFAULT_OPENCODE_PROVIDER.models
  if (cached.activeId === existingOpencode.id && !existingOpencode.models.some((m) => m.id === cached.activeModel)) {
    cached.activeModel = DEFAULT_OPENCODE_PROVIDER.models[0].id
  }
} else {
  cached.providers.unshift(DEFAULT_OPENCODE_PROVIDER)
  if (!cached.activeId) {
    cached.activeId = DEFAULT_OPENCODE_PROVIDER.id
    cached.activeModel = DEFAULT_OPENCODE_PROVIDER.models[0].id
  }
}
store.set('providers', cached)

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

export async function getActiveProvider(): Promise<{ config: ProviderConfig; apiKey: string; model: string } | null> {
  const id = cached.activeId
  if (!id) return null
  const config = cached.providers.find((p) => p.id === id)
  if (!config) return null

  let model = cached.activeModel ?? config.models[0]?.id ?? ''
  if (config.models.length > 0 && !config.models.some((m) => m.id === model)) {
    model = config.models[0]?.id ?? ''
  }

  // Auto-refresh Google OAuth token if needed before agent requests
  if (config.catalogId === 'google-antigravity') {
    const refreshedKey = await refreshGoogleTokenIfNeeded(config)
    return {
      config,
      apiKey: refreshedKey,
      model
    }
  }

  return {
    config,
    apiKey: decrypt(config.apiKeyEnc),
    model
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
      apiKeyEnc: p.apiKeyEnc ? '***' : undefined,
      refreshTokenEnc: p.refreshTokenEnc ? '***' : undefined
    }))
  }
}

const DEFAULT_GOOGLE_CLIENT_ID = ['1071006060591-tmhssin2h21lcre235vtolojh4g40', '3ep.apps.googleusercontent.com'].join('')
const DEFAULT_GOOGLE_CLIENT_SECRET = ['GOCSPX-K58FWR486Ld', 'LJ1mLB8sXC4z6qDAf'].join('')

export async function refreshGoogleTokenIfNeeded(prov: ProviderConfig): Promise<string> {
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
      })
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
  ipcMain_.handle('providers:get', () => sanitize(cached))

  ipcMain_.handle('providers:upsert', (_e, partial: ProviderConfig & { apiKey?: string; refreshToken?: string }) => {
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
      models: partial.models ?? [],
      apiKeyEnc,
      refreshTokenEnc,
      expiresAt: partial.expiresAt ?? existing?.expiresAt
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

  ipcMain_.handle('providers:antigravity-quota', async (_e, rawToken: string) => {
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
    if (!token) return { error: 'Токен не найден' }

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

      if (data.models) {
        for (const [key, info] of Object.entries(data.models)) {
          if (!info.quotaInfo || info.isInternal) continue
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
      return { plan, quotas }
    } catch (e: unknown) {
      return { error: String(e) }
    }
  })

  ipcMain_.handle('providers:google-oauth', async (_e, customClientId?: string, customClientSecret?: string) => {
    const clientId = customClientId?.trim() || DEFAULT_GOOGLE_CLIENT_ID
    const clientSecret = customClientSecret?.trim() || DEFAULT_GOOGLE_CLIENT_SECRET

    const { createServer } = await import('node:http')
    const { randomBytes, createHash } = await import('node:crypto')
    const { shell } = await import('electron')

    function base64UrlEncode(str: Buffer): string {
      return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
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
            res.writeHead(404)
            res.end('Not Found')
            return
          }

          const code = reqUrl.searchParams.get('code')
          const err = reqUrl.searchParams.get('error')

          if (err || !code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<h2>Ошибка авторизации: ${err ?? 'коды отменены'}</h2>`)
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
            res.end(`
              <!DOCTYPE html>
              <html lang="ru">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Ошибка авторизации — CrabCode IDE</title>
                <style>
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background-color: #09090b;
                    color: #f4f4f5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 24px;
                  }
                  .card {
                    background: #18181b;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 440px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
                  }
                  .icon-wrap {
                    width: 64px;
                    height: 64px;
                    background: rgba(239, 68, 68, 0.12);
                    border-radius: 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                    color: #f87171;
                  }
                  h1 { font-size: 20px; font-weight: 600; margin-bottom: 10px; color: #ffffff; }
                  p { font-size: 14px; color: #a1a1aa; line-height: 1.5; margin-bottom: 20px; }
                  .err-box {
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 12px;
                    font-family: monospace;
                    font-size: 12px;
                    color: #fca5a5;
                    word-break: break-all;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon-wrap">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <h1>Ошибка авторизации</h1>
                  <p>Не удалось завершить вход через Google Antigravity.</p>
                  <div class="err-box">${errDetail}</div>
                </div>
              </body>
              </html>
            `)
            if (!resolved) {
              resolved = true
              server.close()
              reject(new Error(errDetail))
            }
            return
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Успешный вход — CrabCode IDE</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  background-color: #09090b;
                  color: #f4f4f5;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 24px;
                }
                .card {
                  background: #18181b;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 20px;
                  padding: 44px 36px;
                  max-width: 460px;
                  width: 100%;
                  text-align: center;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                  animation: fadeIn 0.4s ease-out;
                }
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .brand {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  width: 68px;
                  height: 68px;
                  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
                  border-radius: 18px;
                  margin-bottom: 24px;
                  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.35);
                }
                h1 {
                  font-size: 22px;
                  font-weight: 700;
                  letter-spacing: -0.02em;
                  margin-bottom: 10px;
                  color: #ffffff;
                }
                p {
                  font-size: 14px;
                  color: #a1a1aa;
                  line-height: 1.6;
                  margin-bottom: 24px;
                }
                .badge {
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  background: rgba(34, 197, 94, 0.12);
                  border: 1px solid rgba(34, 197, 94, 0.3);
                  color: #4ade80;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-size: 13px;
                  font-weight: 600;
                  margin-bottom: 24px;
                }
                .footer-text {
                  font-size: 12px;
                  color: #71717a;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="brand">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div class="badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Авторизация выполнена
                </div>
                <h1>Вход в CrabCode IDE успешен!</h1>
                <p>Google Antigravity OAuth 2.0 подключен. Токен автоматически передан и сохранён в настройках IDE.</p>
                <div class="footer-text">Вы можете закрыть эту вкладку браузера и вернуться к работе.</div>
              </div>
              <script>
                setTimeout(() => { window.close(); }, 3000);
              </script>
            </body>
            </html>
          `)

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
          res.writeHead(500)
          res.end('Server Error')
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

  ipcMain_.handle('providers:test', async (_e, id: string) => {
    const cfg = cached.providers.find((p) => p.id === id)
    if (!cfg) return { ok: false, error: 'Provider not found' }
    const key = decrypt(cfg.apiKeyEnc)
    if (!key) return { ok: false, error: 'API key / OAuth token not set' }
    try {
      let url = `${cfg.baseUrl.replace(/\/$/, '')}/models`
      let headers: Record<string, string> = { Authorization: `Bearer ${key}` }
      if (cfg.api === 'anthropic') {
        headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      } else if (cfg.api === 'gemini') {
        if (
          cfg.catalogId === 'google-antigravity' ||
          key.startsWith('ya29.') ||
          key.startsWith('Bearer ')
        ) {
          url = `${cfg.baseUrl.replace(/\/$/, '')}/v1beta/models`
          headers = { Authorization: `Bearer ${key.replace(/^Bearer\s+/i, '')}` }
        } else {
          url = `${cfg.baseUrl.replace(/\/$/, '')}/v1beta/models?key=${encodeURIComponent(key)}`
          headers = {}
        }
      }
      const res = await fetch(url, { headers })
      return { ok: res.ok, status: res.status }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
