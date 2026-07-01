import { useEffect, useRef, useState } from 'react'
import { Minus, Square, Copy, X, MousePointer2 } from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n/translations'
import { fileService } from '../../services/fileService'
import { newRepository } from '../../state'
import { GithubAvatar } from './GithubAvatar'
import { asset } from '../../lib/asset'
import './TitleBar.css'

interface MenuItem {
  key: TKey
  shortcut?: string
  onClick: () => void
  separatorBefore?: boolean
}

function PanelLeftIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="3.9" y="4.9" width="4.2" height="14.2" rx="1" fill="currentColor" />}
    </svg>
  )
}

function PanelRightIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="15.9" y="4.9" width="4.2" height="14.2" rx="1" fill="currentColor" />}
    </svg>
  )
}

function PanelBottomIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="3.9" y="15.9" width="16.2" height="3.2" rx="1" fill="currentColor" />}
    </svg>
  )
}

export function TitleBar({
  onToggleSidebar,
  onToggleRight,
  onToggleTerminal,
  onToggleBrowser,
  leftOpen = false,
  rightOpen = false,
  terminalOpen = false,
  browserOpen = false
}: {
  onToggleSidebar?: () => void
  onToggleRight?: () => void
  onToggleTerminal?: () => void
  onToggleBrowser?: () => void
  leftOpen?: boolean
  rightOpen?: boolean
  terminalOpen?: boolean
  browserOpen?: boolean
}): JSX.Element {
  const [maximized, setMaximized] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)
  const { createConversation, openProjectFromFolder, setView, state } = useApp()
  const t = useT()
  const isMac = window.api.window.platform === 'darwin'

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    const off = window.api.window.onMaximizedChange(setMaximized)
    return () => off()
  }, [])

  useEffect(() => {
    if (!openMenu) return
    function onDown(e: MouseEvent): void {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    function onKey(e: globalThis.KeyboardEvent): void {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  async function openFolder(): Promise<void> {
    const picked = await fileService.openFolder()
    if (picked) openProjectFromFolder(newRepository(picked.name, picked.path))
  }

  const menus: { id: string; label: TKey; items: MenuItem[] }[] = [
    {
      id: 'file',
      label: 'menu.file',
      items: [
        { key: 'menu.newAgent', shortcut: 'Ctrl+N', onClick: () => createConversation(state.activeRepositoryId) },
        { key: 'menu.openFolder', shortcut: 'Ctrl+K Ctrl+O', onClick: () => void openFolder() },
        { key: 'menu.newTerminal', shortcut: 'Ctrl+`', onClick: () => onToggleTerminal?.() },
        { key: 'menu.settings', shortcut: 'Ctrl+,', onClick: () => setView('settings'), separatorBefore: true },
        { key: 'menu.exit', onClick: () => window.api.window.close(), separatorBefore: true }
      ]
    },
    {
      id: 'edit',
      label: 'menu.edit',
      items: [
        { key: 'menu.undo', shortcut: 'Ctrl+Z', onClick: () => document.execCommand('undo') },
        { key: 'menu.redo', shortcut: 'Ctrl+Y', onClick: () => document.execCommand('redo') },
        { key: 'menu.cut', shortcut: 'Ctrl+X', onClick: () => document.execCommand('cut'), separatorBefore: true },
        { key: 'menu.copy', shortcut: 'Ctrl+C', onClick: () => document.execCommand('copy') },
        { key: 'menu.paste', shortcut: 'Ctrl+V', onClick: () => document.execCommand('paste') },
        { key: 'menu.selectAll', shortcut: 'Ctrl+A', onClick: () => document.execCommand('selectAll'), separatorBefore: true }
      ]
    },
    {
      id: 'view',
      label: 'menu.view',
      items: [
        { key: 'menu.toggleLeft', shortcut: 'Ctrl+B', onClick: () => onToggleSidebar?.() },
        { key: 'menu.toggleRight', shortcut: 'Ctrl+J', onClick: () => onToggleRight?.() },
        { key: 'menu.toggleTerminal', shortcut: 'Ctrl+`', onClick: () => onToggleTerminal?.() },
        { key: 'menu.zoomIn', shortcut: 'Ctrl+=', onClick: () => void window.api.window.zoom(1), separatorBefore: true },
        { key: 'menu.zoomOut', shortcut: 'Ctrl+-', onClick: () => void window.api.window.zoom(-1) },
        { key: 'menu.zoomReset', shortcut: 'Ctrl+0', onClick: () => void window.api.window.zoom(0) }
      ]
    },
    {
      id: 'help',
      label: 'menu.help',
      items: [
        { key: 'menu.about', onClick: () => void window.api.app.showAbout() }
      ]
    }
  ]

  function runItem(item: MenuItem): void {
    setOpenMenu(null)
    item.onClick()
  }

  return (
    <header className={`titlebar${isMac ? ' titlebar--mac' : ''}`}>
      <div className="titlebar__menubar" ref={menuBarRef}>
        {!isMac && <img src={asset('sreda.png')} alt="CrabCode" className="titlebar__logo" />}
        {menus.map((m) => (
          <div key={m.id} className="titlebar__menu">
            <button
              type="button"
              className={`titlebar__menu-btn${openMenu === m.id ? ' titlebar__menu-btn--on' : ''}`}
              onClick={() => setOpenMenu((cur) => (cur === m.id ? null : m.id))}
              onMouseEnter={() => setOpenMenu((cur) => (cur ? m.id : cur))}
            >
              {t(m.label)}
            </button>
            {openMenu === m.id && (
              <div className="titlebar__dropdown" role="menu">
                {m.items.map((item) => (
                  <div key={item.key}>
                    {item.separatorBefore && <div className="titlebar__dropdown-sep" />}
                    <button
                      type="button"
                      role="menuitem"
                      className="titlebar__dropdown-item"
                      onClick={() => runItem(item)}
                    >
                      <span className="titlebar__dropdown-label">{t(item.key)}</span>
                      {item.shortcut && (
                        <span className="titlebar__dropdown-shortcut">{item.shortcut}</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="titlebar__drag" />

      <span className="titlebar__title" aria-hidden="true">CrabCode</span>

      <div className="titlebar__controls">
        <button
          className={`titlebar__icon-btn titlebar__browser-btn${browserOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label="Browser (agent's eyes)"
          aria-pressed={browserOpen}
          title="Internal browser — the agent's eyes"
          onClick={onToggleBrowser}
        >
          <MousePointer2 size={19} />
        </button>
        <GithubAvatar />
        <button
          className={`titlebar__icon-btn${leftOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.toggleSidebar')}
          aria-pressed={leftOpen}
          title={t('nav.toggleSidebarHint')}
          onClick={onToggleSidebar}
        >
          <PanelLeftIcon filled={leftOpen} />
        </button>
        <button
          className={`titlebar__icon-btn${terminalOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.openTerminal')}
          aria-pressed={terminalOpen}
          title={t('nav.openTerminalHint')}
          onClick={onToggleTerminal}
        >
          <PanelBottomIcon filled={terminalOpen} />
        </button>
        <button
          className={`titlebar__icon-btn${rightOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.toggleRight')}
          aria-pressed={rightOpen}
          title={t('nav.toggleRightHint')}
          onClick={onToggleRight}
        >
          <PanelRightIcon filled={rightOpen} />
        </button>

        {!isMac && <div className="titlebar__controls-sep" />}

        {!isMac && (
          <>
            <button
              className="titlebar__control"
              type="button"
              aria-label={t('nav.minimize')}
              onClick={() => window.api.window.minimize()}
            >
              <Minus size={15} />
            </button>
            <button
              className="titlebar__control"
              type="button"
              aria-label={maximized ? t('nav.restore') : t('nav.maximize')}
              onClick={() => window.api.window.toggleMaximize().then(setMaximized)}
            >
              {maximized ? <Copy size={13} /> : <Square size={12} />}
            </button>
            <button
              className="titlebar__control titlebar__control--danger"
              type="button"
              aria-label={t('nav.close')}
              onClick={() => window.api.window.close()}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
