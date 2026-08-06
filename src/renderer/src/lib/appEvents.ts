
type Handler<T> = (payload: T) => void

interface Events {
  'terminal:run': { command: string; watch?: boolean; runId?: string }
  'terminal:trace': {
    runId: string
    command: string
    output: string
    cwd: string | null
    startedAt: number
  }
  'terminal:result': {
    runId: string
    command: string
    ok: boolean
    exitCode: number | null
    output: string
    cwd: string | null
    projectRoot: string | null
    timedOut?: boolean
  }
  'fs:changed': { root?: string; path?: string }
  'settings:section': { section: string }
  'layout:changed': { layout: 'files-left' | 'chat-left' }
  'composer:insert': { text: string }
  'composer:mention': {
    path: string
    name: string
    isDir: boolean
    line?: number
    endLine?: number
  }
  'composer:image': { dataUrl: string; name: string }
  'composer:block': {
    url: string
    title?: string
    selector: string
    html: string
    css: string
    text?: string
    screenshot?: string
  }
  'editor:open': { path: string; line?: number; column?: number }
  'editor:reload': { path: string }
  'editor:agentEdit': { path: string; before?: string; after?: string }
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
  'editor:saveAll': void
  'edits:accept': { id?: string }
  'edits:reject': { id?: string }
  'changes:remove': { path: string }
}

const listeners: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

export type TerminalRunRequest = Events['terminal:run']

let pendingCommand: TerminalRunRequest | null = null

export function queueTerminalCommand(command: string | TerminalRunRequest): void {
  pendingCommand = typeof command === 'string' ? { command } : command
}

export function takePendingCommand(): TerminalRunRequest | null {
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
  const map = listeners as Record<string, Set<Handler<unknown>>>
  const set = (map[event as string] ??= new Set())
  set.add(handler as Handler<unknown>)
  return () => {
    set.delete(handler as Handler<unknown>)
  }
}

export function emit<K extends keyof Events>(event: K, payload: Events[K]): void {
  const map = listeners as Record<string, Set<Handler<unknown>> | undefined>
  const set = map[event as string]
  set?.forEach((h) => h(payload))
}
