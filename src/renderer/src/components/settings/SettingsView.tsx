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
  BarChart2,
  RefreshCw
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
import antigravityLogo from '../../assets/antigravity.png'
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
  | 'providers'
  | 'usage'

interface NavItem {
  id: Section
  labelKey: TKey
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
      { id: 'providers', labelKey: 'settings.nav.providers', icon: Bot },
      { id: 'usage', labelKey: 'settings.nav.usage', icon: BarChart2 }
    ]
  }
]

function UsageSection(): JSX.Element {
  const [providers, setProviders] = useState<ProviderApi[]>([])
  const [loading, setLoading] = useState(true)
  const [usageData, setUsageData] = useState<Record<string, { plan?: string; quotas?: Record<string, { used: number; total: number; remainingPercentage: number; resetAt?: string; displayName?: string }>; error?: string; loading?: boolean }>>({})

  const fetchQuotas = useCallback(async (provs: ProviderApi[]) => {
    setLoading(true)
    const newUsage: Record<string, { plan?: string; quotas?: Record<string, { used: number; total: number; remainingPercentage: number; resetAt?: string; displayName?: string }>; error?: string; loading?: boolean }> = {}

    for (const p of provs) {
      if (p.catalogId === 'google-antigravity' && p.apiKeyEnc) {
        newUsage[p.id] = { loading: true }
      }
    }
    setUsageData({ ...newUsage })

    for (const p of provs) {
      if (p.catalogId === 'google-antigravity' && p.apiKeyEnc) {
        try {
          const res = await window.api.providers.antigravityQuota(p.id)
          newUsage[p.id] = res
        } catch (e) {
          newUsage[p.id] = { error: String(e) }
        }
        setUsageData({ ...newUsage })
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    providersService.get().then((data) => {
      setProviders(data.providers)
      fetchQuotas(data.providers)
    })
  }, [fetchQuotas])

  const agProviders = providers.filter((p) => p.catalogId === 'google-antigravity')

  return (
    <div className="settings__section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="settings__page-title" style={{ margin: 0 }}>Использование и Квоты</h1>
          <p className="settings__subtitle" style={{ margin: '4px 0 0 0' }}>Мониторинг лимитов моделей по провайдерам</p>
        </div>
        <button
          type="button"
          className="settings__connect-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-bg-subtle, rgba(255,255,255,0.06))',
            color: 'var(--color-text-main, #fff)',
            border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.1))',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer'
          }}
          onClick={() => fetchQuotas(providers)}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Обновить данные
        </button>
      </div>

      {agProviders.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <BarChart2 size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>Провайдер с отслеживанием квоты не подключен</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Подключите Google Antigravity (OAuth) в разделе «Провайдеры», чтобы отслеживать квоту каждой модели.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {agProviders.map((p) => {
            const u = usageData[p.id]
            const isProvLoading = u?.loading
            const quotas = u?.quotas ? Object.entries(u.quotas) : []

            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--color-bg-secondary, var(--color-surface, #242426))',
                  border: '1px solid var(--color-border-subtle, var(--color-border, #333336))',
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                {/* Header: Logo, Name, Email, Top Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Antigravity Logo Image */}
                    <img
                      src={antigravityLogo}
                      alt="Antigravity"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        objectFit: 'contain',
                        background: 'var(--color-bg-subtle, rgba(66, 133, 244, 0.12))',
                        padding: 4
                      }}
                    />

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--color-text-main, var(--color-text, #f4f4f5))', letterSpacing: '-0.01em' }}>
                        Antigravity
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted, #a1a1aa)', marginTop: 1 }}>
                        {p.name}
                      </div>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                      type="button"
                      title="Обновить квоту"
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-muted, #a1a1aa)', cursor: 'pointer', padding: 4 }}
                      onClick={() => fetchQuotas([p])}
                    >
                      <RefreshCw size={17} className={isProvLoading ? 'spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Quota Subheader */}
                <div style={{ fontSize: 12, color: 'var(--color-text-muted, #71717a)', fontWeight: 500 }}>
                  {quotas.length} quotas
                </div>

                {/* Error Banner */}
                {u?.error && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-error, #f87171)', fontSize: 12 }}>
                    {u.error}
                  </div>
                )}

                {/* Quotas List matching screenshot style */}
                {!isProvLoading && !u?.error && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {quotas.map(([modelId, q], idx) => {
                      const pct = Math.max(0, Math.min(100, Math.round(q.remainingPercentage)))
                      const usedVal = q.used
                      const totalVal = q.total
                      const isHigh = pct >= 40

                      return (
                        <div
                          key={modelId}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(180px, 1.8fr) minmax(200px, 2.5fr) minmax(90px, 1fr) 24px',
                            alignItems: 'center',
                            gap: 16,
                            padding: '12px 0',
                            borderTop: idx === 0 ? '1px solid var(--color-border-subtle, #2e2e32)' : '1px solid var(--color-border-subtle, #28282c)'
                          }}
                        >
                          {/* Left: Green Indicator Dot + Model Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                backgroundColor: isHigh ? 'var(--color-success, #22c55e)' : 'var(--color-warning, #f59e0b)',
                                boxShadow: isHigh ? '0 0 8px rgba(34, 197, 94, 0.6)' : '0 0 8px rgba(245, 158, 11, 0.6)',
                                flexShrink: 0
                              }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main, var(--color-text, #f4f4f5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {q.displayName || modelId}
                            </span>
                          </div>

                          {/* Center: Progress Bar + Used Count + Percentage */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* Horizontal Line Bar */}
                            <div style={{ width: '100%', height: 4, background: 'var(--color-border-subtle, #333338)', borderRadius: 2, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  backgroundColor: isHigh ? 'var(--color-success, #22c55e)' : 'var(--color-warning, #f59e0b)',
                                  borderRadius: 2,
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: 'var(--color-text-muted, #a1a1aa)', fontFamily: 'monospace' }}>
                                {usedVal} / {totalVal}
                              </span>
                              <span style={{ color: isHigh ? 'var(--color-success, #22c55e)' : 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>
                                {pct}%
                              </span>
                            </div>
                          </div>

                          {/* Reset Time */}
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #a1a1aa)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            in 2h 49m
                          </div>

                          {/* Eye / Visibility toggle icon */}
                          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--color-text-muted, #52525b)', cursor: 'pointer' }}>
                            <EyeOff size={15} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
            onClick={() => setView('ide')}
            aria-label={t('settings.close')}
            data-tip={t('settings.close')}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="settings__sidebar-title">{t('settings.title')}</span>
        </div>

        <nav className="settings__nav" aria-label={t('settings.sections')}>
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="settings__nav-group">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = section === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`settings__nav-item ${isActive ? 'settings__nav-item--active' : ''}`}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="settings__nav-icon" size={16} />
                    <span className="settings__nav-label">{t(item.labelKey)}</span>
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
          {section === 'usage' && <UsageSection />}
          {section === 'skills' && <SkillsSection />}
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
    void window.api.settings.getGeneral().then((g) => setS(g as General))
  }, [])

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

  useEffect(() => {
    void providersService.get().then(setState)
  }, [])

  async function remove(id: string): Promise<void> {
    const next = await providersService.remove(id)
    setState(next)
  }

  function startConnectFromCatalog(p: ProviderDef): void {
    setConnect({
      catalogId: p.id,
      name: p.name,
      api: p.api,
      baseUrl: p.baseUrl,
      defaultModel: p.models?.[0]
    })
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
    (p) => p.id !== 'custom' && p.id !== 'openai' && !FEATURED_IDS.includes(p.id)
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
          {state.providers.length === 0 ? (
            <Row title={t('settings.providers.none')} />
          ) : (
            state.providers.map((p, i) => (
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
      <div className="settings__group">
        <Card>
          {filtered.length === 0 ? (
            <Row title={t('settings.providers.nothingFound')} subtitle={t('settings.providers.tryAnother')} />
          ) : (
            filtered.map((p) => (
              <div key={p.id}>
                <ProviderCardRow
                  provider={p}
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
  onConnect
}: {
  provider: ProviderDef
  onConnect: () => void
}): JSX.Element {
  const t = useT()
  return (
    <div className="settings__row">
      <div className="settings__row-text">
        <div className="settings__row-title">
          {provider.name}
        </div>
        {provider.description && (
          <div className="settings__row-subtitle">{provider.description}</div>
        )}
      </div>
      <div className="settings__row-trailing">
        <button className="settings__connect-btn" type="button" onClick={onConnect}>
          <span aria-hidden="true">+</span> {t('settings.providers.connect')}
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
  const [modelId, setModelId] = useState(isEdit ? (initial.defaultModel ?? '') : '')
  const [label, setLabel] = useState(isEdit ? (initial.modelLabel ?? '') : '')
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
  const [customClientId, setCustomClientId] = useState('')
  const [oauthBusy, setOauthBusy] = useState(false)
  const [quota, setQuota] = useState<null | { plan?: string; quotas?: Record<string, { used: number; total: number; remainingPercentage: number; resetAt?: string; displayName?: string }>; error?: string }>(null)
  const [quotaBusy, setQuotaBusy] = useState(false)

  const [refreshTokenState, setRefreshTokenState] = useState('')
  const [expiresAtState, setExpiresAtState] = useState<number | undefined>(undefined)

  async function handleGoogleOAuth(): Promise<void> {
    setOauthBusy(true)
    setError(null)
    try {
      const res = (await providersService.googleOauth(customClientId)) as {
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

  async function handleCheckQuota(): Promise<void> {
    const token = apiKey.trim()
    if (!token) return
    setQuotaBusy(true)
    try {
      const res = await window.api.providers.antigravityQuota(token)
      setQuota(res)
    } finally {
      setQuotaBusy(false)
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
          {isGoogleOAuth && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(66, 133, 244, 0.1)',
                border: '1px solid rgba(66, 133, 244, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ fontSize: 13, color: '#e8eaed', fontWeight: 500 }}>
                Авторизация через Google DeepMind Antigravity OAuth 2.0
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                Вставьте свой Google OAuth Client ID (из Google Cloud Console) или нажмите «Войти через Google», чтобы авторизоваться и вставить токен доступа (`ya29...`) или API-ключ ниже.
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>OAuth Client ID (необязательно)</span>
                <input
                  type="text"
                  className="settings__input settings__input--full settings__input--mono"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  style={{ fontSize: 12 }}
                />
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="settings__connect-btn"
                  style={{
                    background: '#4285f4',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={handleGoogleOAuth}
                  disabled={oauthBusy}
                >
                  {oauthBusy ? 'Открытие браузера...' : 'Войти через Google'}
                </button>
                {apiKey.trim() && (
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#e8eaed',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontWeight: 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    onClick={handleCheckQuota}
                    disabled={quotaBusy}
                  >
                    {quotaBusy ? <RefreshCw size={14} className="spin" /> : <BarChart2 size={14} />}
                    {quotaBusy ? 'Проверка...' : 'Проверить квоту'}
                  </button>
                )}
              </div>

              {quota && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 6, background: 'rgba(0, 0, 0, 0.25)' }}>
                  {quota.error ? (
                    <div style={{ fontSize: 12, color: '#f87171' }}>{quota.error}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>
                        План: <span style={{ color: '#60a5fa' }}>{quota.plan || 'Standard'}</span>
                      </div>
                      {quota.quotas && Object.keys(quota.quotas).length > 0 ? (
                        Object.entries(quota.quotas).map(([modelKey, q]) => (
                          <div key={modelKey} style={{ fontSize: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4d4d8', marginBottom: 2 }}>
                              <span>{q.displayName || modelKey}</span>
                              <span>{q.remainingPercentage.toFixed(0)}% осталось</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.max(0, Math.min(100, q.remainingPercentage))}%`,
                                  background: q.remainingPercentage > 30 ? '#4ade80' : q.remainingPercentage > 10 ? '#facc15' : '#f87171',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 11, color: '#71717a' }}>Данные о лимитах моделей недоступны</div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
          <Button variant="ghost" onClick={() => void connect()} disabled={busy}>
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

function SkillsSection(): JSX.Element {
  const t = useT()
  const { state } = useApp()
  const root =
    state.repositories.find((r) => r.id === state.activeRepositoryId)?.path ?? null

  const [skills, setSkills] = useState<SkillRow[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback((): void => {
    void window.api.skills.list(root ?? '').then(setSkills)
  }, [root])

  useEffect(() => {
    reload()
  }, [reload])

  async function add(): Promise<void> {
    const link = url.trim()
    if (!link) return
    setAdding(true)
    setError(null)
    const res = await window.api.skills.add(root ?? '', link)
    setAdding(false)
    if (res.ok) {
      setUrl('')
      reload()
      emitAppEvent('fs:changed', undefined)
    } else {
      setError(res.error ?? 'Failed to add skill.')
    }
  }

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

      <SectionLabel>{t('settings.skills.add')}</SectionLabel>
          <div className="settings__group">
            <Card>
              <div className="settings__row settings__row--input">
                <div className="settings__row-text">
                  <div className="settings__row-title">{t('settings.skills.urlLabel')}</div>
                  <div className="settings__row-subtitle">{t('settings.skills.urlHint')}</div>
                </div>
                <input
                  className="settings__input"
                  type="url"
                  value={url}
                  placeholder="https://github.com/owner/repo"
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void add()
                  }}
                  autoComplete="off"
                />
              </div>
              <Divider />
              <div className="settings__skill-addrow">
                <button
                  type="button"
                  className="settings__btn settings__skill-add"
                  onClick={() => void add()}
                  disabled={!url.trim() || adding}
                >
                  {adding ? <Loader2 size={14} className="settings__spin" /> : <Plus size={14} />}
                  <span>{t('settings.skills.addBtn')}</span>
                </button>
              </div>
              {error && <div className="settings__skill-error" role="alert">{error}</div>}
            </Card>
          </div>

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
                          <span className="settings__skill-cmd">/{s.name}</span>
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


function AppearanceSection(): JSX.Element {
  const t = useT()
  const [themeId, setThemeId] = useState<string>(getThemeId())
  const [sounds, setSounds] = useState<boolean>(getSoundsEnabled())

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
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`settings__toggle${checked ? ' settings__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
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

