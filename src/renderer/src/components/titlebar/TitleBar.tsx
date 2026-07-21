<<<<<<< HEAD
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
=======
import { useEffect, useRef, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import type { TKey } from "../../i18n/translations";
import { fileService } from "../../services/fileService";
import { newRepository } from "../../state";
import { GithubAvatar } from "./GithubAvatar";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { asset } from "../../lib/asset";
import "./TitleBar.css";

interface MenuItem {
  key: TKey;
  shortcut?: string;
  onClick: () => void;
  separatorBefore?: boolean;
}

function GoogleBrowserIcon(): JSX.Element {
  return (
    <svg
      className="titlebar__google-icon"
      viewBox="0 0 48 48"
      role="img"
      aria-label="Google"
    >
      <path
        fill="#ffc107"
        d="M43.6 20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.6-5.6C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-4Z"
      />
      <path
        fill="#ff3d00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.6-5.6C34 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7Z"
      />
      <path
        fill="#4caf50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.8 11.8 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976d2"
        d="M43.6 20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.5 44 30.6 44 24c0-1.3-.1-2.7-.4-4Z"
      />
    </svg>
  );
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

function PanelLeftIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
<<<<<<< HEAD
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="3.9" y="4.9" width="4.2" height="14.2" rx="1" fill="currentColor" />}
    </svg>
  )
=======
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <line
        x1="9"
        y1="4"
        x2="9"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {filled && (
        <rect
          x="3.9"
          y="4.9"
          width="4.2"
          height="14.2"
          rx="1"
          fill="currentColor"
        />
      )}
    </svg>
  );
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

function PanelRightIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
<<<<<<< HEAD
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="15.9" y="4.9" width="4.2" height="14.2" rx="1" fill="currentColor" />}
    </svg>
  )
=======
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <line
        x1="15"
        y1="4"
        x2="15"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {filled && (
        <rect
          x="15.9"
          y="4.9"
          width="4.2"
          height="14.2"
          rx="1"
          fill="currentColor"
        />
      )}
    </svg>
  );
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

function PanelBottomIcon({ filled }: { filled: boolean }): JSX.Element {
  return (
<<<<<<< HEAD
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.7" />
      {filled && <rect x="3.9" y="15.9" width="16.2" height="3.2" rx="1" fill="currentColor" />}
    </svg>
  )
=======
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <line
        x1="3"
        y1="15"
        x2="21"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {filled && (
        <rect
          x="3.9"
          y="15.9"
          width="16.2"
          height="3.2"
          rx="1"
          fill="currentColor"
        />
      )}
    </svg>
  );
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

