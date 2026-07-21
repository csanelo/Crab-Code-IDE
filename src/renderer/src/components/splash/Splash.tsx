<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { asset } from '../../lib/asset'
import './Splash.css'

export function Splash(): JSX.Element | null {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 3000)
    const remove = setTimeout(() => setGone(true), 3400)
    return () => {
      clearTimeout(fade)
      clearTimeout(remove)
    }
  }, [])

  if (gone) return null

  return (
    <div className={`splash${leaving ? ' splash--leaving' : ''}`}>
      <img src={asset('icon.png')} alt="CrabCode" className="splash__icon" />
      <span className="splash__tagline">Let&apos;s Build</span>
    </div>
=======
import { useRef, useState } from 'react'
import { Check, Github, Loader2 } from 'lucide-react'
import { emit } from '../../lib/appEvents'
import './Splash.css'

const TOKEN_URL =
  'https://github.com/settings/tokens/new?description=CrabCode%20Desktop&scopes=repo,workflow,user,read:org,gist,notifications'

export function Splash({ onComplete }: { onComplete: () => void }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function expand(): void {
    setExpanded(true)
    setError(null)
    window.setTimeout(() => inputRef.current?.focus(), 360)
  }

  function finish(delay = 420): void {
    setLeaving(true)
    window.setTimeout(onComplete, delay)
  }

  async function connect(): Promise<void> {
    const pat = token.trim()
    if (!pat || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.github.connect(pat)
      setBusy(false)
      if (!result.ok) {
        setError(result.error ?? 'Could not connect GitHub')
        inputRef.current?.focus()
        return
      }
      setConnected(true)
      setToken('')
      emit('github:auth', undefined)
      window.setTimeout(() => finish(), 650)
    } catch {
      setBusy(false)
      setError('Could not connect to GitHub')
      inputRef.current?.focus()
    }
  }

  return (
    <main className={`onboarding${leaving ? ' onboarding--leaving' : ''}`}>
      <section className="onboarding__content">
        <h1 className="onboarding__title">Let’s Crab Code</h1>
        <div className={`onboarding__connect${expanded ? ' onboarding__connect--expanded' : ''}`}>
          <a
            className={`onboarding__github${connected ? ' onboarding__github--connected' : ''}`}
            href={TOKEN_URL}
            target="_blank"
            rel="noreferrer"
            onClick={expand}
            aria-label="Connect GitHub"
          >
            {connected ? <Check size={12} /> : <Github size={12} />}
            <span>Connect GitHub</span>
          </a>
          <div className="onboarding__token-wrap">
            <input
              ref={inputRef}
              className="onboarding__token"
              type="password"
              value={token}
              placeholder="Paste GitHub token and press Enter"
              autoComplete="off"
              spellCheck={false}
              disabled={busy || connected}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void connect()
              }}
            />
            {busy && <Loader2 size={13} className="onboarding__spin" />}
          </div>
        </div>
        <div className={`onboarding__error${error ? ' onboarding__error--visible' : ''}`}>
          {error ?? '\u00a0'}
        </div>
        <button type="button" className="onboarding__skip" onClick={() => finish()}>
          Skip connect
        </button>
      </section>
    </main>
>>>>>>> baf0023 (release: CrabCode 0.2.8)
  )
}
