import { useMemo, useRef, useState } from 'react'
import {
  FolderOpen,
  SquarePen,
  PanelLeft,
  PanelRight,
  SquareTerminal,
  Settings,
  Palette,
  FolderGit2,
  Columns2,
  Search,
  type LucideIcon
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { applyThemeId, getThemeId } from '../../lib/theme'
import { THEMES, getThemeDef } from '../../theme/themes'
import { emit } from '../../lib/appEvents'

interface Command {
  id: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  themeId?: string
  run: () => void
}

export function GlobalPalette({
  onClose,
  toggleLeft,
  toggleRight,
  toggleTerminal
}: {
  onClose: () => void
  toggleLeft: () => void
  toggleRight: () => void
  toggleTerminal: () => void
}): JSX.Element {
  const { state, createConversation, openProject, selectProject, setView } = useApp()
  const [query, setQuery] = useState('')
  const baseThemeRef = useRef<string>(getThemeId())
  const themeCommittedRef = useRef(false)

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: 'new-session',
        title: 'New session',
        icon: SquarePen,
        run: () => createConversation(state.activeRepositoryId)
      },
      { id: 'open-folder', title: 'Open folder…', icon: FolderOpen, run: () => void openProject() },
      { id: 'search', title: 'Search in files', icon: Search, run: () => emit('search:open', {}) },
      { id: 'toggle-left', title: 'Toggle file panel', icon: PanelLeft, run: toggleLeft },
      { id: 'toggle-right', title: 'Toggle chat panel', icon: PanelRight, run: toggleRight },
      { id: 'toggle-terminal', title: 'Toggle terminal', icon: SquareTerminal, run: toggleTerminal },
      { id: 'split-on', title: 'Split editor', icon: Columns2, run: () => emit('editor:split', { on: true }) },
      { id: 'split-off', title: 'Unsplit editor', icon: Columns2, run: () => emit('editor:split', { on: false }) },
      { id: 'settings', title: 'Open settings', icon: Settings, run: () => setView('settings') }
    ]
    for (const r of state.repositories) {
      list.push({
        id: `proj:${r.id}`,
        title: `Switch to project: ${r.name}`,
        subtitle: 'Project',
        icon: FolderGit2,
        run: () => selectProject(r.id)
      })
    }
    for (const th of THEMES) {
      list.push({
        id: `theme:${th.id}`,
        title: `Theme: ${th.name}`,
        subtitle: th.base === 'light' ? 'Light' : 'Dark',
        icon: Palette,
        themeId: th.id,
        run: () => applyThemeId(th.id)
      })
    }
    return list
  }, [state.repositories, state.activeRepositoryId, createConversation, openProject, selectProject, setView, toggleLeft, toggleRight, toggleTerminal])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? commands.filter(
        (c) => c.title.toLowerCase().includes(q) || (c.subtitle?.toLowerCase().includes(q) ?? false)
      )
    : commands

  const items: PaletteItem<Command>[] = filtered.slice(0, 50).map((c) => {
    const Icon = c.icon
    return {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      icon: Icon ? <Icon size={15} /> : undefined,
      data: c
    }
  })

  return (
    <CommandPalette<Command>
      placeholder="Type a command…"
      query={query}
      onQueryChange={setQuery}
      items={items}
      empty="No matching commands"
      onActiveChange={(item) => {
        if (item.data?.themeId) applyThemeId(item.data.themeId)
        else applyThemeId(baseThemeRef.current)
      }}
      onSelect={(item) => {
        if (item.data?.themeId) {
          themeCommittedRef.current = true
          baseThemeRef.current = item.data.themeId
          const def = getThemeDef(item.data.themeId)
          void window.api.settings.setGeneral({ themeId: item.data.themeId, theme: def.base })
        }
        item.data?.run()
        onClose()
      }}
      onClose={() => {
        if (!themeCommittedRef.current) applyThemeId(baseThemeRef.current)
        onClose()
      }}
    />
  )
}
