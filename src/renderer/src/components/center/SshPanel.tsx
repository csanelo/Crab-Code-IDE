import { useEffect, useState } from 'react'
import { Server, Loader2, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import { newRepository } from '../../state'

interface Host {
  id: string
  label: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  keyPath?: string
  remoteRoot: string
  hasPassword: boolean
  hasPassphrase: boolean
}

export function SshPanel({ onOpened }: { onOpened: () => void }): JSX.Element {
  const t = useT()
  const { openProjectFromFolder } = useApp()
  const [hosts, setHosts] = useState<Host[]>([])
  const [adding, setAdding] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')
  const [remoteRoot, setRemoteRoot] = useState('')

  useEffect(() => {
    void window.api.remote.list().then(setHosts)
  }, [])

  async function saveHost(): Promise<void> {
    if (!host.trim() || !username.trim()) {
      setError(t('remote.errRequired'))
      return
    }
    setError(null)
    await window.api.remote.upsert({
      label: label.trim() || host.trim(),
      host: host.trim(),
      port: Number.parseInt(port, 10) || 22,
      username: username.trim(),
      authType,
      password: authType === 'password' ? password : undefined,
      keyPath: authType === 'key' ? keyPath.trim() : undefined,
      remoteRoot: remoteRoot.trim() || '.'
    })
    setHosts(await window.api.remote.list())
    setAdding(false)
    setLabel('')
    setHost('')
    setPort('22')
    setUsername('')
    setPassword('')
    setKeyPath('')
    setRemoteRoot('')
  }

  async function connect(h: Host): Promise<void> {
    setConnecting(h.id)
    setError(null)
    const res = await window.api.remote.connect(h.id)
    setConnecting(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    openProjectFromFolder(newRepository(`${h.label} (SSH)`, res.rootPath, 'ssh'))
    onOpened()
  }

  async function removeHost(id: string): Promise<void> {
    await window.api.remote.remove(id)
    setHosts(await window.api.remote.list())
  }

  if (adding) {
    return (
      <div className="ns__gh">
        <div className="ns__gh-head">
          <Server size={15} />
          <span>{t('remote.addHost')}</span>
        </div>
        <input
          className="ns__gh-input"
          placeholder={t('remote.label')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="ns__gh-rowfields">
          <input
            className="ns__gh-input ns__gh-input--grow"
            placeholder={t('remote.host')}
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <input
            className="ns__gh-input ns__gh-input--port"
            placeholder="22"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <input
          className="ns__gh-input"
          placeholder={t('remote.username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <div className="ns__gh-authtabs">
          <button
            type="button"
            className={`ns__gh-authtab${authType === 'password' ? ' ns__gh-authtab--on' : ''}`}
            onClick={() => setAuthType('password')}
          >
            {t('remote.password')}
          </button>
          <button
            type="button"
            className={`ns__gh-authtab${authType === 'key' ? ' ns__gh-authtab--on' : ''}`}
            onClick={() => setAuthType('key')}
          >
            {t('remote.key')}
          </button>
        </div>
        {authType === 'password' ? (
          <input
            className="ns__gh-input"
            type="password"
            placeholder={t('remote.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : (
          <input
            className="ns__gh-input ns__gh-input--mono"
            placeholder={t('remote.keyPath')}
            value={keyPath}
            onChange={(e) => setKeyPath(e.target.value)}
          />
        )}
        <input
          className="ns__gh-input ns__gh-input--mono"
          placeholder={t('remote.remoteRoot')}
          value={remoteRoot}
          onChange={(e) => setRemoteRoot(e.target.value)}
        />
        {error && <div className="ns__gh-error">{error}</div>}
        <button type="button" className="ns__gh-connect" onClick={() => void saveHost()}>
          <Plus size={14} />
          <span>{t('remote.save')}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="ns__gh">
      <div className="ns__gh-head">
        <Server size={15} />
        <span>{t('remote.title')}</span>
      </div>
      {error && <div className="ns__gh-error">{error}</div>}
      <div className="ns__gh-repos">
        {hosts.length === 0 ? (
          <div className="ns__gh-empty">{t('remote.noHosts')}</div>
        ) : (
          hosts.map((h) => (
            <div key={h.id} className="ns__gh-hostrow">
              <button
                type="button"
                className="ns__gh-repo ns__gh-host"
                disabled={connecting !== null}
                onClick={() => void connect(h)}
              >
                <Server size={12} />
                <span className="ns__gh-repo-name">
                  {h.label}
                  <span className="ns__gh-hostsub">
                    {h.username}@{h.host}
                  </span>
                </span>
                {connecting === h.id && <Loader2 size={13} className="ns__spin" />}
              </button>
              <button
                type="button"
                className="ns__gh-hostdel"
                aria-label={t('remote.remove')}
                title={t('remote.remove')}
                onClick={() => void removeHost(h.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
      <button type="button" className="ns__gh-connect" onClick={() => setAdding(true)}>
        <Plus size={14} />
        <span>{t('remote.addHost')}</span>
      </button>
    </div>
  )
}