export function TitleBar({
  onToggleSidebar,
  onToggleRight,
  onToggleTerminal,
  onToggleBrowser,
  leftOpen = false,
  rightOpen = false,
  terminalOpen = false,
<<<<<<< HEAD
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
=======
  browserOpen = false,
}: {
  onToggleSidebar?: () => void;
  onToggleRight?: () => void;
  onToggleTerminal?: () => void;
  onToggleBrowser?: () => void;
  leftOpen?: boolean;
  rightOpen?: boolean;
  terminalOpen?: boolean;
  browserOpen?: boolean;
}): JSX.Element {
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const { createConversation, openProjectFromFolder, setView, state } =
    useApp();
  const t = useT();
  const isMac = window.api.window.platform === "darwin";

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized);
    const off = window.api.window.onMaximizedChange(setMaximized);
    return () => off();
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function onDown(e: MouseEvent): void {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node))
        setOpenMenu(null);
    }
    function onKey(e: globalThis.KeyboardEvent): void {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  async function openFolder(): Promise<void> {
    const picked = await fileService.openFolder();
    if (picked) openProjectFromFolder(newRepository(picked.name, picked.path));
>>>>>>> baf0023 (release: CrabCode 0.2.8)
  }

  const menus: { id: string; label: TKey; items: MenuItem[] }[] = [
    {
<<<<<<< HEAD
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
=======
      id: "file",
      label: "menu.file",
      items: [
        {
          key: "menu.newAgent",
          shortcut: "Ctrl+N",
          onClick: () => createConversation(state.activeRepositoryId),
        },
        {
          key: "menu.openFolder",
          shortcut: "Ctrl+K Ctrl+O",
          onClick: () => void openFolder(),
        },
        {
          key: "menu.newTerminal",
          shortcut: "Ctrl+`",
          onClick: () => onToggleTerminal?.(),
        },
        {
          key: "menu.settings",
          shortcut: "Ctrl+,",
          onClick: () => setView("settings"),
          separatorBefore: true,
        },
        {
          key: "menu.exit",
          onClick: () => window.api.window.close(),
          separatorBefore: true,
        },
      ],
    },
    {
      id: "edit",
      label: "menu.edit",
      items: [
        {
          key: "menu.undo",
          shortcut: "Ctrl+Z",
          onClick: () => document.execCommand("undo"),
        },
        {
          key: "menu.redo",
          shortcut: "Ctrl+Y",
          onClick: () => document.execCommand("redo"),
        },
        {
          key: "menu.cut",
          shortcut: "Ctrl+X",
          onClick: () => document.execCommand("cut"),
          separatorBefore: true,
        },
        {
          key: "menu.copy",
          shortcut: "Ctrl+C",
          onClick: () => document.execCommand("copy"),
        },
        {
          key: "menu.paste",
          shortcut: "Ctrl+V",
          onClick: () => document.execCommand("paste"),
        },
        {
          key: "menu.selectAll",
          shortcut: "Ctrl+A",
          onClick: () => document.execCommand("selectAll"),
          separatorBefore: true,
        },
      ],
    },
    {
      id: "view",
      label: "menu.view",
      items: [
        {
          key: "menu.toggleLeft",
          shortcut: "Ctrl+B",
          onClick: () => onToggleSidebar?.(),
        },
        {
          key: "menu.toggleRight",
          shortcut: "Ctrl+J",
          onClick: () => onToggleRight?.(),
        },
        {
          key: "menu.toggleTerminal",
          shortcut: "Ctrl+`",
          onClick: () => onToggleTerminal?.(),
        },
        {
          key: "menu.zoomIn",
          shortcut: "Ctrl+=",
          onClick: () => void window.api.window.zoom(1),
          separatorBefore: true,
        },
        {
          key: "menu.zoomOut",
          shortcut: "Ctrl+-",
          onClick: () => void window.api.window.zoom(-1),
        },
        {
          key: "menu.zoomReset",
          shortcut: "Ctrl+0",
          onClick: () => void window.api.window.zoom(0),
        },
      ],
    },
    {
      id: "help",
      label: "menu.help",
      items: [
        { key: "menu.about", onClick: () => void window.api.app.showAbout() },
      ],
    },
  ];

  function runItem(item: MenuItem): void {
    setOpenMenu(null);
    item.onClick();
  }

  return (
    <header className={`titlebar${isMac ? " titlebar--mac" : ""}`}>
      <div className="titlebar__menubar" ref={menuBarRef}>
        {!isMac && (
          <img
            src={asset("sreda.png")}
            alt="CrabCode"
            className="titlebar__logo"
          />
        )}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
        {menus.map((m) => (
          <div key={m.id} className="titlebar__menu">
            <button
              type="button"
<<<<<<< HEAD
              className={`titlebar__menu-btn${openMenu === m.id ? ' titlebar__menu-btn--on' : ''}`}
=======
              className={`titlebar__menu-btn${openMenu === m.id ? " titlebar__menu-btn--on" : ""}`}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
              onClick={() => setOpenMenu((cur) => (cur === m.id ? null : m.id))}
              onMouseEnter={() => setOpenMenu((cur) => (cur ? m.id : cur))}
            >
              {t(m.label)}
            </button>
            {openMenu === m.id && (
              <div className="titlebar__dropdown" role="menu">
                {m.items.map((item) => (
                  <div key={item.key}>
<<<<<<< HEAD
                    {item.separatorBefore && <div className="titlebar__dropdown-sep" />}
=======
                    {item.separatorBefore && (
                      <div className="titlebar__dropdown-sep" />
                    )}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
                    <button
                      type="button"
                      role="menuitem"
                      className="titlebar__dropdown-item"
                      onClick={() => runItem(item)}
                    >
<<<<<<< HEAD
                      <span className="titlebar__dropdown-label">{t(item.key)}</span>
                      {item.shortcut && (
                        <span className="titlebar__dropdown-shortcut">{item.shortcut}</span>
=======
                      <span className="titlebar__dropdown-label">
                        {t(item.key)}
                      </span>
                      {item.shortcut && (
                        <span className="titlebar__dropdown-shortcut">
                          {item.shortcut}
                        </span>
>>>>>>> baf0023 (release: CrabCode 0.2.8)
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
<<<<<<< HEAD
=======
        <ProjectSwitcher />
>>>>>>> baf0023 (release: CrabCode 0.2.8)
      </div>

      <div className="titlebar__drag" />

<<<<<<< HEAD
      <span className="titlebar__title" aria-hidden="true">CrabCode</span>

      <div className="titlebar__controls">
        <button
          className={`titlebar__icon-btn titlebar__browser-btn${browserOpen ? ' titlebar__icon-btn--on' : ''}`}
=======
      <span className="titlebar__title" aria-hidden="true">
        CrabCode
      </span>

      <div className="titlebar__controls">
        <button
          className={`titlebar__icon-btn titlebar__browser-btn${browserOpen ? " titlebar__icon-btn--on" : ""}`}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
          type="button"
          aria-label="Browser (agent's eyes)"
          aria-pressed={browserOpen}
          title="Internal browser — the agent's eyes"
          onClick={onToggleBrowser}
        >
<<<<<<< HEAD
          <MousePointer2 size={19} />
        </button>
        <GithubAvatar />
        <button
          className={`titlebar__icon-btn${leftOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.toggleSidebar')}
          aria-pressed={leftOpen}
          title={t('nav.toggleSidebarHint')}
=======
          <GoogleBrowserIcon />
        </button>
        <GithubAvatar />
        <button
          className={`titlebar__icon-btn${leftOpen ? " titlebar__icon-btn--on" : ""}`}
          type="button"
          aria-label={t("nav.toggleSidebar")}
          aria-pressed={leftOpen}
          title={t("nav.toggleSidebarHint")}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
          onClick={onToggleSidebar}
        >
          <PanelLeftIcon filled={leftOpen} />
        </button>
        <button
<<<<<<< HEAD
          className={`titlebar__icon-btn${terminalOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.openTerminal')}
          aria-pressed={terminalOpen}
          title={t('nav.openTerminalHint')}
=======
          className={`titlebar__icon-btn${terminalOpen ? " titlebar__icon-btn--on" : ""}`}
          type="button"
          aria-label={t("nav.openTerminal")}
          aria-pressed={terminalOpen}
          title={t("nav.openTerminalHint")}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
          onClick={onToggleTerminal}
        >
          <PanelBottomIcon filled={terminalOpen} />
        </button>
        <button
<<<<<<< HEAD
          className={`titlebar__icon-btn${rightOpen ? ' titlebar__icon-btn--on' : ''}`}
          type="button"
          aria-label={t('nav.toggleRight')}
          aria-pressed={rightOpen}
          title={t('nav.toggleRightHint')}
=======
          className={`titlebar__icon-btn${rightOpen ? " titlebar__icon-btn--on" : ""}`}
          type="button"
          aria-label={t("nav.toggleRight")}
          aria-pressed={rightOpen}
          title={t("nav.toggleRightHint")}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
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
<<<<<<< HEAD
              aria-label={t('nav.minimize')}
=======
              aria-label={t("nav.minimize")}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
              onClick={() => window.api.window.minimize()}
            >
              <Minus size={15} />
            </button>
            <button
              className="titlebar__control"
              type="button"
<<<<<<< HEAD
              aria-label={maximized ? t('nav.restore') : t('nav.maximize')}
              onClick={() => window.api.window.toggleMaximize().then(setMaximized)}
=======
              aria-label={maximized ? t("nav.restore") : t("nav.maximize")}
              onClick={() =>
                window.api.window.toggleMaximize().then(setMaximized)
              }
>>>>>>> baf0023 (release: CrabCode 0.2.8)
            >
              {maximized ? <Copy size={13} /> : <Square size={12} />}
            </button>
            <button
              className="titlebar__control titlebar__control--danger"
              type="button"
<<<<<<< HEAD
              aria-label={t('nav.close')}
=======
              aria-label={t("nav.close")}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
              onClick={() => window.api.window.close()}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </header>
<<<<<<< HEAD
  )
=======
  );
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}
