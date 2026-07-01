import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { fileService } from '../../services/fileService'
import { fileIcon, folderIcon } from './iconMap'

export interface Entry {
  name: string
  path: string
  isDir: boolean
}

interface CommonProps {
  onContextMenu?: (e: React.MouseEvent, entry: Entry) => void
  renamingPath?: string | null
  onCommitRename?: (path: string, newName: string) => void
  onCancelRename?: () => void
  openDirs: ReadonlySet<string>
  onToggleDir: (path: string, open?: boolean) => void
  onMoved?: () => void
  onOpenFile?: (path: string) => void
}

const MIME_FILE = 'application/x-sreda-file'
const MIME_MOVE = 'application/x-sreda-move'
const ROW_H = 24
const OVERSCAN = 8

const dirCache = new Map<string, Entry[]>()

export function invalidateDir(path: string): void {
  dirCache.delete(path)
}

interface FlatRow {
  entry: Entry
  depth: number
}

function Guides({ depth }: { depth: number }): JSX.Element {
  if (depth <= 0) return <></>
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="ftree__guide" aria-hidden="true" />
      ))}
    </>
  )
}

export function FileTree({
  dir,
  depth = 0,
  ...rest
}: {
  dir: string
  depth?: number
} & CommonProps): JSX.Element {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)

  const { openDirs } = rest

  const mountedRef = useRef(false)
  if (!mountedRef.current) {
    mountedRef.current = true
    dirCache.clear()
  }

  const rows: FlatRow[] = []
  const pendingLoads: string[] = []

  function ensure(path: string): Entry[] | null {
    const cached = dirCache.get(path)
    if (cached) return cached
    pendingLoads.push(path)
    return null
  }

  function walk(path: string, d: number): void {
    const entries = ensure(path)
    if (!entries) return
    for (const entry of entries) {
      rows.push({ entry, depth: d })
      if (entry.isDir && openDirs.has(entry.path)) {
        walk(entry.path, d + 1)
      }
    }
  }

  walk(dir, depth)

  useEffect(() => {
    if (pendingLoads.length === 0) return
    let alive = true
    const unique = [...new Set(pendingLoads)]
    void Promise.all(
      unique.map((p) =>
        fileService.readDir(p).then((list) => {
          dirCache.set(p, list as Entry[])
        })
      )
    ).then(() => {
      if (alive) bump()
    })
    return () => {
      alive = false
    }
  })

  useLayoutEffect(() => {
    let el = wrapRef.current?.parentElement ?? null
    while (el) {
      const oy = getComputedStyle(el).overflowY
      if (oy === 'auto' || oy === 'scroll') break
      el = el.parentElement
    }
    scrollParentRef.current = el
    if (!el) return
    const onScroll = (): void => setScrollTop(el!.scrollTop)
    const measure = (): void => setViewport(el!.clientHeight || 600)
    measure()
    setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el!.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  const wrapOffset = wrapRef.current
    ? wrapRef.current.offsetTop - (scrollParentRef.current?.offsetTop ?? 0)
    : 0
  const effectiveTop = Math.max(0, scrollTop - wrapOffset)

  const total = rows.length
  const start = Math.max(0, Math.floor(effectiveTop / ROW_H) - OVERSCAN)
  const visibleCount = Math.ceil(viewport / ROW_H) + OVERSCAN * 2
  const end = Math.min(total, start + visibleCount)
  const slice = rows.slice(start, end)

  return (
    <div ref={wrapRef} className="ftree__virt" style={{ height: total * ROW_H, position: 'relative' }}>
      <div style={{ position: 'absolute', top: start * ROW_H, left: 0, right: 0 }}>
        {slice.map(({ entry, depth: d }) =>
          entry.isDir ? (
            <TreeFolder key={entry.path} entry={entry} depth={d} {...rest} />
          ) : (
            <TreeFile key={entry.path} entry={entry} depth={d} {...rest} />
          )
        )}
      </div>
    </div>
  )
}

function TreeFolder({
  entry,
  depth,
  ...rest
}: {
  entry: Entry
  depth: number
} & CommonProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const isRenaming = rest.renamingPath === entry.path
  const open = rest.openDirs.has(entry.path)

  async function onDrop(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const source = e.dataTransfer.getData(MIME_MOVE)
    if (!source || source === entry.path) return
    const res = await window.api.fs.move({ source, destDir: entry.path })
    if (res && !('error' in res)) {
      invalidateDir(entry.path)
      rest.onToggleDir(entry.path, true)
      rest.onMoved?.()
    }
  }

  if (isRenaming) {
    return <RenameRow entry={entry} depth={depth} isFolder={true} {...rest} />
  }

  return (
    <button
      type="button"
      className={`ftree__row ftree__folder${dragOver ? ' ftree__row--dragover' : ''}`}
      draggable
      onClick={() => rest.onToggleDir(entry.path)}
      onContextMenu={(e) => rest.onContextMenu?.(e, entry)}
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME_MOVE, entry.path)
        e.dataTransfer.setData(
          MIME_FILE,
          JSON.stringify({ path: entry.path, name: entry.name, isDir: true })
        )
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(MIME_MOVE)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => void onDrop(e)}
    >
      <Guides depth={depth} />
      <img className="ftree__img" src={folderIcon(entry.name, open)} alt="" aria-hidden="true" />
      <span className="ftree__label">{entry.name}</span>
    </button>
  )
}

function TreeFile({
  entry,
  depth,
  ...rest
}: {
  entry: Entry
  depth: number
} & CommonProps): JSX.Element {
  if (rest.renamingPath === entry.path) {
    return <RenameRow entry={entry} depth={depth} isFolder={false} {...rest} />
  }
  return (
    <button
      type="button"
      className="ftree__row ftree__file"
      draggable
      onClick={() =>
        rest.onOpenFile ? rest.onOpenFile(entry.path) : void window.api.editor.open(entry.path)
      }
      onContextMenu={(e) => rest.onContextMenu?.(e, entry)}
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME_MOVE, entry.path)
        e.dataTransfer.setData(
          MIME_FILE,
          JSON.stringify({ path: entry.path, name: entry.name, isDir: false })
        )
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
    >
      <Guides depth={depth} />
      <img className="ftree__img" src={fileIcon(entry.name)} alt="" aria-hidden="true" />
      <span className="ftree__label">{entry.name}</span>
    </button>
  )
}

function RenameRow({
  entry,
  depth,
  isFolder,
  onCommitRename,
  onCancelRename
}: {
  entry: Entry
  depth: number
  isFolder: boolean
} & CommonProps): JSX.Element {
  return (
    <div className="ftree__row ftree__rename">
      <Guides depth={depth} />
      <img
        className="ftree__img"
        src={isFolder ? folderIcon(entry.name, false) : fileIcon(entry.name)}
        alt=""
        aria-hidden="true"
      />
      <input
        autoFocus
        className="ftree__rename-input"
        defaultValue={entry.name}
        onFocus={(e) => {
          if (!isFolder) {
            const dot = e.target.value.lastIndexOf('.')
            e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length)
          } else {
            e.target.select()
          }
        }}
        onBlur={(e) => onCommitRename?.(entry.path, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommitRename?.(entry.path, (e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onCancelRename?.()
        }}
      />
    </div>
  )
}
