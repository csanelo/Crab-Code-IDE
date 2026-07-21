import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Server, Trash2, Pencil, ArrowLeft } from 'lucide-react'
import { useT } from '../../i18n'
import './McpModal.css'


type McpTransport = 'stdio' | 'http' | 'sse'

interface McpServer {
  id: string
  name: string
  transport: McpTransport
  enabled: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export function McpModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [editing, setEditing] = useState<McpServer | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh(): Promise<void> {
    const list = (await window.api.mcp.list()) as McpServer[]
    setServers(list)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggle(s: McpServer): Promise<void> {
    const list = (await window.api.mcp.setEnabled(s.id, !s.enabled)) as McpServer[]
    setServers(list)
  }

  async function remove(id: string): Promise<void> {
    const list = (await window.api.mcp.remove(id)) as McpServer[]
    setServers(list)
  }

  const showEditor = adding || editing !== null

  return (
    <div className="mcp-modal-backdrop" onMouseDown={onClose}>
      <div
        className="mcp-modal"
        role="dialog"
        aria-label={t('mcp.title')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mcp-modal__header">
          <div className="mcp-modal__title-wrap">
            {showEditor ? (
              <button
                type="button"
                className="mcp-modal__back"
                aria-label={t('mcp.back')}
                onClick={() => {
                  setEditing(null)
                  setAdding(false)
                }}
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Server size={16} className="mcp-modal__title-icon" />
            )}
            <div className="mcp-modal__title">
              {showEditor ? (editing ? t('mcp.editTitle') : t('mcp.addTitle')) : t('mcp.title')}
            </div>
          </div>
          <button
            type="button"
            className="mcp-modal__close"
            aria-label={t('mcp.close')}
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </header>

        {showEditor ? (
          <McpEditor
            initial={editing}
            onSaved={async () => {
              await refresh()
              setEditing(null)
              setAdding(false)
            }}
          />
        ) : (
          <>
            <div className="mcp-modal__body">
              {servers === null ? (
                <div className="mcp-modal__empty">{t('mcp.loading')}</div>
              ) : servers.length === 0 ? (
                <div className="mcp-modal__empty">
                  <div className="mcp-modal__empty-title">{t('mcp.emptyTitle')}</div>
                  <div className="mcp-modal__empty-sub">{t('mcp.emptySub')}</div>
                </div>
              ) : (
                <ul className="mcp-modal__list">
                  {servers.map((s) => (
                    <li key={s.id} className="mcp-modal__item">
                      <div className="mcp-modal__item-main">
                        <div className="mcp-modal__item-head">
                          <span className="mcp-modal__item-name">{s.name}</span>
                          <span className="mcp-modal__item-tag">{s.transport}</span>
                        </div>
                        <div className="mcp-modal__item-sub">{describe(s)}</div>
                      </div>
                      <div className="mcp-modal__item-actions">
                        <Toggle checked={s.enabled} onChange={() => void toggle(s)} />
                        <button
                          className="mcp-modal__icon-btn"
                          type="button"
                          title={t('mcp.edit')}
                          onClick={() => setEditing(s)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="mcp-modal__icon-btn"
                          type="button"
                          title={t('mcp.delete')}
                          onClick={() => void remove(s.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="mcp-modal__footer">
              <button
                type="button"
                className="mcp-modal__add-btn"
                onClick={() => setAdding(true)}
              >
                <Plus size={14} />
                {t('mcp.add')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function describe(s: McpServer): string {
  if (s.transport === 'stdio') {
    const cmd = [s.command, ...(s.args ?? [])].filter(Boolean).join(' ')
    return cmd || 'stdio'
  }
  return s.url ?? s.transport.toUpperCase()
}


function McpEditor({
  initial,
  onSaved
}: {
  initial: McpServer | null
  onSaved: () => void | Promise<void>
}): JSX.Element {
  const isNew = !initial
  const t = useT()
  const [name, setName] = useState(initial?.name ?? '')
  const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? 'stdio')
  const [command, setCommand] = useState(initial?.command ?? '')
  const [argsText, setArgsText] = useState((initial?.args ?? []).join(' '))
  const [envText, setEnvText] = useState(stringifyMap(initial?.env))
  const [url, setUrl] = useState(initial?.url ?? '')
  const [headersText, setHeadersText] = useState(stringifyMap(initial?.headers))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    setError(null)
    if (!name.trim()) return setError(t('mcp.errName'))
    if (transport === 'stdio' && !command.trim()) return setError(t('mcp.errCommand'))
    if (transport !== 'stdio' && !url.trim()) return setError(t('mcp.errUrl'))
    setBusy(true)
    try {
      await window.api.mcp.upsert({
        id: initial?.id,
        name: name.trim(),
        transport,
        enabled: initial?.enabled ?? true,
        command: command.trim() || undefined,
        args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
        env: parseMap(envText),
        url: url.trim() || undefined,
        headers: parseMap(headersText)
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const transportOptions = useMemo<{ value: McpTransport; label: string }[]>(
    () => [
      { value: 'stdio', label: 'stdio' },
      { value: 'http', label: 'HTTP' },
      { value: 'sse', label: 'SSE' }
    ],
    []
  )

  return (
    <div className="mcp-modal__body mcp-modal__editor">
      <Field label={t('mcp.name')}>
        <input
          className="mcp-modal__input"
          placeholder={t('mcp.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>

      <Field label={t('mcp.transport')}>
        <div className="mcp-modal__segmented" role="group" aria-label={t('mcp.transport')}>
          {transportOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={transport === o.value}
              className={`mcp-modal__seg${transport === o.value ? ' mcp-modal__seg--on' : ''}`}
              onClick={() => setTransport(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>

      {transport === 'stdio' ? (
        <>
          <Field label={t('mcp.command')}>
            <input
              className="mcp-modal__input mcp-modal__input--mono"
              placeholder="npx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </Field>
          <Field label={t('mcp.args')} hint={t('mcp.argsHint')}>
            <input
              className="mcp-modal__input mcp-modal__input--mono"
              placeholder="-y @modelcontextprotocol/server-github"
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
            />
          </Field>
          <Field label={t('mcp.env')} hint={t('mcp.envHint')}>
            <input
              className="mcp-modal__input mcp-modal__input--mono"
              placeholder="GITHUB_TOKEN=ghp_… DEBUG=1"
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('mcp.url')}>
            <input
              className="mcp-modal__input mcp-modal__input--mono"
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field label={t('mcp.headers')} hint={t('mcp.headersHint')}>
            <input
              className="mcp-modal__input mcp-modal__input--mono"
              placeholder="Authorization=Bearer sk-… X-Custom=1"
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
            />
          </Field>
        </>
      )}

      {error && (
        <div className="mcp-modal__error" role="alert">
          {error}
        </div>
      )}

      <div className="mcp-modal__actions">
        <button
          type="button"
          className="mcp-modal__btn mcp-modal__btn--primary"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? t('mcp.saving') : isNew ? t('mcp.add') : t('mcp.save')}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className="mcp-modal__field">
      <span className="mcp-modal__field-label">{label}</span>
      {children}
      {hint && <span className="mcp-modal__field-hint">{hint}</span>}
    </label>
  )
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
      className={`mcp-modal__toggle${checked ? ' mcp-modal__toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="mcp-modal__toggle-thumb" />
    </button>
  )
}

function stringifyMap(m: Record<string, string> | undefined): string {
  if (!m) return ''
  return Object.entries(m)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
}

function parseMap(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  text
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => {
      const eq = p.indexOf('=')
      if (eq < 0) return
      out[p.slice(0, eq)] = p.slice(eq + 1)
    })
  return out
}
