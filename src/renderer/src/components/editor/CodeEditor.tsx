import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Code2, ChevronRight, Columns2 } from 'lucide-react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { fileIcon } from '../files/iconMap'
import { ImageViewer, isImagePath } from './ImageViewer'
import { setupMonaco, languageForFile, monacoThemeFor } from '../../lib/monacoSetup'
import { getThemeId } from '../../lib/theme'
import {
  setupLsp,
  setLspRoot,
  lspDidOpen,
  lspDidChange,
  lspDidClose,
  pathToLspUri
} from '../../lib/lspClient'
import { on as onAppEvent, emit as emitAppEvent } from '../../lib/appEvents'
import { toastInfo } from '../../lib/toast'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import './CodeEditor.css'

setupMonaco()

interface OpenFile {
  path: string
  name: string
  content: string
  dirty: boolean
  original: string
  encoding: string
  conflict?: string
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

type DiffOp = { type: 'del'; line: number } | { type: 'ins'; line: number; text: string }

function diffOps(oldLines: string[], newLines: string[]): DiffOp[] {
  const m = oldLines.length
  const n = newLines.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  let cur = 0
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      i++
      j++
      cur++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', line: cur })
      i++
    } else {
      ops.push({ type: 'ins', line: cur, text: newLines[j] })
      j++
      cur++
    }
  }
  while (i < m) {
    ops.push({ type: 'del', line: cur })
    i++
  }
  while (j < n) {
    ops.push({ type: 'ins', line: cur, text: newLines[j] })
    j++
    cur++
  }
  return ops
}

