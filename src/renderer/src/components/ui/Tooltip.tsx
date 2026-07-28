import { useEffect, useRef, useState } from 'react'
import './Tooltip.css'

interface TipState {
  text: string
  top: number
  left: number
  below: boolean
}

/**
 * A single global tooltip. Any element in the app that carries a `data-tip`
 * attribute gets a styled tooltip on hover or keyboard focus - no wrapper
 * component and no per-button state needed.
 */
export function TooltipLayer(): JSX.Element | null {
  const [tip, setTip] = useState<TipState | null>(null)
  const timerRef = useRef<number | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const clearTimer = (): void => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const hide = (): void => {
      clearTimer()
      targetRef.current = null
      setTip(null)
    }

    const show = (el: HTMLElement): void => {
      if (!el.isConnected) return
      const text = el.getAttribute('data-tip')
      if (!text) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const below = r.top < 52
      setTip({
        text,
        top: below ? r.bottom + 8 : r.top - 8,
        left: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70),
        below
      })
    }

    const pick = (target: EventTarget | null): HTMLElement | null => {
      const node = target as HTMLElement | null
      if (!node || typeof node.closest !== 'function') return null
      return node.closest('[data-tip]')
    }

    const onOver = (e: Event): void => {
      const el = pick(e.target)
      if (!el) return
      if (el === targetRef.current) return
      clearTimer()
      setTip(null)
      targetRef.current = el
      timerRef.current = window.setTimeout(() => show(el), 420)
    }

    const onOut = (e: Event): void => {
      const el = pick(e.target)
      if (el && el === targetRef.current) hide()
    }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('focusin', onOver, true)
    document.addEventListener('focusout', onOut, true)
    document.addEventListener('mousedown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)

    return () => {
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('focusin', onOver, true)
      document.removeEventListener('focusout', onOut, true)
      document.removeEventListener('mousedown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      clearTimer()
    }
  }, [])

  if (!tip) return null

  return (
    <div
      className={`tip${tip.below ? ' tip--below' : ''}`}
      style={{ top: tip.top, left: tip.left }}
      role="tooltip"
    >
      {tip.text}
    </div>
  )
}
