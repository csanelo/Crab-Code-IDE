import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../../i18n'
import './CommandPalette.css'

export interface PaletteItem<T = unknown> {
  id: string
  title: string
  subtitle?: string
  icon?: ReactNode
  data?: T
}

export function CommandPalette<T>({
  placeholder,
  query,
  onQueryChange,
  items,
  empty,
  onSelect,
  onClose,
  onActiveChange,
  loading
}: {
  placeholder: string
  query: string
  onQueryChange: (q: string) => void
  items: PaletteItem<T>[]
  empty: ReactNode
  onSelect: (item: PaletteItem<T>) => void
  onClose: () => void
  onActiveChange?: (item: PaletteItem<T>) => void
  loading?: boolean
}): JSX.Element {
  const [active, setActive] = useState(0)
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (items.length) setActive((i) => (i + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (items.length) setActive((i) => (i - 1 + items.length) % items.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[active]
        if (item) onSelect(item)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [items, active, onSelect, onClose])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  useEffect(() => {
    const item = items[active]
    if (item) onActiveChange?.(item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items])

  return (
    <div className="palette__backdrop" role="presentation" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
        />

        <div className="palette__list" ref={listRef}>
          {loading ? (
            <div className="palette__empty">{t('palette.searching')}</div>
          ) : items.length === 0 ? (
            <div className="palette__empty">{empty}</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-active={i === active}
                className={`palette__item${i === active ? ' palette__item--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onSelect(item)}
              >
                {item.icon && <span className="palette__icon">{item.icon}</span>}
                <span className="palette__title">{item.title}</span>
                {item.subtitle && <span className="palette__subtitle">{item.subtitle}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
