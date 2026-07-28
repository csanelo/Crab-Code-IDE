import { ipcMain } from 'electron'
import Store from 'electron-store'


export type McpTransport = 'stdio' | 'http' | 'sse'

export interface McpServer {
  id: string
  name: string
  transport: McpTransport
  enabled: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

interface State {
  servers: McpServer[]
}

const DEFAULTS: State = { servers: [] }

const store = new Store<{ mcp: State }>({
  name: 'sreda-mcp',
  defaults: { mcp: DEFAULTS }
})

let cached: State = { ...DEFAULTS, ...store.get('mcp') }

function persist(): void {
  store.set('mcp', cached)
}

function normalize(input: Partial<McpServer> & { id?: string }): McpServer {
  const id = input.id || `mcp-${Date.now().toString(36)}`
  const transport: McpTransport = (input.transport as McpTransport) || 'stdio'
  return {
    id,
    name: (input.name ?? '').trim() || 'mcp-server',
    transport,
    enabled: input.enabled ?? true,
    command: transport === 'stdio' ? input.command?.trim() || '' : undefined,
    args: transport === 'stdio' ? input.args ?? [] : undefined,
    env: transport === 'stdio' ? input.env ?? {} : undefined,
    url: transport !== 'stdio' ? input.url?.trim() || '' : undefined,
    headers: transport !== 'stdio' ? input.headers ?? {} : undefined
  }
}

export function addMcpServer(input: Partial<McpServer> & { id?: string }): McpServer {
  const next = normalize(input)
  const existing = cached.servers.findIndex((s) => s.id === next.id || s.name === next.name)
  if (existing >= 0) {
    cached.servers = cached.servers.map((s, i) => (i === existing ? { ...next, id: cached.servers[i].id } : s))
  } else {
    cached.servers = [...cached.servers, next]
  }
  persist()
  return next
}

export function listMcpServers(): McpServer[] {
  return cached.servers
}

export function registerMcp(ipcMain_: typeof ipcMain): void {
  ipcMain_.handle('mcp:list', () => cached.servers)

  ipcMain_.handle('mcp:upsert', (_e, payload: Partial<McpServer> & { id?: string }) => {
    const next = normalize(payload)
    const existing = cached.servers.findIndex((s) => s.id === next.id)
    if (existing >= 0) {
      cached.servers = cached.servers.map((s, i) => (i === existing ? next : s))
    } else {
      cached.servers = [...cached.servers, next]
    }
    persist()
    return cached.servers
  })

  ipcMain_.handle('mcp:remove', (_e, id: string) => {
    cached.servers = cached.servers.filter((s) => s.id !== id)
    persist()
    return cached.servers
  })

  ipcMain_.handle('mcp:set-enabled', (_e, id: string, enabled: boolean) => {
    cached.servers = cached.servers.map((s) => (s.id === id ? { ...s, enabled } : s))
    persist()
    return cached.servers
  })
}
