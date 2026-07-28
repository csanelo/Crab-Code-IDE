import { useEffect, useRef, type ReactNode } from 'react'
import './ContextMenu.css'

export interface MenuItem {
  label?: string
  icon?: ReactNode
  shortcut?: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  variant = 'icons',
  className
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  variant?: 'icons' | 'plain'
  className?: string
}): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const isMac = window.api?.window?.platform === 'darwin'

  useEffect(() => {
    if (!isMac) return

    let canceled = false
    const payload = items.map((item, idx) => ({
      id: String(idx),
      label: item.label,
      shortcut: item.shortcut,
      danger: item.danger,
      disabled: item.disabled,
      separator: item.separator
    }))

    void window.api.app.showContextMenu(payload).then((selectedId) => {
      if (canceled) return
      if (selectedId !== null) {
        const idx = Number(selectedId)
        if (!isNaN(idx) && items[idx]?.onClick) {
          items[idx].onClick?.()
        }
      }
      onClose()
    })

    return () => {
      canceled = true
    }
  }, [isMac, items, onClose])

  if (isMac) return null

  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const visibleRows = items.filter((i) => !i.separator).length || 1
  const minWidth = className?.includes('narrow') ? 180 : variant === 'plain' ? 240 : 200
  const left = Math.min(x, window.innerWidth - minWidth - 12)
  const top = Math.min(y, window.innerHeight - visibleRows * 30 - 16)

  return (
    <div
      className={`ctx-menu${variant === 'plain' ? ' ctx-menu--plain' : ''}${className ? ' ' + className : ''}`}
      ref={ref}
      style={{ left, top }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} className="ctx-menu__sep" />
        }
        return (
          <button
            key={item.label ?? `item-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`ctx-menu__item${item.danger ? ' ctx-menu__item--danger' : ''}`}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
          >
            {variant === 'icons' && item.icon && <span className="ctx-menu__icon">{item.icon}</span>}
            <span className="ctx-menu__label">{item.label}</span>
            {item.shortcut && <span className="ctx-menu__shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}
