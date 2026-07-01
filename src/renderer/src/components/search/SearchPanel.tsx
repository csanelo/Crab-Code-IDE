import { useEffect, useRef, useState } from 'react'
import {
  Search,
  Replace,
  CaseSensitive,
  WholeWord,
  Regex,
  ChevronRight,
  ChevronDown,
  X,
  Loader2
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { emit } from '../../lib/appEvents'
import { toastSuccess, toastError } from '../../lib/toast'
import { fileIcon } from '../files/iconMap'
import './SearchPanel.css'

interface Match {
  line: number
  column: number
  length: number
  preview: string
}
interface FileResult {
  path: string
  relPath: string
  matches: Match[]
}

export function SearchPanel({ onClose, initialQuery }: { onClose: () => void; initialQuery?: string }): JSX.Element {
  const { state } = useApp()
  const root = state.repositories.find((r) => r.id === state.activeRepositoryId)?.path ?? null

  const [query, setQuery] = useState(initialQuery ?? '')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [regex, setRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')
  const [results, setResults] = useState<FileResult[]>([])
  const [truncated, setTruncated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const totalMatches = results.reduce((n, r) => n + r.matches.length, 0)

  async function run(): Promise<void> {
    if (!root || !query.trim()) {
      setResults([])
      return
    }
    setBusy(true)
    const res = await window.api.fs.searchContent({
      root,
      query,
      regex,
      caseSensitive,
      wholeWord,
      include,
      exclude
    })
    setBusy(false)
    if (res.error) {
      toastError(res.error)
      return
    }
    setResults(res.results)
    setTruncated(res.truncated)
  }

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => void run(), 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, regex, caseSensitive, wholeWord, include, exclude])

  function jump(file: FileResult, m: Match): void {
    emit('editor:open', { path: file.path, line: m.line, column: m.column })
  }

  async function replaceInFile(file: FileResult): Promise<void> {
    const res = await window.api.fs.replaceInFile({
      path: file.path,
      query,
      replacement,
      regex,
      caseSensitive,
      wholeWord
    })
    if (res.ok) {
      emit('editor:reload', { path: file.path })
      setResults((prev) => prev.filter((r) => r.path !== file.path))
      toastSuccess(`Replaced in ${file.relPath}`)
    } else {
      toastError(res.error ?? 'Replace failed')
    }
  }

  async function replaceAll(): Promise<void> {
    if (!results.length) return
    setBusy(true)
    let ok = 0
    for (const file of results) {
      const res = await window.api.fs.replaceInFile({
        path: file.path,
        query,
        replacement,
        regex,
        caseSensitive,
        wholeWord
      })
      if (res.ok) {
        ok++
        emit('editor:reload', { path: file.path })
      }
    }
    setBusy(false)
    setResults([])
    toastSuccess(`Replaced in ${ok} file${ok === 1 ? '' : 's'}`)
  }

  return (
    <div className="searchp">
      <div className="searchp__head">
        <span className="searchp__title">Search</span>
        <button type="button" className="searchp__x" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className="searchp__inputs">
        <button
          type="button"
          className="searchp__toggle-replace"
          aria-label="Toggle replace"
          onClick={() => setShowReplace((v) => !v)}
        >
          {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="searchp__fields">
          <div className="searchp__field">
            <Search size={13} className="searchp__field-icon" />
            <input
              ref={inputRef}
              className="searchp__input"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="searchp__flags">
              <button
                type="button"
                className={`searchp__flag${caseSensitive ? ' searchp__flag--on' : ''}`}
                title="Match case"
                onClick={() => setCaseSensitive((v) => !v)}
              >
                <CaseSensitive size={14} />
              </button>
              <button
                type="button"
                className={`searchp__flag${wholeWord ? ' searchp__flag--on' : ''}`}
                title="Whole word"
                onClick={() => setWholeWord((v) => !v)}
              >
                <WholeWord size={14} />
              </button>
              <button
                type="button"
                className={`searchp__flag${regex ? ' searchp__flag--on' : ''}`}
                title="Use regular expression"
                onClick={() => setRegex((v) => !v)}
              >
                <Regex size={14} />
              </button>
            </div>
          </div>

          {showReplace && (
            <div className="searchp__field">
              <Replace size={13} className="searchp__field-icon" />
              <input
                className="searchp__input"
                placeholder="Replace"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
              <button
                type="button"
                className="searchp__replace-all"
                title="Replace all"
                disabled={!results.length || busy}
                onClick={() => void replaceAll()}
              >
                <Replace size={13} />
              </button>
            </div>
          )}

          <div className="searchp__globs">
            <input
              className="searchp__glob"
              placeholder="files to include (e.g. src/**, *.ts)"
              value={include}
              onChange={(e) => setInclude(e.target.value)}
            />
            <input
              className="searchp__glob"
              placeholder="files to exclude"
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="searchp__summary">
        {busy ? (
          <span className="searchp__summary-busy">
            <Loader2 size={12} className="searchp__spin" /> Searching…
          </span>
        ) : query.trim() ? (
          <span>
            {totalMatches} result{totalMatches === 1 ? '' : 's'} in {results.length} file
            {results.length === 1 ? '' : 's'}
            {truncated ? ' (truncated)' : ''}
          </span>
        ) : (
          <span className="searchp__hint">Type to search the project</span>
        )}
      </div>

      <div className="searchp__results">
        {results.map((file) => {
          const isCollapsed = collapsed[file.path]
          return (
            <div key={file.path} className="searchp__file">
              <div className="searchp__file-head">
                <button
                  type="button"
                  className="searchp__file-toggle"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [file.path]: !prev[file.path] }))
                  }
                >
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  <img src={fileIcon(file.relPath)} alt="" className="searchp__file-icon" />
                  <span className="searchp__file-name" title={file.relPath}>
                    {file.relPath}
                  </span>
                  <span className="searchp__file-count">{file.matches.length}</span>
                </button>
                {showReplace && (
                  <button
                    type="button"
                    className="searchp__file-replace"
                    title="Replace in this file"
                    onClick={() => void replaceInFile(file)}
                  >
                    <Replace size={12} />
                  </button>
                )}
              </div>
              {!isCollapsed &&
                file.matches.map((m, i) => (
                  <button
                    key={`${m.line}:${m.column}:${i}`}
                    type="button"
                    className="searchp__match"
                    onClick={() => jump(file, m)}
                  >
                    <span className="searchp__match-line">{m.line}</span>
                    <span className="searchp__match-text">
                      {m.preview.slice(0, m.column - 1)}
                      <mark className="searchp__match-hl">
                        {m.preview.slice(m.column - 1, m.column - 1 + m.length)}
                      </mark>
                      {m.preview.slice(m.column - 1 + m.length)}
                    </span>
                  </button>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
