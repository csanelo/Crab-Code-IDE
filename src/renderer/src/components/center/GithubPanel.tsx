import { useEffect, useState } from 'react'
import { Github, Loader2, Lock } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import { newRepository } from '../../state'
import { emit, on as onAppEvent } from '../../lib/appEvents'

interface Repo {
  fullName: string
  name: string
  owner: string
  cloneUrl: string
  private: boolean
  description: string | null
  updatedAt: string
}

export function GithubPanel({ onOpened }: { onOpened: () => void }): JSX.Element {
  const t = useT()
  const { openProjectFromFolder } = useApp()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [pat, setPat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [cloning, setCloning] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void window.api.github.getAuth().then((a) => {
      setConnected(a.connected)
      if (a.connected) void loadRepos()
    })
    return onAppEvent('github:auth', () => {
      void window.api.github.getAuth().then((a) => {
        setConnected(a.connected)
        if (a.connected) void loadRepos()
        else setRepos([])
      })
    })
  }, [])

  async function loadRepos(): Promise<void> {
    setLoadingRepos(true)
    setError(null)
    const res = await window.api.github.listRepos()
    setLoadingRepos(false)
    if (res.ok) setRepos(res.repos)
    else setError(res.error ?? 'Failed to load repositories')
  }

  async function connect(): Promise<void> {
    const token = pat.trim()
    if (!token) return
    setBusy(true)
    setError(null)
    const res = await window.api.github.connect(token)
    setBusy(false)
    if (res.ok) {
      setConnected(true)
      setPat('')
      void loadRepos()
      emit('github:auth', undefined)
    } else {
      setError(res.error ?? 'Connection failed')
    }
  }

  async function clone(repo: Repo): Promise<void> {
    setCloning(repo.fullName)
    setError(null)
    const res = await window.api.github.clone({ fullName: repo.fullName, cloneUrl: repo.cloneUrl })
    setCloning(null)
    if ('error' in res) {
      setError(res.error)
      return
    }
    openProjectFromFolder(newRepository(repo.fullName, res.path, 'github'))
    onOpened()
  }

  if (connected === null) {
    return (
      <div className="ns__gh-state">
        <Loader2 size={16} className="ns__spin" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="ns__gh">
        <div className="ns__gh-head">
          <Github size={15} />
          <span>{t('github.connectTitle')}</span>
        </div>
        <p className="ns__gh-hint">{t('github.patHint')}</p>
        <input
          className="ns__gh-input"
          type="password"
          placeholder="ghp_…"
          value={pat}
          autoComplete="off"
          onChange={(e) => setPat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void connect()
          }}
        />
        <a
          className="ns__gh-link"
          href="https://github.com/settings/tokens/new?scopes=repo&description=CrabCode"
          target="_blank"
          rel="noreferrer"
        >
          {t('github.createToken')}
        </a>
        {error && <div className="ns__gh-error">{error}</div>}
        <button
          type="button"
          className="ns__gh-connect"
          onClick={() => void connect()}
          disabled={busy || !pat.trim()}
        >
          {busy ? <Loader2 size={14} className="ns__spin" /> : <Github size={14} />}
          <span>{t('github.connect')}</span>
        </button>
      </div>
    )
  }

  const filtered = query.trim()
    ? repos.filter((r) => r.fullName.toLowerCase().includes(query.trim().toLowerCase()))
    : repos

  return (
    <div className="ns__gh">
      <input
        className="ns__gh-input"
        type="search"
        placeholder={t('github.searchRepos')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <div className="ns__gh-error">{error}</div>}
      <div className="ns__gh-repos">
        {loadingRepos ? (
          <div className="ns__gh-state">
            <Loader2 size={16} className="ns__spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ns__gh-empty">{t('github.noRepos')}</div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.fullName}
              type="button"
              className="ns__gh-repo"
              disabled={cloning !== null}
              onClick={() => void clone(r)}
            >
              {r.private ? <Lock size={12} /> : <Github size={12} />}
              <span className="ns__gh-repo-name">{r.fullName}</span>
              {cloning === r.fullName && <Loader2 size={13} className="ns__spin" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