function lineDiff(before: string, after: string): { added: number; removed: number; diff: string } {
  const a = before === '' ? [] : before.split('\n')
  const b = after.split('\n')
  const m = a.length
  const n = b.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const lines: string[] = []
  let added = 0
  let removed = 0
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`)
      removed++
      i++
    } else {
      lines.push(`+${b[j]}`)
      added++
      j++
    }
  }
  while (i < m) {
    lines.push(`-${a[i++]}`)
    removed++
  }
  while (j < n) {
    lines.push(`+${b[j++]}`)
    added++
  }
  let diff = lines.join('\n')
  if (diff.length > 8000) diff = diff.slice(0, 8000) + '\n…'
  return { added, removed, diff }
}

const LANGUAGES: { id: string; label: string; sample: string }[] = [
  { id: 'plaintext', label: 'Plain Text', sample: 'file.txt' },
  { id: 'typescript', label: 'TypeScript', sample: 'file.ts' },
  { id: 'javascript', label: 'JavaScript', sample: 'file.js' },
  { id: 'json', label: 'JSON', sample: 'file.json' },
  { id: 'html', label: 'HTML', sample: 'file.html' },
  { id: 'css', label: 'CSS', sample: 'file.css' },
  { id: 'scss', label: 'SCSS', sample: 'file.scss' },
  { id: 'markdown', label: 'Markdown', sample: 'file.md' },
  { id: 'python', label: 'Python', sample: 'file.py' },
  { id: 'rust', label: 'Rust', sample: 'file.rs' },
  { id: 'go', label: 'Go', sample: 'file.go' },
  { id: 'java', label: 'Java', sample: 'file.java' },
  { id: 'c', label: 'C', sample: 'file.c' },
  { id: 'cpp', label: 'C++', sample: 'file.cpp' },
  { id: 'csharp', label: 'C#', sample: 'file.cs' },
  { id: 'php', label: 'PHP', sample: 'file.php' },
  { id: 'ruby', label: 'Ruby', sample: 'file.rb' },
  { id: 'shell', label: 'Shell Script', sample: 'file.sh' },
  { id: 'yaml', label: 'YAML', sample: 'file.yaml' },
  { id: 'sql', label: 'SQL', sample: 'file.sql' },
  { id: 'xml', label: 'XML', sample: 'file.xml' },
  { id: 'swift', label: 'Swift', sample: 'file.swift' },
  { id: 'kotlin', label: 'Kotlin', sample: 'file.kt' }
]

function langLabel(id: string): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id
}

const ENCODINGS: { id: string; label: string }[] = [
  { id: 'utf8', label: 'UTF-8' },
  { id: 'utf8bom', label: 'UTF-8 with BOM' },
  { id: 'utf16le', label: 'UTF-16 LE' },
  { id: 'utf16be', label: 'UTF-16 BE' },
  { id: 'windows-1251', label: 'Windows-1251 (Cyrillic)' },
  { id: 'windows-1252', label: 'Windows-1252 (Western)' },
  { id: 'windows-1250', label: 'Windows-1250 (Central Eur.)' },
  { id: 'koi8-r', label: 'KOI8-R' },
  { id: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { id: 'iso-8859-5', label: 'ISO-8859-5 (Cyrillic)' },
  { id: 'windows-1254', label: 'Windows-1254 (Turkish)' },
  { id: 'gbk', label: 'GBK (Simplified Chinese)' },
  { id: 'big5', label: 'Big5 (Traditional Chinese)' },
  { id: 'shift_jis', label: 'Shift-JIS (Japanese)' },
  { id: 'euc-kr', label: 'EUC-KR (Korean)' }
]

function encLabel(id: string): string {
  return ENCODINGS.find((e) => e.id === id)?.label ?? id.toUpperCase()
}

export function CodeEditor(): JSX.Element {
  const t = useT()
  const { state, recordChange } = useApp()
  const repoPath =
    state.repositories.find((r) => r.id === state.activeRepositoryId)?.path ?? null
  const activeRepoId = state.activeRepositoryId
  const [files, setFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [themeId, setThemeId] = useState(getThemeId())
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [langOverride, setLangOverride] = useState<Record<string, string>>({})
  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [encPickerOpen, setEncPickerOpen] = useState(false)
  const [splitPath, setSplitPath] = useState<string | null>(null)

  const active = files.find((f) => f.path === activePath) ?? null
  const activeIsImage = active ? isImagePath(active.name) : false
  const splitFile = splitPath ? (files.find((f) => f.path === splitPath) ?? null) : null
  const activeLang = active
    ? (langOverride[active.path] ?? languageForFile(active.name))
    : 'plaintext'

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setThemeId(getThemeId())
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    setLspRoot(() => repoPath)
  }, [repoPath])

  useEffect(() => {
    emitAppEvent('editor:fileCount', { count: files.length })
  }, [files.length])

  useEffect(() => {
    if (!active || activeIsImage) return
    lspDidOpen(activeLang, active.path, active.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.path, activeLang])

  useEffect(() => {
    return onAppEvent('editor:split', ({ on }) => {
      if (!on) {
        setSplitPath(null)
        return
      }
      setSplitPath((cur) => {
        if (cur) return cur
        const other = files.find((f) => f.path !== activePath) ?? files[0]
        return other?.path ?? null
      })
    })
  }, [files, activePath])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    const relayout = (): void => {
      try {
        ed.layout()
      } catch {
      }
    }
    const ids = [0, 60, 160, 300].map((ms) => window.setTimeout(relayout, ms))
    relayout()
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [splitPath])

  const openFile = useCallback(async (path: string) => {
    const name = baseName(path)
    if (isImagePath(name)) {
      setFiles((prev) => {
        if (prev.some((f) => f.path === path)) return prev
        return [
          ...prev,
          { path, name, content: '', dirty: false, original: '', encoding: 'binary' }
        ]
      })
      setActivePath(path)
      return
    }
    const existing = await window.api.fs.readFile(path)
    if (!existing) return
    setFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev
      return [
        ...prev,
        {
          path,
          name: baseName(path),
          content: existing.content,
          dirty: false,
          original: existing.content,
          encoding: existing.encoding ?? 'utf8'
        }
      ]
    })
    setActivePath(path)
  }, [])

  useEffect(() => {
    return onAppEvent('editor:open', ({ path, line, column }) => {
      void openFile(path).then(() => {
        if (line && editorRef.current) {
          const ed = editorRef.current
          const col = column ?? 1
          requestAnimationFrame(() => {
            ed.revealLineInCenter(line)
            ed.setPosition({ lineNumber: line, column: col })
            ed.focus()
          })
        }
      })
    })
  }, [openFile])

  const editorStoreKey = activeRepoId ? `editorOpen:${activeRepoId}` : null
  const restoringRef = useRef(false)

  useEffect(() => {
    if (!editorStoreKey) {
      setFiles([])
      setActivePath(null)
      return
    }
    restoringRef.current = true
    setFiles([])
    setActivePath(null)
    let cancelled = false
    let saved: { paths?: string[]; active?: string | null; enc?: Record<string, string>; lang?: Record<string, string> } = {}
    try {
      saved = JSON.parse(localStorage.getItem(editorStoreKey) ?? '{}')
    } catch {
      saved = {}
    }
    const paths = saved.paths ?? []
    if (paths.length === 0) {
      restoringRef.current = false
      return
    }
    void Promise.all(paths.map((p) => (isImagePath(baseName(p)) ? Promise.resolve(null) : window.api.fs.readFile(p, saved.enc?.[p])))).then((results) => {
      if (cancelled) return
      const restored: OpenFile[] = paths
        .map((p, i) => {
          const r = results[i]
          if (isImagePath(baseName(p))) {
            return { path: p, name: baseName(p), content: '', dirty: false, original: '', encoding: 'binary' }
          }
          if (!r) return null
          return {
            path: r.path,
            name: baseName(r.path),
            content: r.content,
            dirty: false,
            original: r.content,
            encoding: r.encoding ?? saved.enc?.[r.path] ?? 'utf8'
          }
        })
        .filter((f): f is OpenFile => Boolean(f))
      setFiles(restored)
      if (saved.lang) setLangOverride(saved.lang)
      const active = restored.find((f) => f.path === saved.active) ?? restored[0]
      setActivePath(active?.path ?? null)
      restoringRef.current = false
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorStoreKey])

  useEffect(() => {
    if (!editorStoreKey || restoringRef.current) return
    if (files.length === 0) {
      localStorage.removeItem(editorStoreKey)
      return
    }
    const enc: Record<string, string> = {}
    for (const f of files) enc[f.path] = f.encoding
    const lang: Record<string, string> = {}
    for (const f of files) if (langOverride[f.path]) lang[f.path] = langOverride[f.path]
    localStorage.setItem(
      editorStoreKey,
      JSON.stringify({ paths: files.map((f) => f.path), active: activePath, enc, lang })
    )
  }, [files, activePath, langOverride, editorStoreKey])

  const reopenWithEncoding = useCallback(
    async (path: string, encoding: string) => {
      const res = await window.api.fs.readFile(path, encoding)
      if (!res) return
      setFiles((prev) =>
        prev.map((f) =>
          f.path === path
            ? {
                ...f,
                content: res.content,
                original: res.content,
                dirty: false,
                encoding: res.encoding ?? encoding
              }
            : f
        )
      )
    },
    []
  )

  const setSaveEncoding = useCallback((path: string, encoding: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, encoding, dirty: true } : f))
    )
  }, [])

  const resolveKeepMine = useCallback((path: string) => {
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, conflict: undefined } : f)))
  }, [])

  const resolveTakeTheirs = useCallback((path: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.path === path && f.conflict !== undefined
          ? { ...f, content: f.conflict, original: f.conflict, dirty: false, conflict: undefined }
          : f
      )
    )
  }, [])

  useEffect(() => {
    return onAppEvent('editor:reload', ({ path }) => {
      void window.api.fs.readFile(path).then((res) => {
        if (!res) {
          setFiles((prev) => prev.filter((f) => f.path !== path))
          return
        }
        setFiles((prev) =>
          prev.map((f) => {
            if (f.path !== path) return f
            if (f.dirty && f.content !== res.content) {
              return { ...f, conflict: res.content }
            }
            return { ...f, content: res.content, original: res.content, dirty: false }
          })
        )
      })
    })
  }, [])

  function updateContentFor(path: string, value: string): void {
    if (animatingRef.current) return
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: value, dirty: true } : f))
    )
    const f = files.find((x) => x.path === path)
    if (f) lspDidChange(langOverride[path] ?? languageForFile(f.name), path, value)
  }

  function updateContent(value: string): void {
    if (!active) return
    updateContentFor(active.path, value)
  }

  const save = useCallback(async (): Promise<void> => {
    const f = files.find((x) => x.path === activePath)
    if (!f || !f.dirty) return
    const res = await window.api.fs.save({ path: f.path, content: f.content, encoding: f.encoding })
    if (!res) return
    setFiles((prev) => prev.map((x) => (x.path === f.path ? { ...x, dirty: false, conflict: undefined } : x)))
    if (activeRepoId && f.content !== f.original) {
      const rel =
        repoPath && f.path.startsWith(repoPath)
          ? f.path.slice(repoPath.length).replace(/^[\\/]/, '')
          : f.name
      const { added, removed, diff } = lineDiff(f.original, f.content)
      recordChange(activeRepoId, {
        path: rel,
        added,
        removed,
        diff,
        updatedAt: Date.now(),
        before: f.original,
        existed: true
      })
    }
  }, [files, activePath, activeRepoId, repoPath, recordChange])

  const saveRef = useRef(save)
  saveRef.current = save

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null)
  const animatingRef = useRef(false)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setupLsp(monaco)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current())
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column })
    })
  }

  useEffect(() => {
    return onAppEvent('editor:agentEdit', ({ path }) => {
      if (path !== activePath) {
        void window.api.fs.readFile(path).then((res) => {
          if (!res) return
          setFiles((prev) =>
            prev.map((f) => {
              if (f.path !== path) return f
              if (f.dirty && f.content !== res.content) {
                toastInfo(`${baseName(path)} changed on disk — unsaved edits kept`)
                return { ...f, conflict: res.content }
              }
              return { ...f, content: res.content, original: res.content, dirty: false }
            })
          )
        })
        return
      }
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco || animatingRef.current) return
      const activeFile = files.find((f) => f.path === path)
      void window.api.fs.readFile(path).then((res) => {
        if (!res) return
        if (activeFile?.dirty && activeFile.content !== res.content) {
          toastInfo(`${baseName(path)} changed on disk — resolve the conflict`)
          setFiles((prev) =>
            prev.map((f) => (f.path === path ? { ...f, conflict: res.content } : f))
          )
          return
        }
        void animateToContent(editor, monaco, res.content).then(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.path === path ? { ...f, content: res.content, original: res.content, dirty: false } : f
            )
          )
        })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, files])

  async function animateToContent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monaco: any,
    next: string
  ): Promise<void> {
    animatingRef.current = true
    const model = editor.getModel()
    if (!model) {
      animatingRef.current = false
      return
    }
    const oldLines: string[] = model.getValue().split('\n')
    const newLines = next.split('\n')
    const ops = diffOps(oldLines, newLines)
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

    for (const op of ops) {
      const lineCount = model.getLineCount()
      if (op.type === 'del') {
        const lineNo = Math.min(op.line + 1, lineCount)
        const range =
          lineNo < lineCount
            ? new monaco.Range(lineNo, 1, lineNo + 1, 1)
            : new monaco.Range(lineNo - 1 > 0 ? lineNo - 1 : lineNo, lineNo - 1 > 0 ? model.getLineMaxColumn(lineNo - 1) : 1, lineNo, model.getLineMaxColumn(lineNo))
        editor.executeEdits('agent', [{ range, text: '' }])
        editor.revealLineInCenterIfOutsideViewport(Math.min(lineNo, model.getLineCount()))
        await sleep(8)
      } else {
        const lineNo = op.line + 1
        if (lineNo > lineCount) {
          const endCol = model.getLineMaxColumn(lineCount)
          editor.executeEdits('agent', [
            { range: new monaco.Range(lineCount, endCol, lineCount, endCol), text: '\n' }
          ])
        } else {
          editor.executeEdits('agent', [
            { range: new monaco.Range(lineNo, 1, lineNo, 1), text: '\n' }
          ])
        }
        const text = op.text
        if (text.length === 0) {
          await sleep(2)
        } else {
          for (let i = 0; i < text.length; i += 9) {
            const chunk = text.slice(0, i + 9)
            const r = new monaco.Range(lineNo, 1, lineNo, model.getLineMaxColumn(lineNo))
            editor.executeEdits('agent', [{ range: r, text: chunk }])
            editor.setPosition({ lineNumber: lineNo, column: chunk.length + 1 })
            editor.revealLineInCenterIfOutsideViewport(lineNo)
            await sleep(2)
          }
        }
      }
    }
    if (model.getValue() !== next) model.setValue(next)
    animatingRef.current = false
  }

  function breadcrumb(path: string): string[] {
    const norm = path.replace(/\\/g, '/')
    let rel = norm
    if (repoPath) {
      const root = repoPath.replace(/\\/g, '/').replace(/\/$/, '')
      if (norm.startsWith(root)) rel = norm.slice(root.length).replace(/^\//, '')
    }
    return rel.split('/').filter(Boolean)
  }

  function closeTab(path: string, e?: React.MouseEvent): void {
    e?.stopPropagation()
    const closing = files.find((f) => f.path === path)
    if (closing) lspDidClose(langOverride[path] ?? languageForFile(closing.name), path)
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path)
      const next = prev.filter((f) => f.path !== path)
      if (path === activePath) setActivePath((next[idx] ?? next[idx - 1] ?? next[0])?.path ?? null)
      return next
    })
  }

  if (files.length === 0) {
    return (
      <div className="ceditor ceditor--empty">
        <Code2 size={240} strokeWidth={1} className="ceditor__empty-icon" />
        <ul className="ceditor__hints">
          <li>
            <span className="ceditor__hint-label">{t('welcome.openChat')}</span>
            <span className="ceditor__hint-keys">
              <kbd>Ctrl</kbd> + <kbd>J</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.showCommands')}</span>
            <span className="ceditor__hint-keys">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.openFile')}</span>
            <span className="ceditor__hint-keys">
              <kbd>Ctrl</kbd> + <kbd>O</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.openFolder')}</span>
            <span className="ceditor__hint-keys">
              <kbd>Ctrl</kbd> + <kbd>K</kbd> <kbd>Ctrl</kbd> + <kbd>O</kbd>
            </span>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <div className="ceditor">
      <div className="ceditor__tabs">
        {files.map((f) => (
          <button
            key={f.path}
            type="button"
            className={`ceditor__tab${f.path === activePath ? ' ceditor__tab--active' : ''}${f.path === splitPath ? ' ceditor__tab--split' : ''}`}
            onClick={(e) => {
              if ((e.altKey || e.ctrlKey || e.metaKey) && files.length > 0) {
                setSplitPath(f.path)
              } else {
                setActivePath(f.path)
              }
            }}
            title={f.path}
          >
            <img src={fileIcon(f.name)} alt="" className="ceditor__tab-icon" />
            <span className="ceditor__tab-name">{f.name}</span>
            {f.dirty && <span className="ceditor__tab-dot" aria-label="unsaved" />}
            <span
              className="ceditor__tab-close"
              role="button"
              tabIndex={0}
              aria-label={t('editor.close')}
              onClick={(e) => closeTab(f.path, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') closeTab(f.path)
              }}
            >
              <X size={13} />
            </span>
          </button>
        ))}
        <div className="ceditor__tabs-spacer" />
        <button
          type="button"
          className={`ceditor__split-btn${splitPath ? ' ceditor__split-btn--on' : ''}`}
          aria-label="Split editor"
          title="Split editor"
          onClick={() => {
            if (splitPath) setSplitPath(null)
            else {
              const other = files.find((f) => f.path !== activePath) ?? files[0]
              setSplitPath(other?.path ?? null)
            }
          }}
        >
          <Columns2 size={15} />
        </button>
      </div>
      {active && (
        <div className="ceditor__breadcrumb" aria-hidden="true">
          {breadcrumb(active.path).map((seg, i, arr) => (
            <span key={i} className="ceditor__crumb">
              <span className={i === arr.length - 1 ? 'ceditor__crumb-leaf' : ''}>{seg}</span>
              {i < arr.length - 1 && <ChevronRight size={12} className="ceditor__crumb-sep" />}
            </span>
          ))}
        </div>
      )}
      {active && active.conflict !== undefined && (
        <div className="ceditor__conflict">
          <span className="ceditor__conflict-msg">
            {t('editor.conflict')}
          </span>
          <button
            type="button"
            className="ceditor__conflict-btn"
            onClick={() => resolveKeepMine(active.path)}
          >
            {t('editor.keepMine')}
          </button>
          <button
            type="button"
            className="ceditor__conflict-btn ceditor__conflict-btn--primary"
            onClick={() => resolveTakeTheirs(active.path)}
          >
            {t('editor.takeTheirs')}
          </button>
        </div>
      )}
      {active && activeIsImage && (
        <ImageViewer key={active.path} path={active.path} name={active.name} />
      )}
      {active && !activeIsImage && (
        <div className={`ceditor__panes${splitPath ? ' ceditor__panes--split' : ''}`}>
          <div className="ceditor__pane">
            <div className="ceditor__pane-editor">
              <Editor
                key={active.path}
                height="100%"
                loading={<div className="ceditor__loading">…</div>}
                theme={monacoThemeFor(themeId)}
                language={activeLang}
                path={pathToLspUri(active.path)}
                value={active.content}
                onChange={(value) => updateContent(value ?? '')}
                onMount={handleMount}
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
          </div>
          {splitPath && splitFile && (
            <div className="ceditor__pane ceditor__pane--right">
              <div className="ceditor__pane-head">
                <img src={fileIcon(splitFile.name)} alt="" className="ceditor__tab-icon" />
                <span className="ceditor__pane-name">{splitFile.name}</span>
                <button
                  type="button"
                  className="ceditor__pane-close"
                  aria-label={t('editor.close')}
                  onClick={() => setSplitPath(null)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="ceditor__pane-editor">
                <Editor
                  key={`split:${splitFile.path}`}
                  height="100%"
                  loading={<div className="ceditor__loading">…</div>}
                  theme={monacoThemeFor(themeId)}
                  language={langOverride[splitFile.path] ?? languageForFile(splitFile.name)}
                  path={pathToLspUri(splitFile.path)}
                  value={splitFile.content}
                  onChange={(value) => updateContentFor(splitFile.path, value ?? '')}
                  options={{
                    fontFamily:
                      "'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
                    fontSize: 13,
                    minimap: { enabled: false },
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
            </div>
          )}
        </div>
      )}
      {active && !activeIsImage && (
        <div className="ceditor__status">
          <span className="ceditor__status-item">
            {t('editor.lineCol', { line: cursor.line, col: cursor.col })}
          </span>
          <div className="ceditor__status-spacer" />
          <div className="ceditor__lang">
            <button
              type="button"
              className="ceditor__status-item ceditor__status-btn"
              onClick={() => setLangPickerOpen((v) => !v)}
              title={t('editor.selectLanguage')}
            >
              {langLabel(activeLang)}
            </button>
            {langPickerOpen && (
              <>
                <div className="ceditor__lang-backdrop" onClick={() => setLangPickerOpen(false)} />
                <div className="ceditor__lang-menu" role="listbox">
                  {LANGUAGES.map((l) => {
                    const current = l.id === activeLang
                    return (
                      <button
                        key={l.id}
                        type="button"
                        role="option"
                        aria-selected={current}
                        className={`ceditor__lang-item${current ? ' ceditor__lang-item--active' : ''}`}
                        onClick={() => {
                          setLangOverride((prev) => ({ ...prev, [active.path]: l.id }))
                          setLangPickerOpen(false)
                        }}
                      >
                        <img src={fileIcon(l.sample)} alt="" className="ceditor__lang-icon" />
                        <span className="ceditor__lang-label">{l.label}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <span className="ceditor__status-item">Spaces: 2</span>
          <div className="ceditor__lang">
            <button
              type="button"
              className="ceditor__status-item ceditor__status-btn"
              onClick={() => setEncPickerOpen((v) => !v)}
              title={t('editor.selectEncoding')}
            >
              {encLabel(active.encoding)}
            </button>
            {encPickerOpen && (
              <>
                <div className="ceditor__lang-backdrop" onClick={() => setEncPickerOpen(false)} />
                <div className="ceditor__lang-menu ceditor__enc-menu" role="listbox">
                  <div className="ceditor__enc-group">{t('editor.reopenWith')}</div>
                  {ENCODINGS.map((e) => (
                    <button
                      key={`open-${e.id}`}
                      type="button"
                      role="option"
                      aria-selected={e.id === active.encoding}
                      className={`ceditor__lang-item${e.id === active.encoding ? ' ceditor__lang-item--active' : ''}`}
                      onClick={() => {
                        void reopenWithEncoding(active.path, e.id)
                        setEncPickerOpen(false)
                      }}
                    >
                      <span className="ceditor__lang-label">{e.label}</span>
                    </button>
                  ))}
                  <div className="ceditor__enc-sep" />
                  <div className="ceditor__enc-group">{t('editor.saveWith')}</div>
                  {ENCODINGS.map((e) => (
                    <button
                      key={`save-${e.id}`}
                      type="button"
                      role="option"
                      className="ceditor__lang-item"
                      onClick={() => {
                        setSaveEncoding(active.path, e.id)
                        setEncPickerOpen(false)
                      }}
                    >
                      <span className="ceditor__lang-label">{e.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
