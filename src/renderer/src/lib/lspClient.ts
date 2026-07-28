
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Monaco = any

let registered = false
let monacoRef: Monaco = null
let diagnosticsOff: (() => void) | null = null

const LSP_LANGS = ['typescript', 'javascript', 'python', 'rust', 'go', 'c', 'cpp']

function toUri(path: string): string {
  if (path.startsWith('ssh://')) return path
  let p = path.replace(/\\/g, '/')
  if (!p.startsWith('/')) p = '/' + p
  return 'file://' + encodeURI(p).replace(/#/g, '%23')
}

export function pathToLspUri(path: string): string {
  return toUri(path)
}

function mapKind(monaco: Monaco, kind: number | undefined): number {
  const K = monaco.languages.CompletionItemKind
  const table: Record<number, number> = {
    1: K.Text, 2: K.Method, 3: K.Function, 4: K.Constructor, 5: K.Field,
    6: K.Variable, 7: K.Class, 8: K.Interface, 9: K.Module, 10: K.Property,
    11: K.Unit, 12: K.Value, 13: K.Enum, 14: K.Keyword, 15: K.Snippet,
    16: K.Color, 17: K.File, 18: K.Reference, 19: K.Folder, 20: K.EnumMember,
    21: K.Constant, 22: K.Struct, 23: K.Event, 24: K.Operator, 25: K.TypeParameter
  }
  return table[kind ?? 0] ?? K.Property
}

function mapSeverity(monaco: Monaco, sev: number | undefined): number {
  const S = monaco.MarkerSeverity
  switch (sev) {
    case 1: return S.Error
    case 2: return S.Warning
    case 3: return S.Info
    case 4: return S.Hint
    default: return S.Info
  }
}

let resolveRoot: () => string | null = () => null

export function setLspRoot(fn: () => string | null): void {
  resolveRoot = fn
}

export function setupLsp(monaco: Monaco): void {
  if (registered) return
  registered = true
  monacoRef = monaco

  for (const lang of LSP_LANGS) {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['.', ':', '>', '"', "'", '/', '@', '<', ' '],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async provideCompletionItems(model: any, position: any) {
        const root = resolveRoot()
        if (!root) return { suggestions: [] }
        const res = (await window.api.lsp.completion({
          root,
          languageId: lang,
          uri: model.uri.toString(),
          line: position.lineNumber - 1,
          character: position.column - 1
        })) as { items?: unknown[] } | unknown[] | null
        if (!res) return { suggestions: [] }
        const items = Array.isArray(res) ? res : (res.items ?? [])
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const suggestions = (items as any[]).slice(0, 400).map((it) => {
          const insert = it.insertText ?? it.label
          const isSnippet = it.insertTextFormat === 2
          return {
            label: typeof it.label === 'string' ? it.label : it.label?.label ?? '',
            kind: mapKind(monaco, it.kind),
            insertText: insert,
            insertTextRules: isSnippet
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            detail: it.detail,
            documentation:
              typeof it.documentation === 'string'
                ? it.documentation
                : it.documentation?.value,
            sortText: it.sortText,
            filterText: it.filterText,
            range
          }
        })
        return { suggestions }
      }
    })

    monaco.languages.registerHoverProvider(lang, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async provideHover(model: any, position: any) {
        const root = resolveRoot()
        if (!root) return null
        const res = (await window.api.lsp.hover({
          root,
          languageId: lang,
          uri: model.uri.toString(),
          line: position.lineNumber - 1,
          character: position.column - 1
        })) as { contents?: unknown } | null
        if (!res || !res.contents) return null
        const c = res.contents
        let value = ''
        if (typeof c === 'string') value = c
        else if (Array.isArray(c)) value = c.map((x) => (typeof x === 'string' ? x : x.value)).join('\n\n')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else value = (c as any).value ?? ''
        if (!value.trim()) return null
        return { contents: [{ value }] }
      }
    })

    monaco.languages.registerDefinitionProvider(lang, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async provideDefinition(model: any, position: any) {
        const root = resolveRoot()
        if (!root) return null
        const res = await window.api.lsp.definition({
          root,
          languageId: lang,
          uri: model.uri.toString(),
          line: position.lineNumber - 1,
          character: position.column - 1
        })
        if (!res) return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr: any[] = Array.isArray(res) ? res : [res]
        return arr
          .map((loc) => {
            const uri = loc.uri ?? loc.targetUri
            const range = loc.range ?? loc.targetSelectionRange
            if (!uri || !range) return null
            return {
              uri: monaco.Uri.parse(uri),
              range: new monaco.Range(
                range.start.line + 1,
                range.start.character + 1,
                range.end.line + 1,
                range.end.character + 1
              )
            }
          })
          .filter(Boolean)
      }
    })
  }

  diagnosticsOff?.()
  diagnosticsOff = window.api.lsp.onDiagnostics(({ uri, diagnostics }) => {
    if (!monacoRef) return
    const model = monacoRef.editor
      .getModels()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((m: any) => m.uri.toString() === uri || m.uri.toString() === decodeURI(uri))
    if (!model) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markers = (diagnostics as any[]).map((d) => ({
      severity: mapSeverity(monacoRef, d.severity),
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      message: d.message,
      source: d.source
    }))
    monacoRef.editor.setModelMarkers(model, 'lsp', markers)
  })
}

const opened = new Set<string>()
const versions = new Map<string, number>()

export function lspDidOpen(languageId: string, path: string, text: string): void {
  if (!LSP_LANGS.includes(languageId)) return
  const root = resolveRoot()
  if (!root || path.startsWith('ssh://')) return
  const uri = toUri(path)
  if (opened.has(uri)) return
  opened.add(uri)
  versions.set(uri, 1)
  void window.api.lsp.open({ root, languageId, uri, text })
}

export function lspDidChange(languageId: string, path: string, text: string): void {
  if (!LSP_LANGS.includes(languageId)) return
  const root = resolveRoot()
  if (!root || path.startsWith('ssh://')) return
  const uri = toUri(path)
  if (!opened.has(uri)) {
    lspDidOpen(languageId, path, text)
    return
  }
  const version = (versions.get(uri) ?? 1) + 1
  versions.set(uri, version)
  void window.api.lsp.change({ root, languageId, uri, version, text })
}

export function lspDidClose(languageId: string, path: string): void {
  if (!LSP_LANGS.includes(languageId)) return
  const root = resolveRoot()
  if (!root || path.startsWith('ssh://')) return
  const uri = toUri(path)
  if (!opened.has(uri)) return
  opened.delete(uri)
  versions.delete(uri)
  void window.api.lsp.close({ root, languageId, uri })
}

export function lspModelUri(monaco: Monaco, path: string): string {
  return monaco.Uri.parse(toUri(path)).toString()
}
