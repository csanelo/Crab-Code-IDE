import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import { getThemeDef, type ThemeDef } from '../theme/themes'

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

let configured = false

export function setupMonaco(): void {
  if (configured) return
  configured = true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(self as any).MonacoEnvironment = {
    getWorker(_: string, label: string): Worker {
      switch (label) {
        case 'json':
          return new JsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker()
        case 'typescript':
        case 'javascript':
          return new TsWorker()
        default:
          return new EditorWorker()
      }
    }
  }

  loader.config({ monaco })
}

const definedThemes = new Set<string>()

function bare(hex: string): string {
  return hex.replace(/^#/, '')
}

export function monacoThemeFor(id: string): string {
  const def: ThemeDef = getThemeDef(id)
  const name = `crab-${def.id}`
  if (definedThemes.has(name)) return name
  const v = def.vars
  const bg = v['--color-bg']
  const fg = v['--color-text']
  try {
    monaco.editor.defineTheme(name, {
      base: def.base === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: [{ token: '', foreground: bare(fg), background: bare(bg) }],
      colors: {
        'editor.background': bg,
        'editor.foreground': fg,
        'editorGutter.background': bg,
        'editorLineNumber.foreground': v['--color-text-muted'],
        'editorLineNumber.activeForeground': v['--color-text-secondary'],
        'editor.lineHighlightBackground': v['--color-surface-raised'],
        'editor.selectionBackground': v['--color-surface-overlay'],
        'editorCursor.foreground': v['--color-accent'],
        'editorWidget.background': v['--color-surface'],
        'editorWidget.border': v['--color-border'],
        'editorIndentGuide.background': v['--color-border'],
        'editorIndentGuide.activeBackground': v['--color-border-strong'],
        'scrollbarSlider.background': v['--color-surface-overlay'],
        'minimap.background': bg
      }
    })
    definedThemes.add(name)
  } catch {
    return def.base === 'light' ? 'vs' : 'vs-dark'
  }
  return name
}

export function languageForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    xml: 'xml',
    sql: 'sql',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    dart: 'dart',
    vue: 'html',
    svelte: 'html'
  }
  return map[ext] ?? 'plaintext'
}
