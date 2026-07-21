import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { on as onAppEvent } from '../../lib/appEvents'
import './Toaster.css'

interface Toast {
  id: string
  kind: 'info' | 'success' | 'error'
  message: string
}

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

export function Toaster(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return onAppEvent('toast', (payload) => {
      const id = payload.id ?? `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const toast: Toast = { id, kind: payload.kind ?? 'info', message: payload.message }
      setToasts((prev) => [...prev.slice(-4), toast])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    })
  }, [])

  function dismiss(id: string): void {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return <></>

  return (
    <div className="toaster" role="region" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.kind]
        return (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            <Icon size={16} className="toast__icon" />
            <span className="toast__msg">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
