import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Loader2,
  MousePointerSquareDashed,
  RectangleHorizontal,
  FileText,
} from 'lucide-react'
import { on as onAppEvent, emit } from '../../lib/appEvents'
import {
  PICKER_SCRIPT,
  PICKER_TAKE,
  PICKER_DISABLE,
  PICKER_WHOLE_PAGE,
  PICKER_AREA_SCRIPT,
  PICKER_AREA_TAKE,
} from './blockPicker'
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
  const [picking, setPicking] = useState(false)
  const [pickingArea, setPickingArea] = useState(false)
  const [picked, setPicked] = useState(0)

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

  // Shared helper: emit blocks to composer
  function drainItems(items: Array<Record<string, unknown>>): void {
    if (!items.length) return
    setPicked((n) => n + items.length)
    for (const item of items) {
      emit('composer:block', {
        url: String(item.url ?? ''),
        title: item.title ? String(item.title) : undefined,
        selector: String(item.selector ?? ''),
        html: String(item.html ?? ''),
        css: String(item.css ?? ''),
        text: item.text ? String(item.text) : undefined,
      })
    }
  }

  // --- Element picker (click to pick a block) ---
  useEffect(() => {
    if (!picking) return
    const wv = webviewRef.current
    if (!wv) return
    let stopped = false
    void wv.executeJavaScript(PICKER_SCRIPT).catch(() => {})
    const timer = setInterval(() => {
      if (stopped) return
      wv.executeJavaScript(PICKER_TAKE)
        .then((raw: string) => {
          let items: Array<Record<string, unknown>> = []
          try { items = JSON.parse(raw || '[]') } catch { items = [] }
          drainItems(items)
        })
        .catch(() => {})
    }, 300)
    return () => {
      stopped = true
      clearInterval(timer)
      try { void wv.executeJavaScript(PICKER_DISABLE).catch(() => {}) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking])

  // Re-inject element picker after navigation.
  useEffect(() => {
    if (!picking) return
    const wv = webviewRef.current
    if (!wv) return
    const reinject = (): void => { void wv.executeJavaScript(PICKER_SCRIPT).catch(() => {}) }
    wv.addEventListener('did-finish-load', reinject)
    return () => wv.removeEventListener('did-finish-load', reinject)
  }, [picking])

  // --- Area picker (rubber-band selection) ---
  useEffect(() => {
    if (!pickingArea) return
    const wv = webviewRef.current
    if (!wv) return
    let stopped = false
    void wv.executeJavaScript(PICKER_AREA_SCRIPT).catch(() => {})
    const timer = setInterval(() => {
      if (stopped) return
      wv.executeJavaScript(PICKER_AREA_TAKE)
        .then((raw: string) => {
          let items: Array<Record<string, unknown>> = []
          try { items = JSON.parse(raw || '[]') } catch { items = [] }
          if (items.length) {
            drainItems(items)
            setPickingArea(false)
          }
        })
        .catch(() => {})
    }, 200)
    return () => {
      stopped = true
      clearInterval(timer)
      try { void wv.executeJavaScript(PICKER_DISABLE).catch(() => {}) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickingArea])

  // --- Whole page capture ---
  async function captureWholePage(): Promise<void> {
    const wv = webviewRef.current
    if (!wv) return
    try {
      const raw: string = await wv.executeJavaScript(PICKER_WHOLE_PAGE)
      let items: Array<Record<string, unknown>> = []
      try { items = JSON.parse(raw || '[]') } catch { items = [] }
      drainItems(items)
    } catch {}
  }

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
        <button
          type="button"
          className={`browserp__act browserp__pick${picking ? ' browserp__pick--on' : ''}`}
          aria-label="Pick element"
          data-tip="Click on any element to send it to the chat"
          onClick={() => { setPicking((v) => !v); setPickingArea(false); }}
        >
          <MousePointerSquareDashed size={15} />
          {picked > 0 && <span className="browserp__pick-count">{picked}</span>}
        </button>
        <button
          type="button"
          className={`browserp__act browserp__pick${pickingArea ? ' browserp__pick--on' : ''}`}
          aria-label="Select area"
          data-tip="Drag to select any area on the page"
          onClick={() => { setPickingArea((v) => !v); setPicking(false); }}
        >
          <RectangleHorizontal size={15} />
        </button>
        <button
          type="button"
          className="browserp__act"
          aria-label="Send whole page"
          data-tip="Send the entire page to the chat"
          onClick={() => void captureWholePage()}
        >
          <FileText size={14} />
        </button>
        <button type="button" className="browserp__act browserp__close" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="browserp__view">
        <webview
          ref={webviewRef}
          src={HOME}
          className="browserp__webview"
          // eslint-disable-next-line react/no-unknown-property
          allowpopups={true}
          partition="persist:crab-browser"
        />
        {picking && (
          <div className="browserp__pick-hint">Click a block to send it to the chat · Esc to stop</div>
        )}
        {title && <div className="browserp__title" aria-hidden="true">{title}</div>}
      </div>
    </div>
  )
}
