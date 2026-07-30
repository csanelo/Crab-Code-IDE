import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Settings as Gear,
  Palette,
  Bot,
  Sparkles,
  ChevronDown,
  Check,
  Search,
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  X,
  Trash2,
  Plus,
  Loader2,
  Server
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useI18n, useT } from '../../i18n'
import { emit as emitAppEvent, on as onAppEvent, takeSettingsSection } from '../../lib/appEvents'
import { LANGUAGES, type Lang as UiLang, type TKey } from '../../i18n/translations'
import { applyThemeId, getThemeId } from '../../lib/theme'
import { THEMES, getThemeDef } from '../../theme/themes'
import { getSoundsEnabled, setSoundsEnabled } from '../../lib/sounds'
import { asset } from '../../lib/asset'
import { GoogleIcon, RainbowButton } from '../ui/RainbowButton'
import {
  KNOWN_PROVIDERS,
  type ProviderDef
} from '../../domain/providers'
import {
  providersService,
  type ProviderApi,
  type ProviderConfig,
  type ProvidersState
} from '../../services/providersService'
import './SettingsView.css'

type Section =
  | 'general'
  | 'appearance'
  | 'skills'
  | 'mcp'
  | 'providers'

interface NavItem {
  id: Section
  labelKey?: TKey
  label?: string
  icon: LucideIcon
  external?: string
}

interface NavGroup {
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'general', labelKey: 'settings.nav.general', icon: Gear },
      { id: 'appearance', labelKey: 'settings.nav.appearance', icon: Palette }
    ]
  },
  {
    items: [
      { id: 'skills', labelKey: 'settings.nav.skills', icon: Sparkles },
      { id: 'mcp', label: 'MCP', icon: Server },
      { id: 'providers', labelKey: 'settings.nav.providers', icon: Bot }
    ]
  }
]

