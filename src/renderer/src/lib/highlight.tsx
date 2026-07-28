import { type ReactNode } from 'react'


const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'this',
  'import', 'export', 'from', 'default', 'async', 'await', 'yield', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'interface',
  'type', 'enum', 'implements', 'public', 'private', 'protected', 'readonly', 'static',
  'as', 'namespace', 'declare', 'abstract', 'get', 'set',
  'def', 'elif', 'lambda', 'pass', 'with', 'global', 'nonlocal', 'assert', 'raise',
  'except', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'self',
  'struct', 'fn', 'impl', 'pub', 'use', 'mod', 'match', 'where', 'func', 'package',
  'end', 'then', 'echo', 'select', 'go', 'defer', 'chan'
])

const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'nil', 'NaN', 'Infinity'])

interface Tok {
  cls: string
  text: string
}

function tokenize(code: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = code.length

  const push = (cls: string, text: string): void => {
    if (text) toks.push({ cls, text })
  }

  while (i < n) {
    const c = code[i]

    if ((c === '/' && code[i + 1] === '/') || c === '#' || (c === '-' && code[i + 1] === '-')) {
      let j = i
      while (j < n && code[j] !== '\n') j++
      push('hl-comment', code.slice(i, j))
      i = j
      continue
    }

    if (c === '/' && code[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++
      j = Math.min(n, j + 2)
      push('hl-comment', code.slice(i, j))
      i = j
      continue
    }

    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n && code[j] !== c) {
        if (code[j] === '\\') j++
        j++
      }
      j = Math.min(n, j + 1)
      push('hl-string', code.slice(i, j))
      i = j
      continue
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      let j = i
      while (j < n && /[0-9a-fxA-FX._]/.test(code[j])) j++
      push('hl-number', code.slice(i, j))
      i = j
      continue
    }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j++
      const word = code.slice(i, j)
      if (KEYWORDS.has(word)) push('hl-keyword', word)
      else if (LITERALS.has(word)) push('hl-literal', word)
      else if (/^[A-Z]/.test(word)) push('hl-type', word)
      else if (code[j] === '(') push('hl-func', word)
      else push('hl-plain', word)
      i = j
      continue
    }

    if (/[{}[\]()<>;,.:?=+\-*/%!&|^~]/.test(c)) {
      push('hl-punct', c)
      i++
      continue
    }

    let j = i
    while (j < n && /\s/.test(code[j])) j++
    if (j > i) {
      push('hl-plain', code.slice(i, j))
      i = j
    } else {
      push('hl-plain', c)
      i++
    }
  }

  return toks
}

export function highlightLine(code: string, keyPrefix = 'h'): ReactNode[] {
  return tokenize(code).map((t, i) => (
    <span key={`${keyPrefix}-${i}`} className={t.cls}>
      {t.text}
    </span>
  ))
}

export function highlightCode(code: string): ReactNode[] {
  return code.split('\n').map((line, i, arr) => (
    <span key={i}>
      {highlightLine(line, `l${i}`)}
      {i < arr.length - 1 ? '\n' : ''}
    </span>
  ))
}
