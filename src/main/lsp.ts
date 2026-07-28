import type { IpcMain, WebContents } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { pathToFileURL } from 'node:url'


interface ServerConfig {
  languages: string[]
  candidates: { cmd: string; args: string[] }[]
}

const SERVERS: ServerConfig[] = [
  {
    languages: ['typescript', 'javascript'],
    candidates: [
      { cmd: 'typescript-language-server', args: ['--stdio'] },
      { cmd: 'typescript-language-server.cmd', args: ['--stdio'] }
    ]
  },
  {
    languages: ['python'],
    candidates: [
      { cmd: 'pyright-langserver', args: ['--stdio'] },
      { cmd: 'pyright-langserver.cmd', args: ['--stdio'] },
      { cmd: 'pylsp', args: [] }
    ]
  },
  { languages: ['rust'], candidates: [{ cmd: 'rust-analyzer', args: [] }] },
  { languages: ['go'], candidates: [{ cmd: 'gopls', args: [] }] },
  {
    languages: ['c', 'cpp'],
    candidates: [{ cmd: 'clangd', args: [] }, { cmd: 'clangd.exe', args: [] }]
  }
]

function configFor(languageId: string): ServerConfig | null {
  return SERVERS.find((s) => s.languages.includes(languageId)) ?? null
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
}

class LspServer {
  private child: ChildProcessWithoutNullStreams | null = null
  private buffer = Buffer.alloc(0)
  private contentLength = -1
  private nextId = 1
  private pending = new Map<number, Pending>()
  private opened = new Set<string>()
  ready: Promise<boolean>
  available = false

  constructor(
    private config: ServerConfig,
    private root: string,
    private send: (channel: string, ...args: unknown[]) => void
  ) {
    this.ready = this.init()
  }

  private async init(): Promise<boolean> {
    for (const cand of this.config.candidates) {
      try {
        const child = spawn(cand.cmd, cand.args, {
          cwd: this.root || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        })
        const ok = await new Promise<boolean>((resolve) => {
          let settled = false
          child.once('error', () => {
            if (!settled) {
              settled = true
              resolve(false)
            }
          })
          child.once('spawn', () => {
            if (!settled) {
              settled = true
              resolve(true)
            }
          })
          setTimeout(() => {
            if (!settled) {
              settled = true
              resolve(Boolean(child.pid))
            }
          }, 400)
        })
        if (!ok) continue
        this.child = child
        child.stdout.on('data', (d: Buffer) => this.onData(d))
        child.stderr.on('data', () => {
        })
        child.on('exit', () => {
          this.available = false
          this.child = null
        })
        await this.initialize()
        this.available = true
        return true
      } catch {
        continue
      }
    }
    return false
  }

  private async initialize(): Promise<void> {
    const rootUri = this.root ? pathToFileURL(this.root).toString() : null
    await this.request('initialize', {
      processId: process.pid,
      rootUri,
      workspaceFolders: rootUri ? [{ uri: rootUri, name: 'root' }] : null,
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: true },
          completion: {
            completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] }
          },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: true }
        },
        workspace: { workspaceFolders: true, configuration: true }
      }
    })
    this.notify('initialized', {})
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      if (this.contentLength < 0) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n')
        if (headerEnd === -1) return
        const header = this.buffer.subarray(0, headerEnd).toString('utf8')
        const m = /Content-Length:\s*(\d+)/i.exec(header)
        this.contentLength = m ? parseInt(m[1], 10) : 0
        this.buffer = this.buffer.subarray(headerEnd + 4)
      }
      if (this.buffer.length < this.contentLength) return
      const body = this.buffer.subarray(0, this.contentLength).toString('utf8')
      this.buffer = this.buffer.subarray(this.contentLength)
      this.contentLength = -1
      try {
        this.dispatch(JSON.parse(body))
      } catch {
      }
    }
  }

  private dispatch(msg: Record<string, unknown>): void {
    if (typeof msg.id === 'number' && (('result' in msg) || ('error' in msg))) {
      const p = this.pending.get(msg.id as number)
      if (p) {
        this.pending.delete(msg.id as number)
        if ('error' in msg) p.reject(new Error(JSON.stringify(msg.error)))
        else p.resolve(msg.result)
      }
      return
    }
    const method = msg.method as string | undefined
    if (method === 'textDocument/publishDiagnostics') {
      const params = msg.params as { uri: string; diagnostics: unknown[] }
      this.send('lsp:diagnostics', { uri: params.uri, diagnostics: params.diagnostics })
    } else if (method === 'workspace/configuration' && typeof msg.id === 'number') {
      const items = (msg.params as { items?: unknown[] })?.items ?? []
      this.respond(msg.id as number, items.map(() => ({})))
    } else if (typeof msg.id === 'number' && method) {
      this.respond(msg.id as number, null)
    }
  }

  private write(payload: Record<string, unknown>): void {
    if (!this.child) return
    const json = JSON.stringify(payload)
    const buf = Buffer.from(json, 'utf8')
    this.child.stdin.write(`Content-Length: ${buf.length}\r\n\r\n`)
    this.child.stdin.write(buf)
  }

  private respond(id: number, result: unknown): void {
    this.write({ jsonrpc: '2.0', id, result })
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: '2.0', method, params })
  }

  request(method: string, params: unknown, timeoutMs = 8000): Promise<unknown> {
    if (!this.child) return Promise.reject(new Error('server not running'))
    const id = this.nextId++
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.write({ jsonrpc: '2.0', id, method, params })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`LSP ${method} timed out`))
        }
      }, timeoutMs)
    })
  }

  didOpen(uri: string, languageId: string, text: string): void {
    if (this.opened.has(uri)) return
    this.opened.add(uri)
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text }
    })
  }

  didChange(uri: string, version: number, text: string): void {
    if (!this.opened.has(uri)) return
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }]
    })
  }

  didClose(uri: string): void {
    if (!this.opened.has(uri)) return
    this.opened.delete(uri)
    this.notify('textDocument/didClose', { textDocument: { uri } })
  }

  dispose(): void {
    try {
      this.child?.kill()
    } catch {
    }
    this.child = null
  }
}

