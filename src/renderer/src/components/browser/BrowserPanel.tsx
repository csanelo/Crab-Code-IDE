import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Loader2
} from 'lucide-react'
import { on as onAppEvent, emit } from '../../lib/appEvents'
import './BrowserPanel.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOME = 'https://www.google.com'

function normalizeUrl(input: string): string {
  const v = input.trim()
  if (!v) return HOME
  if (/^https?:\/\//i.test(v)) return v
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return `https://${v}`
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`
}

export function BrowserPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const webviewRef = useRef<any>(null)
  const [url, setUrl] = useState(HOME)
  const [input, setInput] = useState(HOME)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onStart = (): void => setLoading(true)
    const onStop = (): void => {
      setLoading(false)
      try {
        setCanBack(wv.canGoBack())
        setCanForward(wv.canGoForward())
        setUrl(wv.getURL())
        setInput(wv.getURL())
      } catch {
      }
    }
    const onTitle = (e: any): void => setTitle(e.title)
    const onNav = (e: any): void => {
      if (e.url) {
        setUrl(e.url)
        setInput(e.url)
      }
    }
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('page-title-updated', onTitle)
    wv.addEventListener('did-navigate', onNav)
    wv.addEventListener('did-navigate-in-page', onNav)
    return () => {
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('page-title-updated', onTitle)
      wv.removeEventListener('did-navigate', onNav)
      wv.removeEventListener('did-navigate-in-page', onNav)
    }
  }, [])

  function navigate(to: string): void {
    const target = normalizeUrl(to)
    setUrl(target)
    setInput(target)
    try {
      webviewRef.current?.loadURL(target)
    } catch {
    }
  }

  useEffect(() => {
    const offNav = onAppEvent('browser:navigate', ({ url }) => navigate(url))
    const offCap = onAppEvent('browser:capture', ({ kind, requestId }) => {
      void capture(kind).then((res) => emit('browser:captured', { requestId, ...res }))
    })
    return () => {
      offNav()
      offCap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function capture(
    kind: 'text' | 'screenshot'
  ): Promise<{ ok: boolean; data?: string; url?: string; title?: string; error?: string }> {
    const wv = webviewRef.current
    if (!wv) return { ok: false, error: 'Browser not open' }
    try {
      if (kind === 'text') {
        const text: string = await wv.executeJavaScript(
          `(() => {
            const sel = window.getSelection().toString();
            if (sel && sel.trim().length > 0) return sel;
            const main = document.querySelector('main, article') || document.body;
            return (main.innerText || '').replace(/\\n{3,}/g, '\\n\\n');
          })()`
        )
        return { ok: true, data: (text || '').slice(0, 12000), url: wv.getURL(), title: wv.getTitle() }
      } else {
        const img = await wv.capturePage()
        const dataUrl = img.toDataURL()
        return { ok: true, data: dataUrl, url: wv.getURL(), title: wv.getTitle() }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }


  return (
    <div className="browserp">
      <div className="browserp__bar">
        <button
          type="button"
          className="browserp__nav"
          disabled={!canBack}
          aria-label="Back"
          onClick={() => webviewRef.current?.goBack()}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          className="browserp__nav"
          disabled={!canForward}
          aria-label="Forward"
          onClick={() => webviewRef.current?.goForward()}
        >
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="browserp__nav"
          aria-label="Reload"
          onClick={() => webviewRef.current?.reload()}
        >
          {loading ? <Loader2 size={14} className="browserp__spin" /> : <RotateCw size={14} />}
        </button>
        <input
          className="browserp__url"
          value={input}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(input)
          }}
        />
        <button type="button" className="browserp__act browserp__close" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="browserp__view">
        {/* @ts-expect-error - webview is an Electron custom element */}
        <webview
          ref={webviewRef}
          src={HOME}
          className="browserp__webview"
          // eslint-disable-next-line react/no-unknown-property
          allowpopups="true"
          partition="persist:crab-browser"
        />
        {title && <div className="browserp__title" aria-hidden="true">{title}</div>}
      </div>
    </div>
  )
}
