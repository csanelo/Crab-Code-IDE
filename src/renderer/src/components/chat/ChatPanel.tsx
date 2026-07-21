import { useEffect, useRef, useState } from 'react'
<<<<<<< HEAD
=======
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
>>>>>>> baf0023 (release: CrabCode 0.2.8)
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import { on as onAppEvent } from '../../lib/appEvents'
import { MessageItem } from './MessageItem'
import { NewSession } from '../center/NewSession'
import { McpModal } from '../mcp/McpModal'
import './ChatPanel.css'

<<<<<<< HEAD
function PixelCrab({ className }: { className?: string }): JSX.Element {
  const grid = [
    '1000000000001',
    '1100000000011',
    '0110000000110',
    '0011111111100',
    '0111111111110',
    '1110100001011',
    '1111111111111',
    '0011011011000',
    '0110000000110'
  ]
  const cell = 8
  const rects: JSX.Element[] = []
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '1') {
        rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} />)
      }
    }
  })
  return (
    <svg
      className={className}
      viewBox={`0 0 ${13 * cell} ${9 * cell}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects}
    </svg>
  )
}

=======
>>>>>>> baf0023 (release: CrabCode 0.2.8)
export function ChatPanel(): JSX.Element {
  const { state, activeConversation, sendMessage, stopMessage } = useApp()
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [mcpOpen, setMcpOpen] = useState(false)

  useEffect(() => {
    return onAppEvent('mcp:open', () => setMcpOpen(true))
  }, [])

  const messages = activeConversation?.messages ?? []
  const showHero =
    state.repositories.length === 0 ||
    !activeConversation ||
    messages.length === 0
  const lastLen = messages.length
  const last = messages[messages.length - 1]
  const lastContent = last?.content.length ?? 0
  const streaming = Boolean(last && last.role === 'assistant' && last.streaming)
  const thinking =
    streaming && !last?.content && (!last?.toolCalls || last.toolCalls.length === 0)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastLen, lastContent])

  if (showHero) {
    return (
      <section className="chat">
        <div className="chat__scroll">
          <div className="chat__hero-empty">
<<<<<<< HEAD
            <PixelCrab className="chat__hero-icon" />
            <div className="chat__hero-text">{t('chat.getToWork')}</div>
=======
            <div className="chat__hero-anim">
              <DotLottieReact
                src="https://lottie.host/7ab07753-b445-480d-b057-8f1d62cb76e0/GM03isGqsP.lottie"
                loop
                autoplay
              />
            </div>
            <div className="chat__hero-title">{t('chat.getToWork')}</div>
>>>>>>> baf0023 (release: CrabCode 0.2.8)
          </div>
        </div>
        <div className="chat__composer-wrap">
          <NewSession
            onSend={sendMessage}
            showHeader={false}
            streaming={streaming}
            onStop={stopMessage}
          />
        </div>
        {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
      </section>
    )
  }

  return (
    <section className="chat">
      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__messages">
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
          {thinking && (
            <div className="chat__thinking" aria-live="polite">
              <span className="chat__thinking-text">{t('chat.thinking')}</span>
            </div>
          )}
        </div>
      </div>
      <div className="chat__composer-wrap">
        <NewSession
          onSend={sendMessage}
          showHeader={false}
          streaming={streaming}
          onStop={stopMessage}
        />
      </div>
      {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
    </section>
  )
}