const servers = new Map<string, LspServer>()

function serverKey(root: string, languageId: string): string {
  const cfg = configFor(languageId)
  const group = cfg ? cfg.languages[0] : languageId
  return `${root}::${group}`
}

async function getServer(
  root: string,
  languageId: string,
  send: (channel: string, ...args: unknown[]) => void
): Promise<LspServer | null> {
  const cfg = configFor(languageId)
  if (!cfg) return null
  const key = serverKey(root, languageId)
  let srv = servers.get(key)
  if (!srv) {
    srv = new LspServer(cfg, root, send)
    servers.set(key, srv)
  }
  const ok = await srv.ready
  if (!ok || !srv.available) {
    servers.delete(key)
    srv.dispose()
    return null
  }
  return srv
}

export function registerLsp(ipcMain: IpcMain): void {
  const sender = (wc: WebContents) => (channel: string, ...args: unknown[]): void => {
    if (!wc.isDestroyed()) wc.send(channel, ...args)
  }

  ipcMain.handle(
    'lsp:open',
    async (e, p: { root: string; languageId: string; uri: string; text: string }) => {
      const srv = await getServer(p.root, p.languageId, sender(e.sender))
      if (!srv) return { ok: false }
      srv.didOpen(p.uri, p.languageId, p.text)
      return { ok: true }
    }
  )

  ipcMain.handle(
    'lsp:change',
    async (e, p: { root: string; languageId: string; uri: string; version: number; text: string }) => {
      const srv = await getServer(p.root, p.languageId, sender(e.sender))
      if (!srv) return { ok: false }
      srv.didChange(p.uri, p.version, p.text)
      return { ok: true }
    }
  )

  ipcMain.handle('lsp:close', async (e, p: { root: string; languageId: string; uri: string }) => {
    const srv = await getServer(p.root, p.languageId, sender(e.sender))
    srv?.didClose(p.uri)
    return { ok: true }
  })

  ipcMain.handle(
    'lsp:completion',
    async (
      e,
      p: { root: string; languageId: string; uri: string; line: number; character: number }
    ) => {
      const srv = await getServer(p.root, p.languageId, sender(e.sender))
      if (!srv) return null
      try {
        return await srv.request('textDocument/completion', {
          textDocument: { uri: p.uri },
          position: { line: p.line, character: p.character }
        })
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'lsp:hover',
    async (
      e,
      p: { root: string; languageId: string; uri: string; line: number; character: number }
    ) => {
      const srv = await getServer(p.root, p.languageId, sender(e.sender))
      if (!srv) return null
      try {
        return await srv.request('textDocument/hover', {
          textDocument: { uri: p.uri },
          position: { line: p.line, character: p.character }
        })
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'lsp:definition',
    async (
      e,
      p: { root: string; languageId: string; uri: string; line: number; character: number }
    ) => {
      const srv = await getServer(p.root, p.languageId, sender(e.sender))
      if (!srv) return null
      try {
        return await srv.request('textDocument/definition', {
          textDocument: { uri: p.uri },
          position: { line: p.line, character: p.character }
        })
      } catch {
        return null
      }
    }
  )
}

export function killAllLsp(): void {
  for (const srv of servers.values()) srv.dispose()
  servers.clear()
}