export function SettingsView(): JSX.Element {
  const { setView } = useApp()
  const t = useT()
  const [section, setSection] = useState<Section>(
    () => (takeSettingsSection() as Section) ?? 'general'
  )

  useEffect(() => {
    return onAppEvent('settings:section', ({ section: s }) => {
      setSection(s as Section)
    })
  }, [])

  return (
    <section className="settings">
      <aside className="settings__sidebar">
        <div className="settings__sidebar-head">
          <button
            type="button"
            className="settings__back-arrow"
            aria-label={t('settings.close')}
            data-tip={t('settings.close')}
            onClick={() => setView('chat')}
          >
            <ArrowLeft size={15} strokeWidth={1.7} />
          </button>
          <span className="settings__sidebar-title">{t('settings.title')}</span>
        </div>
        <nav className="settings__nav" aria-label={t('settings.sections')}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="settings__nav-group">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = !item.external && section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings__nav-item${active ? ' settings__nav-item--active' : ''}`}
                    onClick={() => {
                      if (item.external) {
                        window.open(item.external, '_blank')
                      } else {
                        setSection(item.id)
                      }
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label ?? (item.labelKey ? t(item.labelKey) : item.id)}</span>
                    {item.external && (
                      <ArrowUpRight
                        size={14}
                        className="settings__nav-external"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="settings__main">
        <div key={section} className="settings__main-content">
          {section === 'general' && <GeneralSection />}
          {section === 'providers' && <ProvidersSection />}
          {section === 'skills' && <SkillsSection />}
          {section === 'mcp' && <McpSection />}
          {section === 'appearance' && <AppearanceSection />}
        </div>
      </main>
    </section>
  )
}


function GeneralSection(): JSX.Element {
  type ShellKind = 'auto' | 'cmd' | 'powershell' | 'pwsh' | 'bash' | 'gitbash'
  interface General {
    language: UiLang
    defaultShell: ShellKind
    enterToSend: boolean
    autosave: boolean
    restoreOnStart: boolean
    autoUpdate: boolean
    telemetry: boolean
    terminalAutoScroll: boolean
    richFileIcons: boolean
  }

  const t = useT()
  const { setLang } = useI18n()
  const [s, setS] = useState<General | null>(null)

  useEffect(() => {
    const reload = (): void => {
      void window.api.settings.getGeneral().then((g) => {
        setS(g as General)
        if (g?.language) setLang(g.language as UiLang)
      })
    }
    reload()
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [setLang])

  function update(patch: Partial<General>): void {
    if (!s) return
    const next = { ...s, ...patch }
    setS(next)
    void window.api.settings.setGeneral(patch as unknown as Record<string, unknown>)
  }

  if (!s) return <></>

  return (
    <>
      <header className="settings__page-header">
        <h1 className="settings__page-title">{t('settings.general.title')}</h1>
      </header>

      <SectionLabel>{t('settings.general.interface')}</SectionLabel>
      <div className="settings__group">
        <Card>
          <Row
            title={t('settings.general.language')}
            subtitle={t('settings.general.languageSub')}
            trailing={
              <Select
                value={s.language}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                onChange={(v) => {
                  update({ language: v as UiLang })
                  setLang(v as UiLang)
                }}
              />
            }
          />
          <Divider />
          <Row
            title={t('settings.general.terminal')}
            subtitle={t('settings.general.terminalSub')}
            trailing={
              <Select
                value={s.defaultShell}
                options={[
                  { value: 'auto', label: 'Auto (system default)' },
                  { value: 'cmd', label: 'cmd.exe' },
                  { value: 'powershell', label: 'PowerShell' },
                  { value: 'pwsh', label: 'PowerShell 7 (pwsh)' },
                  { value: 'bash', label: 'bash' },
                  { value: 'gitbash', label: 'Git Bash' }
                ]}
                onChange={(v) => update({ defaultShell: v as ShellKind })}
              />
            }
          />
        </Card>
      </div>

      <SectionLabel>{t('settings.general.editorTerminal')}</SectionLabel>
      <div className="settings__group">
        <Card>
          <Row
            title={t('settings.general.restore')}
            subtitle={t('settings.general.restoreSub')}
            trailing={
              <Toggle checked={s.restoreOnStart} onChange={(v) => update({ restoreOnStart: v })} />
            }
          />
          <Divider />
          <Row
            title={t('settings.general.termScroll')}
            subtitle={t('settings.general.termScrollSub')}
            trailing={
              <Toggle
                checked={s.terminalAutoScroll}
                onChange={(v) => update({ terminalAutoScroll: v })}
              />
            }
          />
        </Card>
      </div>
    </>
  )
}




interface ConnectInitial {
  editId?: string
  catalogId: string
  name: string
  api: ProviderApi
  baseUrl: string
  defaultModel?: string
  modelLabel?: string
  hasKey?: boolean
}

function ProvidersSection(): JSX.Element {
  const t = useT()
  const [state, setState] = useState<ProvidersState | null>(null)
  const [connect, setConnect] = useState<ConnectInitial | null>(null)
  const [q, setQ] = useState('')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [oauthCatalogBusy, setOauthCatalogBusy] = useState(false)

  useEffect(() => {
    void providersService.get().then(setState)
    return providersService.subscribe(setState)
  }, [])

  async function remove(id: string): Promise<void> {
    const next = await providersService.remove(id)
    setState(next)
  }

  async function startConnectFromCatalog(p: ProviderDef): Promise<void> {
    if (p.id !== 'google-antigravity') {
      setConnect({
        catalogId: p.id,
        name: p.name,
        api: p.api,
        baseUrl: p.baseUrl,
        defaultModel: p.models?.[0]
      })
      return
    }

    setCatalogError(null)
    setOauthCatalogBusy(true)
    try {
      const auth = await providersService.googleOauth()
      if (!auth.accessToken) throw new Error('Google OAuth did not return an access token.')
      const availability = await window.api.providers.antigravityQuota(auth.accessToken)
      const fallbackModels = (p.models ?? ['gemini-3-flash-agent']).map((modelId) => ({
        id: modelId,
        label: modelId
      }))
      const availableModels = availability.models?.length ? availability.models : fallbackModels
      const preferredModel = p.models?.find((modelId) =>
        availableModels.some((candidate) => candidate.id === modelId)
      )
      const model = preferredModel ?? availableModels[0]?.id ?? 'gemini-3-flash-agent'
      const id = `google-antigravity-${Date.now().toString(36)}`
      await providersService.upsert({
        id,
        catalogId: p.id,
        name: p.name,
        api: p.api,
        baseUrl: p.baseUrl,
        models: availableModels,
        apiKey: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresAt: auth.expiresIn ? Date.now() + auth.expiresIn * 1000 : undefined
      })
      const activated = await providersService.setActive({ id, model })
      setState(activated)
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e))
    } finally {
      setOauthCatalogBusy(false)
    }
  }
  function startConnectCustom(): void {
    setConnect({
      catalogId: 'custom',
      name: t('settings.providers.customName'),
      api: 'openai',
      baseUrl: ''
    })
  }
  function startEdit(p: ProviderConfig): void {
    const model = p.models[0]
    setConnect({
      editId: p.id,
      catalogId: p.catalogId,
      name: p.name,
      api: p.api,
      baseUrl: p.baseUrl,
      defaultModel: model?.id,
      modelLabel: model?.label,
      hasKey: Boolean(p.apiKeyEnc)
    })
  }

  if (!state) return <></>

  // OpenCode Free is built in and must not look like a user connection.
  const connectedProviders = state.providers.filter(
    (p) => p.catalogId !== 'opencode' && p.id !== 'opencode-free-default'
  )

  const FEATURED_IDS = ['google-antigravity', 'anthropic', 'google', 'openrouter', 'groq', 'deepseek']
  const featured = FEATURED_IDS
    .map((id) => KNOWN_PROVIDERS.find((p) => p.id === id))
    .filter((p): p is ProviderDef => Boolean(p))
  const openai = KNOWN_PROVIDERS.find((p) => p.id === 'openai')
  const customCard: ProviderDef = {
    id: 'custom',
    name: t('settings.providers.customName'),
    description: t('settings.providers.customDesc'),
    api: 'openai',
    baseUrl: ''
  }
  const rest = KNOWN_PROVIDERS.filter(
    (p) =>
      p.id !== 'custom' &&
      p.id !== 'openai' &&
      !FEATURED_IDS.includes(p.id)
  )
  const popular: ProviderDef[] = [
    ...featured,
    ...(openai ? [openai] : []),
    customCard,
    ...rest
  ]

  const query = q.trim().toLowerCase()
  const filtered = query
    ? popular.filter((p) => {
        if (p.id === 'custom') return false
        return (
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query)
        )
      })
    : popular

  return (
    <>
      <header className="settings__page-header settings__page-header--row">
        <h1 className="settings__page-title">{t('settings.providers.title')}</h1>
        <div className="settings__provider-search">
          <Search size={14} className="settings__provider-search-icon" />
          <input
            className="settings__provider-search-input"
            type="search"
            placeholder={t('settings.providers.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </header>

      <SectionLabel>{t('settings.providers.connected')}</SectionLabel>
      <div className="settings__group">
        <Card>
          {connectedProviders.length === 0 ? (
            <Row title={t('settings.providers.none')} />
          ) : (
            connectedProviders.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <Divider />}
                <Row
                  title={p.name}
                  subtitle={t('settings.providers.summary', {
                    api: p.api.toUpperCase(),
                    count: p.models.length,
                    key: p.apiKeyEnc ? t('settings.providers.keySet') : t('settings.providers.noKey')
                  })}
                  trailing={
                    <div className="settings__provider-actions">
                      <button
                        type="button"
                        className="settings__provider-action"
                        onClick={() => startEdit(p)}
                      >
                        {t('settings.providers.edit')}
                      </button>
                      <button
                        type="button"
                        className="settings__provider-action settings__provider-action--danger"
                        onClick={() => void remove(p.id)}
                      >
                        {t('settings.providers.delete')}
                      </button>
                    </div>
                  }
                />
              </div>
            ))
          )}
        </Card>
      </div>

      <SectionLabel>{t('settings.providers.popular')}</SectionLabel>
      {catalogError && <div className="settings__field-error settings__catalog-error" role="alert">{catalogError}</div>}
      <div className="settings__group">
        <Card>
          {filtered.length === 0 ? (
            <Row title={t('settings.providers.nothingFound')} subtitle={t('settings.providers.tryAnother')} />
          ) : (
            filtered.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <Divider />}
                <ProviderCardRow
                  provider={p}
                  busy={p.id === 'google-antigravity' && oauthCatalogBusy}
                  onConnect={() =>
                    p.id === 'custom' ? startConnectCustom() : startConnectFromCatalog(p)
                  }
                />
              </div>
            ))
          )}
        </Card>
      </div>

      {connect && (
        <ConnectDialog
          initial={connect}
          onCancel={() => setConnect(null)}
          onConnected={(s) => {
            setState(s)
            setConnect(null)
          }}
        />
      )}

    </>
  )
}

function ProviderCardRow({
  provider,
  onConnect,
  busy = false
}: {
  provider: ProviderDef
  onConnect: () => void | Promise<void>
  busy?: boolean
}): JSX.Element {
  const t = useT()
  return (
    <div className="settings__row">
      <div className="settings__row-text">
        <div className="settings__row-title">
          {provider.name}
        </div>
      </div>
      <div className="settings__row-trailing">
        <button
          className="settings__connect-btn"
          type="button"
          onClick={() => void onConnect()}
          disabled={busy}
        >
          {busy && <Loader2 size={13} className="settings__spin" />}
          {busy ? 'Authorizing…' : t('settings.providers.connect')}
        </button>
      </div>
    </div>
  )
}

function ConnectDialog({
  initial,
  onCancel,
  onConnected
}: {
  initial: ConnectInitial
  onCancel: () => void
  onConnected: (s: ProvidersState) => void | Promise<void>
}): JSX.Element {
  const isCustom = initial.catalogId === 'custom'
  const isEdit = Boolean(initial.editId)
  const t = useT()
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const initialModel = isEdit ? (initial.defaultModel ?? '') : ''
  const [modelId, setModelId] = useState(initialModel)
  const [label, setLabel] = useState(isEdit ? (initial.modelLabel ?? initialModel) : '')
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect(): Promise<void> {
    setError(null)
    if (isCustom && !baseUrl.trim()) {
      setError(t('settings.connect.errBaseUrl'))
      return
    }
    if (!isEdit && !apiKey.trim()) {
      setError(t('settings.connect.errKey'))
      return
    }
    if (!modelId.trim()) {
      setError(t('settings.connect.errModel'))
      return
    }
    setBusy(true)
    try {
      const id = initial.editId ?? `${initial.catalogId}-${Date.now().toString(36)}`
      await providersService.upsert({
        id,
        catalogId: initial.catalogId,
        name: initial.name,
        api: initial.api,
        baseUrl: baseUrl.trim() || initial.baseUrl,
        models: [{ id: modelId.trim(), label: label.trim() || modelId.trim() }],
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        refreshToken: refreshTokenState ? refreshTokenState : undefined,
        expiresAt: expiresAtState
      })
      const activated = await providersService.setActive({
        id,
        model: modelId.trim()
      })
      await onConnected(activated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const isGoogleOAuth = initial.catalogId === 'google-antigravity'
  const [oauthBusy, setOauthBusy] = useState(false)

  const [refreshTokenState, setRefreshTokenState] = useState('')
  const [expiresAtState, setExpiresAtState] = useState<number | undefined>(undefined)

  async function handleGoogleOAuth(): Promise<void> {
    setOauthBusy(true)
    setError(null)
    try {
      const res = (await providersService.googleOauth()) as {
        accessToken?: string
        refreshToken?: string
        expiresIn?: number
      }
      if (res?.accessToken) {
        setApiKey(res.accessToken)
        if (res.refreshToken) {
          setRefreshTokenState(res.refreshToken)
        }
        if (res.expiresIn) {
          setExpiresAtState(Date.now() + res.expiresIn * 1000)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOauthBusy(false)
    }
  }



  return (
    <div className="settings__modal-backdrop" onMouseDown={onCancel}>
      <div
        className="settings__modal settings__modal--connect"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={initial.name}
      >
        <div className="settings__modal-header">
          <div className="settings__modal-title">{initial.name}</div>
          <button
            type="button"
            className="settings__modal-close"
            aria-label={t('mcp.close')}
            onClick={onCancel}
          >
            <X size={22} />
          </button>
        </div>

        <div className="settings__modal-body">
          {isGoogleOAuth && !isEdit && (
            <div className="settings__google-auth-row">
              <RainbowButton
                className="settings__google-auth-button"
                onClick={handleGoogleOAuth}
                disabled={oauthBusy}
                aria-label="Google Auth"
              >
                {oauthBusy ? (
                  <Loader2 size={16} className="settings__spin" />
                ) : (
                  <GoogleIcon size={17} />
                )}
                <span>Google Auth</span>
                {apiKey.trim() && !oauthBusy && (
                  <Check size={14} className="settings__google-auth-check" aria-label="Подключено" />
                )}
              </RainbowButton>
            </div>
          )}

          {isCustom && (
            <label className="settings__field-block">
              <span className="settings__field-label">{t('settings.connect.baseUrl')}</span>
              <input
                className="settings__input settings__input--full settings__input--mono"
                placeholder="https://api.example.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoFocus
                autoComplete="off"
              />
              <span className="settings__field-hint">
                {t('settings.connect.baseUrlHint')}
              </span>
            </label>
          )}

          <label className="settings__field-block">
            <span className="settings__field-label">{t('settings.connect.apiKey')}</span>
            <div className="settings__input-wrap">
              <input
                type={showKey ? 'text' : 'password'}
                className="settings__input settings__input--full settings__input--with-action"
                placeholder={isEdit ? t('settings.connect.apiKeyEdit') : 'sk-…'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoFocus={!isCustom}
                autoComplete="off"
              />
              <button
                type="button"
                className="settings__input-action"
                aria-label={showKey ? t('settings.connect.hide') : t('settings.connect.show')}
                data-tip={showKey ? t('settings.connect.hide') : t('settings.connect.show')}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <label className="settings__field-block">
            <span className="settings__field-label">{t('settings.connect.modelId')}</span>
            <input
              className="settings__input settings__input--full settings__input--mono"
              placeholder={t('settings.connect.modelIdPlaceholder')}
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value)
                if (!label || label === modelId) setLabel(e.target.value)
              }}
            />
          </label>

          <label className="settings__field-block">
            <span className="settings__field-label">{t('settings.connect.displayName')}</span>
            <input
              className="settings__input settings__input--full"
              placeholder={t('settings.connect.namePlaceholder')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <span className="settings__field-hint">
              {t('settings.connect.displayNameHint')}
            </span>
          </label>

          {error && (
            <div className="settings__field-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="settings__modal-footer">
          <Button variant="primary" onClick={() => void connect()} disabled={busy}>
            {busy
              ? isEdit
                ? t('settings.connect.saving')
                : t('settings.connect.connecting')
              : isEdit
                ? t('settings.connect.save')
                : t('settings.connect.connect')}
          </Button>
        </div>
      </div>
    </div>
  )
}


interface SkillRow {
  name: string
  description: string
  path: string
}

type McpTransport = 'stdio' | 'http' | 'sse'

interface McpServer {
  id: string
  name: string
  transport: McpTransport
  enabled: boolean
  command?: string
  args?: string[]
  url?: string
}

function SkillsSection(): JSX.Element {
  const t = useT()
  const { state } = useApp()
  const root =
    state.repositories.find((r) => r.id === state.activeRepositoryId)?.path ?? null

  const [skills, setSkills] = useState<SkillRow[]>([])

  const reload = useCallback((): void => {
    void window.api.skills.list(root ?? '').then(setSkills)
  }, [root])

  useEffect(() => {
    reload()
  }, [reload])

  async function remove(name: string): Promise<void> {
    const ok = await window.api.skills.remove(root ?? '', name)
    if (ok) {
      reload()
      emitAppEvent('fs:changed', undefined)
    }
  }

  return (
    <>
      <header className="settings__page-header">
        <h1 className="settings__page-title">{t('settings.nav.skills')}</h1>
        <p className="settings__page-sub">{t('settings.skills.sub')}</p>
      </header>

      <SectionLabel>{t('settings.skills.installed', { n: String(skills.length) })}</SectionLabel>
      <div className="settings__group">
        <Card>
          {skills.length === 0 ? (
            <Row
              title={t('settings.skills.emptyTitle')}
              subtitle={t('settings.skills.emptySub')}
            />
          ) : (
            skills.map((s, i) => (
              <div key={s.name}>
                {i > 0 && <Divider />}
                <div className="settings__row">
                  <div className="settings__skill-icon" aria-hidden="true">
                    <img src={asset('skills.png')} alt="" className="settings__skill-img" />
                  </div>
                  <div className="settings__row-text">
                    <div className="settings__row-title">
                      <span className="settings__skill-cmd">{s.name}</span>
                    </div>
                  </div>
                  <div className="settings__row-trailing">
                    <button
                      type="button"
                      className="settings__icon-btn"
                      data-tip={t('settings.skills.remove')}
                      aria-label={t('settings.skills.remove')}
                      onClick={() => void remove(s.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  )
}

function McpSection(): JSX.Element {
  const t = useT()
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const reload = useCallback((): void => {
    void window.api.mcp.list().then((items) => setServers(items as McpServer[]))
  }, [])

  useEffect(() => {
    reload()
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [reload])

  async function toggleServer(server: McpServer): Promise<void> {
    if (switchingId) return
    setSwitchingId(server.id)
    try {
      const items = await window.api.mcp.setEnabled(server.id, !server.enabled)
      setServers(items as McpServer[])
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <>
      <header className="settings__page-header">
        <h1 className="settings__page-title">{t('mcp.title')}</h1>
        <p className="settings__page-sub">{t('settings.mcp.sub')}</p>
      </header>

      <SectionLabel>
        {t('settings.mcp.connected', { n: String(servers?.length ?? 0) })}
      </SectionLabel>
      <div className="settings__group">
        <Card>
          {servers === null ? (
            <Row title={t('mcp.loading')} />
          ) : servers.length === 0 ? (
            <Row title={t('mcp.emptyTitle')} subtitle={t('settings.mcp.emptySub')} />
          ) : (
            servers.map((server, index) => (
              <div key={server.id}>
                {index > 0 && <Divider />}
                <div className="settings__row settings__mcp-row">
                  <img
                    className="settings__mcp-favicon"
                    src={asset('mcp.png')}
                    alt=""
                    aria-hidden="true"
                  />
                  <div className="settings__row-text">
                    <div className="settings__mcp-title-line">
                      <span className="settings__row-title">{server.name}</span>
                    </div>
                    <div className="settings__row-subtitle settings__mcp-address">
                      {describeMcp(server)}
                    </div>
                  </div>
                  <div className="settings__row-trailing">
                    <div className="settings__mcp-switch">
                      <Toggle
                        checked={server.enabled}
                        onChange={() => void toggleServer(server)}
                        disabled={switchingId === server.id}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  )
}

function describeMcp(server: McpServer): string {
  if (server.transport === 'stdio') {
    return [server.command, ...(server.args ?? [])].filter(Boolean).join(' ') || 'stdio'
  }
  return server.url ?? server.transport.toUpperCase()
}


function AppearanceSection(): JSX.Element {
  const t = useT()
  const [themeId, setThemeId] = useState<string>(getThemeId())
  const [sounds, setSounds] = useState<boolean>(getSoundsEnabled())

  useEffect(() => {
    const refresh = (): void => {
      setThemeId(getThemeId())
      setSounds(getSoundsEnabled())
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  function update(next: string): void {
    setThemeId(next)
    applyThemeId(next)
    const def = getThemeDef(next)
    void window.api.settings.setGeneral({ themeId: next, theme: def.base })
  }

  function updateSounds(next: boolean): void {
    setSounds(next)
    setSoundsEnabled(next)
  }

  const options = [
    ...THEMES.filter((th) => th.base === 'dark').map((th) => ({
      value: th.id,
      label: `${th.name}`
    })),
    ...THEMES.filter((th) => th.base === 'light').map((th) => ({
      value: th.id,
      label: `${th.name}`
    }))
  ]

  return (
    <>
      <header className="settings__page-header">
        <h1 className="settings__page-title">{t('settings.appearance.title')}</h1>
      </header>

      <SectionLabel>{t('settings.appearance.theme')}</SectionLabel>
      <div className="settings__group">
        <Card>
          <Row
            title={t('settings.appearance.theme')}
            subtitle={t('settings.appearance.themeSub')}
            trailing={
              <Select
                value={themeId}
                options={options}
                onChange={(v) => update(v)}
                onPreview={(v) => applyThemeId(v)}
              />
            }
          />
          <Divider />
          <Row
            title={t('settings.appearance.sound')}
            subtitle={t('settings.appearance.soundSub')}
            trailing={<Toggle checked={sounds} onChange={updateSounds} />}
          />
        </Card>
      </div>
    </>
  )
}



function Card({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="settings__card">{children}</div>
}

function Divider(): JSX.Element {
  return <div className="settings__row-divider" />
}

function Row({
  title,
  subtitle,
  trailing
}: {
  title: string
  subtitle?: string
  trailing?: React.ReactNode
}): JSX.Element {
  return (
    <div className="settings__row">
      <div className="settings__row-text">
        <div className="settings__row-title">{title}</div>
        {subtitle && <div className="settings__row-subtitle">{subtitle}</div>}
      </div>
      {trailing && <div className="settings__row-trailing">{trailing}</div>}
    </div>
  )
}

function RowInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  type?: 'text' | 'password' | 'url'
}): JSX.Element {
  return (
    <div className="settings__row settings__row--input">
      <div className="settings__row-text">
        <div className="settings__row-title">{label}</div>
        {hint && <div className="settings__row-subtitle">{hint}</div>}
      </div>
      <input
        className="settings__input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="settings__section-label">{children}</div>
}

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`settings__toggle${checked ? ' settings__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="settings__toggle-thumb" />
    </button>
  )
}

function Button({
  variant = 'ghost',
  children,
  onClick,
  disabled = false
}: {
  variant?: 'ghost' | 'primary'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      className={`settings__btn settings__btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function Select<T extends string>({
  value,
  options,
  onChange,
  onPreview
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  onPreview?: (v: T) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const committedRef = useRef<T>(value)
  const [pos, setPos] = useState<{ top: number; right: number; minWidth: number }>({
    top: 0,
    right: 0,
    minWidth: 240
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  function reposition(): void {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    setPos({
      top: r.bottom + 4,
      right: window.innerWidth - r.right,
      minWidth: Math.max(r.width, 240)
    })
  }

  useEffect(() => {
    if (!open) return
    committedRef.current = value
    reposition()
    function onDown(e: MouseEvent): void {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      onPreview?.(committedRef.current)
      setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onPreview?.(committedRef.current)
        setOpen(false)
      }
    }
    function onResize(): void {
      reposition()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="settings__select-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="settings__select-trigger"
        onClick={() => {
          if (open) onPreview?.(committedRef.current)
          setOpen((v) => !v)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="settings__select-value">{current?.label ?? ''}</span>
        <ChevronDown
          size={14}
          className={`settings__select-chevron${open ? ' settings__select-chevron--open' : ''}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="settings__select-menu"
            role="listbox"
            style={{ top: pos.top, right: pos.right, minWidth: pos.minWidth }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`settings__select-option${o.value === value ? ' settings__select-option--selected' : ''}`}
                onMouseEnter={() => onPreview?.(o.value)}
                onFocus={() => onPreview?.(o.value)}
                onClick={() => {
                  committedRef.current = o.value
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                <span className="settings__select-option-label">{o.label}</span>
                {o.value === value && <Check size={14} />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
