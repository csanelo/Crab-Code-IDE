import { memo, useState, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'
import { copyText } from '../../lib/clipboard'
import { highlightCode } from '../../lib/highlight'
import './Markdown.css'


type Block =
  | { type: 'code'; lang: string; code: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'p'; text: string }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^(\s*)```(.*)$/)
    if (fence) {
      const indent = fence[1].length
      const lang = fence[2].trim().replace(/`+$/, '').trim()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i].slice(indent))
        i++
      }
      i++
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      i++
      continue
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const qlines: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        qlines.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', lines: qlines })
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^(---|\*\*\*|___)\s*$/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', text: para.join('\n') })
  }

  return blocks
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${k++}`
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={key} className="md__code">
          {tok.slice(1, -1)}
        </code>
      )
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('~~')) {
      nodes.push(<del key={key}>{tok.slice(2, -2)}</del>)
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (lm) {
        nodes.push(
          <a
            key={key}
            href={lm[2]}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => {
              e.preventDefault()
              window.open(lm[2], '_blank')
            }}
          >
            {lm[1]}
          </a>
        )
      } else {
        nodes.push(tok)
      }
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function CodeBlock({ lang, code }: { lang: string; code: string }): JSX.Element {
  const [copied, setCopied] = useState(false)

  function copy(): void {
    copyText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="md__code-block">
      <div className="md__code-head">
        <span className="md__code-lang">{lang || 'code'}</span>
        <button
          type="button"
          className="md__code-copy"
          onClick={copy}
          aria-label="Copy"
          title="Copy"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="md__pre">
        <code>{highlightCode(code)}</code>
      </pre>
    </div>
  )
}

function MarkdownBase({ text }: { text: string }): JSX.Element {
  const blocks = parseBlocks(text)
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={i} lang={b.lang} code={b.code} />
          case 'heading': {
            const Tag = `h${Math.min(b.level, 6)}` as keyof JSX.IntrinsicElements
            return (
              <Tag key={i} className="md__h">
                {renderInline(b.text, `h${i}`)}
              </Tag>
            )
          }
          case 'ul':
            return (
              <ul key={i} className="md__ul">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="md__ol">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote key={i} className="md__quote">
                {b.lines.map((l, j) => (
                  <p key={j}>{renderInline(l, `q${i}-${j}`)}</p>
                ))}
              </blockquote>
            )
          case 'hr':
            return <hr key={i} className="md__hr" />
          case 'p':
          default:
            return (
              <p key={i} className="md__p">
                {renderInline(b.text, `p${i}`)}
              </p>
            )
        }
      })}
    </div>
  )
}

export const Markdown = memo(MarkdownBase)
