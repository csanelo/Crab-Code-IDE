import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronRight, Columns2, ArrowUp } from 'lucide-react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { fileIcon } from '../files/iconMap'
import { asset } from '../../lib/asset'
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
import {
  addPendingEdit,
  getPendingEditFor,
  removePendingEdit,
  subscribePendingEdits,
  type PendingEdit
} from '../../lib/pendingEdits'
import { toastInfo } from '../../lib/toast'
import { setDirtyFiles } from '../../lib/dirtyFiles'
import { SaveDialog } from '../ui/SaveDialog'
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
  const [sel, setSel] = useState<{
    top: number
    left: number
    startLine: number
    endLine: number
  } | null>(null)
  const [quickEdit, setQuickEdit] = useState<{
    top: number
    left: number
    startLine: number
    endLine: number
  } | null>(null)
  const [quickPrompt, setQuickPrompt] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const quickInputRef = useRef<HTMLTextAreaElement | null>(null)
  const quickReqRef = useRef<string | null>(null)
  const quickCleanupRef = useRef<(() => void) | null>(null)
  const [pending, setPending] = useState<{ id: string; top: number } | null>(null)
  const pendingRef = useRef<{
    id: string
    path: string
    startLine: number
    endLine: number
    before: string
    fileBefore: string
  } | null>(null)
  const decorRef = useRef<string[]>([])
  const zoneRef = useRef<string | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  // Each tab has its own keyed Monaco instance; use this to restore review UI
  // only after the newly selected file's editor has mounted.
  const [editorMountVersion, setEditorMountVersion] = useState(0)
  const [askClose, setAskClose] = useState<{ path: string; name: string } | null>(
    null
  )
  const acceptRef = useRef<() => void>(() => {})
  const rejectRef = useRef<() => void>(() => {})

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

  // Records an edit into the project "Changes" list without waiting for a save.
  const recordFileChange = useCallback(
    (absPath: string, before: string, after: string): void => {
      if (!activeRepoId || before === after) return
      const rel =
        repoPath && absPath.startsWith(repoPath)
          ? absPath.slice(repoPath.length).replace(/^[\\/]/, '')
          : baseName(absPath)
      const { added, removed, diff } = lineDiff(before, after)
      recordChange(activeRepoId, {
        path: rel,
        added,
        removed,
        diff,
        updatedAt: Date.now(),
        before,
        existed: true
      })
    },
    [activeRepoId, repoPath, recordChange]
  )

  // Draws the pending block: red "before" zone, green "after" lines and the
  // Undo / Keep bar. Used both right after a Quick Edit and when a file with
  // an unconfirmed edit is reopened.
  const paintPending = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any, monaco: any, p: PendingEdit): void => {
      const model = editor.getModel()
      const maxLine = model?.getLineCount() ?? p.endLine
      const startLine = Math.max(1, Math.min(p.startLine, maxLine))
      const endLine = Math.max(startLine, Math.min(p.endLine, maxLine))

      decorRef.current = editor.deltaDecorations(decorRef.current, [
        {
          range: new monaco.Range(startLine, 1, endLine, 1),
          options: { isWholeLine: true, className: 'ceditor__line-new' }
        }
      ])
      const oldLines = p.before.split(/\r?\n/)
      const contentLeft = editor.getLayoutInfo?.()?.contentLeft ?? 64
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.changeViewZones((acc: any) => {
        if (zoneRef.current) acc.removeZone(zoneRef.current)
        const dom = document.createElement('div')
        dom.className = 'ceditor__oldzone'
        dom.style.paddingLeft = `${contentLeft}px`
        oldLines.forEach((text) => {
          const row = document.createElement('div')
          row.className = 'ceditor__oldzone-line'
          row.textContent = text.length > 0 ? text : ' '
          dom.appendChild(row)
        })
        zoneRef.current = acc.addZone({
          afterLineNumber: Math.max(0, Math.min(startLine - 1, maxLine)),
          heightInLines: Math.max(1, oldLines.length),
          domNode: dom
        })
      })
      pendingRef.current = {
        id: p.id,
        path: p.path,
        startLine,
        endLine,
        before: p.before,
        fileBefore: p.fileBefore
      }
      const anchor = editor.getScrolledVisiblePosition({
        lineNumber: endLine,
        column: 1
      })
      setPending({ id: p.id, top: (anchor?.top ?? 0) + 22 })
    },
    []
  )

  const saveRef = useRef(save)
  saveRef.current = save

  // Saves one specific tab (used by the "Save" button of the close dialog).
  const saveOne = useCallback(
    async (path: string): Promise<boolean> => {
      const f = files.find((x) => x.path === path)
      if (!f || !f.dirty) return true
      const res = await window.api.fs.save({
        path: f.path,
        content: f.content,
        encoding: f.encoding
      })
      if (!res) return false
      recordFileChange(f.path, f.original, f.content)
      setFiles((prev) =>
        prev.map((x) =>
          x.path === f.path
            ? { ...x, dirty: false, original: x.content, conflict: undefined }
            : x
        )
      )
      return true
    },
    [files, recordFileChange]
  )

  const saveAll = useCallback(async (): Promise<void> => {
    const dirty = files.filter((f) => f.dirty)
    for (const f of dirty) {
      const res = await window.api.fs.save({
        path: f.path,
        content: f.content,
        encoding: f.encoding
      })
      if (!res) continue
      recordFileChange(f.path, f.original, f.content)
    }
    setFiles((prev) =>
      prev.map((x) =>
        x.dirty ? { ...x, dirty: false, original: x.content, conflict: undefined } : x
      )
    )
  }, [files, recordFileChange])

  const saveAllRef = useRef(saveAll)
  saveAllRef.current = saveAll

  useEffect(() => onAppEvent('editor:saveAll', () => void saveAllRef.current()), [])

  // Publishes the unsaved tabs so the title bar can guard the window close.
  useEffect(() => {
    setDirtyFiles(
      files.filter((f) => f.dirty).map((f) => ({ path: f.path, name: f.name }))
    )
  }, [files])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null)
  const animatingRef = useRef(false)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorReady(true)
    setEditorMountVersion((version) => version + 1)
    setupLsp(monaco)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveRef.current())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => addChatRef.current())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => openQuickRef.current())
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column })
    })
    // Cursor-style floating menu above the selection
    // The menu is pinned to the line where the selection STARTED and to a
    // fixed left offset, so it never follows the cursor while dragging.
    const syncSel = (): void => {
      const s = editor.getSelection()
      if (!s || s.isEmpty() || quickOpenRef.current) {
        setSel(null)
        return
      }
      const startLine = Math.min(s.startLineNumber, s.endLineNumber)
      const endLine = Math.max(s.startLineNumber, s.endLineNumber)
      const anchorLine = s.selectionStartLineNumber
      const pos = editor.getScrolledVisiblePosition({ lineNumber: anchorLine, column: 1 })
      if (!pos) {
        setSel(null)
        return
      }
      const contentLeft = editor.getLayoutInfo?.()?.contentLeft ?? 64
      // Hug the selected line: sit just above it, and flip below when the
      // selection starts at the very top of the viewport.
      const menuHeight = 24
      const above = pos.top - menuHeight - 2
      setSel({
        top: above >= 2 ? above : pos.top + 22,
        left: contentLeft + 8,
        startLine,
        endLine
      })
    }
    editor.onDidChangeCursorSelection(syncSel)
    editor.onDidScrollChange(syncSel)

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () =>
      rejectRef.current()
    )
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyY,
      () => acceptRef.current()
    )

    const container = editor.getContainerDomNode?.()
    if (container) {
      container.addEventListener(
        'contextmenu',
        (e: MouseEvent) => {
          const isMac = window.api?.window?.platform === 'darwin'
          if (!isMac) return
          setSel(null)
        },
        true
      )
    }

    editor.onContextMenu((e: any) => {
      const isMac = window.api?.window?.platform === 'darwin'
      if (!isMac) return

      try {
        e.event?.preventDefault?.()
        e.event?.stopPropagation?.()
        e.event?.browserEvent?.preventDefault?.()
        e.event?.browserEvent?.stopPropagation?.()
      } catch {}

      setSel(null)

      const s = editor.getSelection()
      const hasSelection = Boolean(s && !s.isEmpty())

      const items = [
        {
          id: 'undo',
          label: t('menu.undo') || 'Отменить',
          shortcut: 'CmdOrCtrl+Z',
          onClick: () => editor.trigger('keyboard', 'undo', null)
        },
        {
          id: 'redo',
          label: t('menu.redo') || 'Повторить',
          shortcut: 'CmdOrCtrl+Shift+Z',
          onClick: () => editor.trigger('keyboard', 'redo', null)
        },
        { id: 'sep1', separator: true },
        {
          id: 'cut',
          label: t('menu.cut') || 'Вырезать',
          shortcut: 'CmdOrCtrl+X',
          disabled: !hasSelection,
          onClick: () => {
            editor.focus()
            document.execCommand('cut')
          }
        },
        {
          id: 'copy',
          label: t('menu.copy') || 'Копировать',
          shortcut: 'CmdOrCtrl+C',
          disabled: !hasSelection,
          onClick: () => {
            editor.focus()
            document.execCommand('copy')
          }
        },
        {
          id: 'paste',
          label: t('menu.paste') || 'Вставить',
          shortcut: 'CmdOrCtrl+V',
          onClick: () => {
            editor.focus()
            void window.api.app.paste().then((text) => {
              if (text) editor.trigger('keyboard', 'type', { text })
              else document.execCommand('paste')
            })
          }
        },
        { id: 'sep2', separator: true },
        {
          id: 'selectAll',
          label: t('menu.selectAll') || 'Выделить всё',
          shortcut: 'CmdOrCtrl+A',
          onClick: () => editor.trigger('keyboard', 'selectAll', null)
        },
        { id: 'sep3', separator: true },
        {
          id: 'addToChat',
          label: t('editor.addToChat') || 'Добавить в чат',
          shortcut: 'CmdOrCtrl+L',
          onClick: () => addChatRef.current()
        },
        {
          id: 'quickEdit',
          label: t('editor.quickEdit') || 'Быстрая правка',
          shortcut: 'CmdOrCtrl+K',
          onClick: () => openQuickRef.current()
        }
      ]

      const payload = items.map(({ id, label, shortcut, disabled, separator }) => ({
        id,
        label,
        shortcut,
        disabled,
        separator
      }))

      void window.api.app.showContextMenu(payload).then((selectedId) => {
        if (selectedId) {
          const item = items.find((x) => x.id === selectedId)
          item?.onClick?.()
        }
      })
    })

    // The Undo / Keep bar follows the edited block while scrolling.
    editor.onDidScrollChange(() => {
      const p = pendingRef.current
      if (!p) return
      const pos = editor.getScrolledVisiblePosition({
        lineNumber: p.endLine,
        column: 1
      })
      if (pos) setPending({ id: p.id, top: pos.top + 22 })
    })
  }

  const quickOpenRef = useRef(false)
  quickOpenRef.current = quickEdit !== null

  // Ctrl+L - send the selected lines to the chat composer
  const addSelectionToChat = useCallback((): void => {
    const editor = editorRef.current
    if (!editor || !active) return
    const s = editor.getSelection()
    const model = editor.getModel()
    if (!s || !model) return
    const startLine = Math.min(s.startLineNumber, s.endLineNumber)
    const endLine = Math.max(s.startLineNumber, s.endLineNumber)
    const name = baseName(active.path)
    const span = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`
    emitAppEvent('composer:mention', {
      path: active.path,
      name,
      isDir: false,
      line: startLine,
      endLine
    })
    toastInfo(`${name} (${span})`)
    setSel(null)
    editor.focus()
  }, [active])

  // Ctrl+K - open the inline prompt box above the selection
  const openQuickEdit = useCallback((): void => {
    const editor = editorRef.current
    if (!editor) return
    const s = editor.getSelection()
    if (!s) return
    const startLine = Math.min(s.startLineNumber, s.endLineNumber)
    const endLine = Math.max(s.startLineNumber, s.endLineNumber)
    const anchorLine = s.selectionStartLineNumber
    const pos = editor.getScrolledVisiblePosition({ lineNumber: anchorLine, column: 1 })
    const contentLeft = editor.getLayoutInfo?.()?.contentLeft ?? 64
    setSel(null)
    setQuickPrompt('')
    setQuickEdit({
      top: Math.max((pos?.top ?? 60) - 42, 4),
      left: contentLeft + 8,
      startLine,
      endLine
    })
    window.setTimeout(() => quickInputRef.current?.focus(), 30)
  }, [])

  const addChatRef = useRef(addSelectionToChat)
  addChatRef.current = addSelectionToChat
  const openQuickRef = useRef(openQuickEdit)
  openQuickRef.current = openQuickEdit

  const closeQuickEdit = useCallback((): void => {
    if (quickReqRef.current) {
      window.api.agent.abort(quickReqRef.current)
      quickReqRef.current = null
    }
    quickCleanupRef.current?.()
    quickCleanupRef.current = null
    setQuickEdit(null)
    setQuickPrompt('')
    setQuickBusy(false)
    editorRef.current?.focus()
  }, [])

  const runQuickEdit = useCallback((): void => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const qe = quickEdit
    const prompt = quickPrompt.trim()
    if (!editor || !monaco || !qe || !active || !prompt || quickBusy) return
    const model = editor.getModel()
    if (!model) return
    const range = new monaco.Range(
      qe.startLine,
      1,
      qe.endLine,
      model.getLineMaxColumn(qe.endLine)
    )
    const original = model.getValueInRange(range)
    const lang = langOverride[active.path] ?? languageForFile(active.name)
    const rel = breadcrumb(active.path).join('/') || active.name
    const requestId = `qedit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const offs: Array<() => void> = []
    let acc = ''
    quickReqRef.current = requestId
    quickCleanupRef.current = () => offs.forEach((f) => f())
    setQuickBusy(true)

    const apply = (): void => {
      quickReqRef.current = null
      quickCleanupRef.current = null
      let out = acc.trim()
      const fence = out.match(/```[a-zA-Z0-9+#.-]*\r?\n([\s\S]*?)```/)
      if (fence) out = fence[1]
      out = out.replace(/\s+$/, '')
      setQuickBusy(false)
      setQuickEdit(null)
      setQuickPrompt('')
      if (!out) {
        toastInfo(t('editor.quickEditEmpty'))
        editor.focus()
        return
      }
      editor.pushUndoStop()
      editor.executeEdits('quick-edit', [{ range, text: out }])
      editor.pushUndoStop()
      const value = model.getValue()
      setFiles((prev) =>
        prev.map((f) => (f.path === active.path ? { ...f, content: value, dirty: true } : f))
      )
      const lastLine = Math.min(
        qe.startLine + out.split('\n').length - 1,
        model.getLineCount()
      )
      // Every mode keeps an explicit reviewable change until the user confirms it.
      {
        const entry: PendingEdit = {
          id: `qe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          path: active.path,
          name: active.name,
          startLine: qe.startLine,
          endLine: lastLine,
          before: original,
          after: out,
          fileBefore: active.original
        }
        addPendingEdit(entry)
        // Persist the proposed edit so it survives closing the file or restarting.
        void window.api.fs.save({ path: active.path, content: value, encoding: active.encoding })
        setFiles((prev) => prev.map((f) => f.path === active.path ? { ...f, content: value, original: value, dirty: false } : f))
        paintPending(editor, monaco, entry)
      }
      editor.revealLineInCenterIfOutsideViewport(qe.startLine)
      editor.focus()
    }

    offs.push(
      window.api.agent.onChunk((id, chunk) => {
        if (id === requestId) acc += chunk
      })
    )
    offs.push(
      window.api.agent.onDone((id) => {
        if (id !== requestId) return
        offs.forEach((f) => f())
        apply()
      })
    )
    offs.push(
      window.api.agent.onError((id, message) => {
        if (id !== requestId) return
        offs.forEach((f) => f())
        quickReqRef.current = null
        quickCleanupRef.current = null
        setQuickBusy(false)
        toastInfo(message || t('editor.quickEditFailed'))
      })
    )

    window.api.agent.send(
      requestId,
      [
        {
          role: 'system',
          content:
            'You are an inline code editor. Rewrite the code the user selected so it satisfies their instruction. Reply with ONLY the replacement code inside one fenced code block. Preserve the original indentation and surrounding style. Never explain, never call tools.'
        },
        {
          role: 'user',
          content: `File: ${rel} (lines ${qe.startLine}-${qe.endLine}, ${lang})\nInstruction: ${prompt}\n\n\`\`\`${lang}\n${original}\n\`\`\``
        }
      ],
      { cwd: repoPath, editMode: 'readonly', webEnabled: false }
    )
  }, [
    quickEdit,
    quickPrompt,
    quickBusy,
    active,
    langOverride,
    repoPath,
    t,
    recordFileChange,
    paintPending
  ])

  const clearPendingDecorations = useCallback((): void => {
    const editor = editorRef.current
    if (editor && decorRef.current.length > 0) {
      decorRef.current = editor.deltaDecorations(decorRef.current, [])
    }
    if (editor && zoneRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.changeViewZones((acc: any) => {
        if (zoneRef.current) acc.removeZone(zoneRef.current)
        zoneRef.current = null
      })
    }
    pendingRef.current = null
    setPending(null)
  }, [])

  // Keep - confirm the edit and push it into the Changes list.
  const acceptEdit = useCallback((): void => {
    const p = pendingRef.current
    if (!p) return
    const editor = editorRef.current
    const model = editor?.getModel()
    if (model) recordFileChange(p.path, p.fileBefore, model.getValue())
    removePendingEdit(p.id)
    clearPendingDecorations()
    editor?.focus()
  }, [recordFileChange, clearPendingDecorations])

  // Undo - put the original lines back.
  const rejectEdit = useCallback((): void => {
    const p = pendingRef.current
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!p || !editor || !monaco) return
    const model = editor.getModel()
    if (model) {
      if (p.fileBefore) {
        editor.pushUndoStop()
        model.setValue(p.fileBefore)
        editor.pushUndoStop()
      } else {
        const lineCount = model.getLineCount()
        const endLine = Math.min(p.endLine, lineCount)
        let range: InstanceType<typeof monaco.Range>
        if (p.before === '' && p.startLine > 1) {
          range = new monaco.Range(
            p.startLine - 1,
            model.getLineMaxColumn(p.startLine - 1),
            endLine,
            model.getLineMaxColumn(endLine)
          )
        } else if (p.before === '' && p.startLine === 1 && lineCount > endLine) {
          range = new monaco.Range(1, 1, endLine + 1, 1)
        } else {
          range = new monaco.Range(
            p.startLine,
            1,
            endLine,
            model.getLineMaxColumn(endLine)
          )
        }
        editor.pushUndoStop()
        editor.executeEdits('quick-edit-undo', [{ range, text: p.before }])
        editor.pushUndoStop()
      }
      const value = model.getValue()
      setFiles((prev) =>
        prev.map((f) =>
          f.path === p.path ? { ...f, content: value, dirty: value !== f.original } : f
        )
      )
      void window.api.fs.save({ path: p.path, content: value, encoding: files.find((f) => f.path === p.path)?.encoding ?? 'utf8' })
    }
    removePendingEdit(p.id)
    emitAppEvent('changes:remove', { path: p.path })
    clearPendingDecorations()
    editor.focus()
  }, [clearPendingDecorations, files])

  acceptRef.current = acceptEdit
  rejectRef.current = rejectEdit

  // An unconfirmed Quick Edit survives closing the tab and restarting the app:
  // whenever a file is shown, its pending block is painted again. If the code
  // no longer matches (the edit was never saved), the entry is dropped.
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (editor && decorRef.current.length > 0) {
      decorRef.current = editor.deltaDecorations(decorRef.current, [])
    }
    if (editor && zoneRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.changeViewZones((acc: any) => {
        if (zoneRef.current) acc.removeZone(zoneRef.current)
        zoneRef.current = null
      })
    }
    pendingRef.current = null
    setPending(null)
    if (!editor || !monaco || !editorReady || !activePath) return
    const entry = getPendingEditFor(activePath)
    if (!entry) return
    const model = editor.getModel()
    if (!model) return
    const restoreWhenModelReady = (): void => {
      const currentModel = editor.getModel()
      if (!currentModel) return
      paintPending(editor, monaco, entry)
    }
    restoreWhenModelReady()
    const retry = window.setTimeout(restoreWhenModelReady, 90)
    return () => window.clearTimeout(retry)
  }, [activePath, editorReady, editorMountVersion, paintPending])

  // The bar above the composer drives the same two actions.
  useEffect(() => {
    const offAccept = onAppEvent('edits:accept', () => acceptRef.current())
    const offReject = onAppEvent('edits:reject', () => rejectRef.current())
    return () => {
      offAccept()
      offReject()
    }
  }, [])

  useEffect(() => {
    return subscribePendingEdits((list) => {
      if (activePath) {
        const hasPending = list.some((x) => x.path === activePath)
        if (!hasPending && pendingRef.current?.path === activePath) {
          clearPendingDecorations()
        }
      }
    })
  }, [activePath, clearPendingDecorations])

  useEffect(() => {
    return onAppEvent('editor:agentEdit', ({ path, before, after }) => {
      let agentPending: PendingEdit | undefined
      if (before !== undefined && after !== undefined && before !== after) {
        // Limit the inline review block to the real changed hunk, like Cursor.
        const oldLines = before.split(/\r?\n/)
        const newLines = after.split(/\r?\n/)
        let start = 0
        while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++
        let suffix = 0
        while (suffix < oldLines.length - start && suffix < newLines.length - start && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++
        const oldPart = oldLines.slice(start, oldLines.length - suffix).join('\n')
        const newPart = newLines.slice(start, newLines.length - suffix).join('\n')
        agentPending = {
          id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          path, name: baseName(path), startLine: start + 1,
          // Monaco ranges are inclusive: the last changed line is start + count - 1.
          endLine: start + Math.max(1, newPart.split('\n').length) - 1,
          before: oldPart, after: newPart, fileBefore: before
        }
        addPendingEdit(agentPending)
      }
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
          if (agentPending) paintPending(editor, monaco, agentPending)
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
    // Normalize separators, case and dot segments before comparing paths. This
    // keeps the breadcrumb correct on Windows and avoids duplicated root names.
    const normalize = (value: string): string[] => {
      const parts: string[] = []
      for (const part of value.replace(/\\/g, '/').split('/')) {
        if (!part || part === '.') continue
        if (part === '..') { parts.pop(); continue }
        parts.push(part)
      }
      return parts
    }
    const fileParts = normalize(path)
    const rootParts = repoPath ? normalize(repoPath) : []
    const samePart = (a: string, b: string): boolean =>
      a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
    const inProject = rootParts.length > 0 && rootParts.length <= fileParts.length &&
      rootParts.every((part, index) => samePart(part, fileParts[index]))
    if (inProject) {
      const rootName = rootParts[rootParts.length - 1]
      const relativeParts = fileParts.slice(rootParts.length)
      return relativeParts[0] === rootName ? relativeParts : [rootName, ...relativeParts]
    }
    return fileParts
  }

  function doCloseTab(path: string): void {
    const closing = files.find((f) => f.path === path)
    if (closing) lspDidClose(langOverride[path] ?? languageForFile(closing.name), path)
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path)
      const next = prev.filter((f) => f.path !== path)
      if (path === activePath) setActivePath((next[idx] ?? next[idx - 1] ?? next[0])?.path ?? null)
      return next
    })
  }

  // A tab with the unsaved dot asks before it disappears.
  function closeTab(path: string, e?: React.MouseEvent): void {
    e?.stopPropagation()
    const f = files.find((x) => x.path === path)
    if (f?.dirty) {
      setAskClose({ path, name: f.name })
      return
    }
    doCloseTab(path)
  }

  if (files.length === 0) {
    const isMac = window.api?.window?.platform === 'darwin'
    const modKey = isMac ? '⌘' : 'Ctrl'
    return (
      <div className="ceditor ceditor--empty">
        <img src={asset('icon.png')} alt="" className="ceditor__empty-icon" />
        <ul className="ceditor__hints">
          <li>
            <span className="ceditor__hint-label">{t('welcome.openChat')}</span>
            <span className="ceditor__hint-keys">
              <kbd>{modKey}</kbd> + <kbd>J</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.showCommands')}</span>
            <span className="ceditor__hint-keys">
              <kbd>{modKey}</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.openFile')}</span>
            <span className="ceditor__hint-keys">
              <kbd>{modKey}</kbd> + <kbd>O</kbd>
            </span>
          </li>
          <li>
            <span className="ceditor__hint-label">{t('welcome.openFolder')}</span>
            <span className="ceditor__hint-keys">
              <kbd>{modKey}</kbd> + <kbd>K</kbd> <kbd>{modKey}</kbd> + <kbd>O</kbd>
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
            onAuxClick={(e) => {
              if (e.button !== 1) return
              e.preventDefault()
              closeTab(f.path, e)
            }}
            data-tip={f.path}
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
        {askClose && (
          <SaveDialog
            title={t('save.title')}
            message={t('save.body').replace('{name}', askClose.name)}
            hint={t('save.hint')}
            saveLabel={t('save.save')}
            discardLabel={t('save.dont')}
            cancelLabel={t('save.cancel')}
            onSave={() => {
              const target = askClose.path
              setAskClose(null)
              void saveOne(target).then((ok) => {
                if (ok) doCloseTab(target)
              })
            }}
            onDiscard={() => {
              const target = askClose.path
              setAskClose(null)
              doCloseTab(target)
            }}
            onCancel={() => setAskClose(null)}
          />
        )}
        <div className="ceditor__tabs-spacer" />
        <button
          type="button"
          className={`ceditor__split-btn${splitPath ? ' ceditor__split-btn--on' : ''}`}
          aria-label="Split editor"
          data-tip="Split editor"
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
                  padding: { top: 10 },
                  contextmenu: false
                }}
              />
              {sel && !quickEdit && (
                <div
                  className="ceditor__selmenu"
                  style={{ top: sel.top, left: sel.left }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    className="ceditor__selmenu-btn"
                    onClick={addSelectionToChat}
                  >
                    {t('editor.addToChat')}
                    <span className="ceditor__selmenu-kbd">{isMac ? '⌘L' : 'Ctrl+L'}</span>
                  </button>
                  <span className="ceditor__selmenu-sep" />
                  <button
                    type="button"
                    className="ceditor__selmenu-btn"
                    onClick={openQuickEdit}
                  >
                    {t('editor.quickEdit')}
                    <span className="ceditor__selmenu-kbd">{isMac ? '⌘K' : 'Ctrl+K'}</span>
                  </button>
                </div>
              )}
              {quickEdit && (
                <div
                  className="ceditor__qedit"
                  style={{ top: quickEdit.top, left: quickEdit.left }}
                >
                  {quickBusy ? (
                    <span className="ceditor__qedit-gen">
                      {t('editor.generating')}
                    </span>
                  ) : (
                    <>
                      <textarea
                        ref={quickInputRef}
                        className="ceditor__qedit-input"
                        rows={1}
                        spellCheck={false}
                        placeholder={t('editor.quickEditPlaceholder')}
                        value={quickPrompt}
                        onChange={(e) => setQuickPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            closeQuickEdit()
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            runQuickEdit()
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="ceditor__qedit-send"
                        aria-label={t('editor.generate')}
                        disabled={!quickPrompt.trim()}
                        onClick={runQuickEdit}
                      >
                        <ArrowUp size={13} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="ceditor__qedit-close"
                    aria-label={t('editor.close')}
                    onClick={closeQuickEdit}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {pending && (
                <div
                  className="ceditor__keepbar"
                  style={{ top: pending.top }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    className="ceditor__keepbar-btn"
                    data-tip={t('editor.undoTip')}
                    onClick={rejectEdit}
                  >
                    {t('editor.undo')}
                    <span className="ceditor__keepbar-kbd">{isMac ? '⌘N' : 'Ctrl+N'}</span>
                  </button>
                  <button
                    type="button"
                    className="ceditor__keepbar-btn ceditor__keepbar-btn--keep"
                    data-tip={t('editor.keepTip')}
                    onClick={acceptEdit}
                  >
                    {t('editor.keep')}
                    <span className="ceditor__keepbar-kbd">{isMac ? '⌘Shift+Y' : 'Ctrl+Shift+Y'}</span>
                  </button>
                </div>
              )}
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
                    padding: { top: 10 },
                    contextmenu: false
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
              data-tip={t('editor.selectLanguage')}
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
              data-tip={t('editor.selectEncoding')}
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
