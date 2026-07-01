import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Minus, Square, Save, Code2 } from 'lucide-react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { fileIcon } from '../files/iconMap'
import { setupMonaco, languageForFile, monacoThemeFor } from '../../lib/monacoSetup'
import { getThemeId, applyThemeId } from '../../lib/theme'
import './EditorWindow.css'

setupMonaco()

interface OpenFile {
  path: string
  name: string
  content: string
  dirty: boolean
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

export function EditorWindow(): JSX.Element {
  const [files, setFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [themeId, setThemeId] = useState<string>(getThemeId())
  const isMac = window.api.window.platform === 'darwin'

  const active = files.find((f) => f.path === activePath) ?? null

  useEffect(() => {
    applyThemeId(getThemeId())
    setThemeId(getThemeId())
  }, [])

  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key === 'sreda.themeId' && e.newValue) {
        applyThemeId(e.newValue)
        setThemeId(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const openFile = useCallback(async (path: string) => {
    const existing = await window.api.fs.readFile(path)
    if (!existing) return
    setFiles((prev) => {
      const without = prev.filter((f) => f.path !== path)
      return [...without, { path, name: baseName(path), content: existing.content, dirty: false }]
    })
    setActivePath(path)
  }, [])

  useEffect(() => {
    return window.api.editor.onOpenFile((path) => {
      void openFile(path)
    })
  }, [openFile])

  function updateContent(value: string): void {
    if (!active) return
    setFiles((prev) =>
      prev.map((f) => (f.path === active.path ? { ...f, content: value, dirty: true } : f))
    )
  }

  const save = useCallback(async (): Promise<void> => {
    const f = files.find((x) => x.path === activePath)
    if (!f || !f.dirty) return
    const res = await window.api.fs.save({ path: f.path, content: f.content })
    if (res) {
      setFiles((prev) => prev.map((x) => (x.path === f.path ? { ...x, dirty: false } : x)))
    }
  }, [files, activePath])

  const saveRef = useRef(save)
  saveRef.current = save

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveRef.current()
    })
  }

  function closeTab(path: string, e?: React.MouseEvent): void {
    e?.stopPropagation()
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path)
      const next = prev.filter((f) => f.path !== path)
      if (path === activePath) {
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null
        setActivePath(fallback?.path ?? null)
      }
      return next
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  return (
    <div className="edw">
      <div className={`edw__bar${isMac ? ' edw__bar--mac' : ''}`}>
        <div className="edw__tabs">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              className={`edw__tab${f.path === activePath ? ' edw__tab--active' : ''}`}
              onClick={() => setActivePath(f.path)}
              title={f.path}
            >
              <img src={fileIcon(f.name)} alt="" className="edw__tab-icon" />
              <span className="edw__tab-name">{f.name}</span>
              {f.dirty && <span className="edw__tab-dot" aria-label="unsaved" />}
              <span
                className="edw__tab-close"
                role="button"
                tabIndex={0}
                aria-label="Close"
                onClick={(e) => closeTab(f.path, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') closeTab(f.path)
                }}
              >
                <X size={15} />
              </span>
            </button>
          ))}
        </div>
        <div className="edw__drag" />
        <div className="edw__win-controls">
          <button
            type="button"
            className="edw__win-btn edw__win-btn--save"
            aria-label="Save"
            title="Save (Ctrl+S)"
            onClick={() => void save()}
          >
            <Save size={17} />
          </button>
          {!isMac && (
            <>
              <button
                type="button"
                className="edw__win-btn"
                aria-label="Minimize"
                onClick={() => void window.api.editor.minimize()}
              >
                <Minus size={15} />
              </button>
              <button
                type="button"
                className="edw__win-btn"
                aria-label="Maximize"
                onClick={() => void window.api.editor.toggleMaximize()}
              >
                <Square size={12} />
              </button>
              <button
                type="button"
                className="edw__win-btn edw__win-btn--close"
                aria-label="Close window"
                onClick={() => void window.api.editor.close()}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {active ? (
        <div className="edw__editor">
          <Editor
            key={active.path}
            className="edw__monaco"
            height="100%"
            loading={<div className="edw__loading">…</div>}
            theme={monacoThemeFor(themeId)}
            language={languageForFile(active.name)}
            value={active.content}
            onChange={(value) => updateContent(value ?? '')}
            onMount={handleEditorMount}
            options={{
              fontFamily:
                "'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
              fontSize: 13,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderWhitespace: 'selection',
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 10 }
            }}
          />
        </div>
      ) : (
        <div className="edw__empty">
          <Code2 size={140} strokeWidth={1} className="edw__empty-icon" />
        </div>
      )}
    </div>
  )
}
