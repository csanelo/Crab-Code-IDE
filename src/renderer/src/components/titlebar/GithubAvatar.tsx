import { useEffect, useRef, useState } from 'react'
import { Github, Loader2, LogOut } from 'lucide-react'
import { useT } from '../../i18n'
import { emit, on as onAppEvent } from '../../lib/appEvents'

interface Auth {
  connected: boolean
  login: string | null
  avatarUrl: string | null
}

export function GithubAvatar(): JSX.Element {
  const t = useT()
  const [auth, setAuth] = useState<Auth>({ connected: false, login: null, avatarUrl: null })
  const [open, setOpen] = useState(false)
  const [pat, setPat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  function refresh(): void {
    void window.api.github.getAuth().then(setAuth)
  }

  useEffect(() => {
    refresh()
    return onAppEvent('github:auth', refresh)
  }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function connect(): Promise<void> {
    const token = pat.trim()
    if (!token) return
    setBusy(true)
    setError(null)
    const res = await window.api.github.connect(token)
    setBusy(false)
    if (res.ok) {
      setPat('')
      setOpen(false)
      refresh()
      emit('github:auth', undefined)
    } else {
      setError(res.error ?? 'Connection failed')
    }
  }

  async function signOut(): Promise<void> {
    await window.api.github.disconnect()
    setOpen(false)
    refresh()
    emit('github:auth', undefined)
  }

  return (
    <div className="titlebar__gh" ref={wrapRef}>
      <button
        type="button"
        className="titlebar__gh-circle"
        aria-label="GitHub"
        title={auth.connected ? (auth.login ?? 'GitHub') : t('github.connectTitle')}
        onClick={() => setOpen((v) => !v)}
      >
        {auth.connected && auth.avatarUrl ? (
          <img src={auth.avatarUrl} alt="" className="titlebar__gh-img" />
        ) : (
          <Github size={14} />
        )}
      </button>

      {open && (
        <div className="titlebar__gh-pop" role="menu">
          {auth.connected ? (
            <>
              <div className="titlebar__gh-user">
                {auth.avatarUrl && (
                  <img src={auth.avatarUrl} alt="" className="titlebar__gh-userimg" />
                )}
                <span className="titlebar__gh-login">{auth.login}</span>
              </div>
              <button type="button" className="titlebar__gh-signout" onClick={() => void signOut()}>
                <LogOut size={13} />
                <span>{t('github.signOut')}</span>
              </button>
            </>
          ) : (
            <>
              <div className="titlebar__gh-head">
                <Github size={14} />
                <span>{t('github.connectTitle')}</span>
              </div>
              <input
                className="titlebar__gh-input"
                type="password"
                placeholder="ghp_…"
                value={pat}
                autoComplete="off"
                onChange={(e) => setPat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void connect()
                }}
              />
              {error && <div className="titlebar__gh-error">{error}</div>}
              <button
                type="button"
                className="titlebar__gh-connect"
                onClick={() => void connect()}
                disabled={busy || !pat.trim()}
              >
                {busy ? <Loader2 size={13} className="titlebar__gh-spin" /> : <Github size={13} />}
                <span>{t('github.connect')}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
