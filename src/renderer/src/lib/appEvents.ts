
type Handler<T> = (payload: T) => void

interface Events {
  'terminal:run': { command: string }
  'fs:changed': void
  'settings:section': { section: string }
  'composer:insert': { text: string }
  'composer:mention': { path: string; name: string; isDir: boolean }
  'composer:image': { dataUrl: string; name: string }
  'editor:open': { path: string; line?: number; column?: number }
  'editor:reload': { path: string }
  'editor:agentEdit': { path: string }
  'github:auth': void
  'toast': { id?: string; kind?: 'info' | 'success' | 'error'; message: string }
  'palette:open': void
  'search:open': { query?: string }
  'editor:split': { on: boolean }
  'browser:toggle': { on?: boolean; url?: string }
  'browser:navigate': { url: string }
  'browser:capture': { kind: 'text' | 'screenshot'; requestId: string }
  'browser:captured': { requestId: string; ok: boolean; data?: string; url?: string; title?: string; error?: string }
  'editor:fileCount': { count: number }
  'mcp:open': void
}

const listeners: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

let pendingCommand: string | null = null

export function queueTerminalCommand(command: string): void {
  pendingCommand = command
}

export function takePendingCommand(): string | null {
  const c = pendingCommand
  pendingCommand = null
  return c
}

let pendingSettingsSection: string | null = null

export function queueSettingsSection(section: string): void {
  pendingSettingsSection = section
}

export function takeSettingsSection(): string | null {
  const s = pendingSettingsSection
  pendingSettingsSection = null
  return s
}

export function on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
  const set = (listeners[event] ??= new Set()) as Set<Handler<Events[K]>>
  set.add(handler)
  return () => set.delete(handler)
}

export function emit<K extends keyof Events>(event: K, payload: Events[K]): void {
  const set = listeners[event] as Set<Handler<Events[K]>> | undefined
  set?.forEach((h) => h(payload))
}
