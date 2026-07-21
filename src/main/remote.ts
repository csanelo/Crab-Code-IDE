import { ipcMain, safeStorage, type IpcMain } from 'electron'
import Store from 'electron-store'
import { readFile } from 'node:fs/promises'
import { Client, type ClientChannel, type SFTPWrapper } from 'ssh2'


export interface RemoteHostConfig {
  id: string
  label: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  passwordEnc?: string
  keyPath?: string
  passphraseEnc?: string
  remoteRoot: string
}

interface StoredState {
  hosts: RemoteHostConfig[]
}

const store = new Store<{ remote: StoredState }>({
  name: 'sreda-remote',
  defaults: { remote: { hosts: [] } }
})

let cached: StoredState = { hosts: [], ...store.get('remote') }

function persist(): void {
  store.set('remote', cached)
}

function encrypt(plain: string): string {
  if (!plain) return ''
  if (!safeStorage.isEncryptionAvailable()) return `plain:${plain}`
  return `enc:${safeStorage.encryptString(plain).toString('base64')}`
}

function decrypt(value: string | undefined): string {
  if (!value) return ''
  if (value.startsWith('plain:')) return value.slice(6)
  if (value.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    } catch {
      return ''
    }
  }
  return value
}

interface Live {
  client: Client
  sftp: SFTPWrapper
}

const live = new Map<string, Live>()

export const REMOTE_SCHEME = 'ssh://'

export function isRemotePath(p: string): boolean {
  return typeof p === 'string' && p.startsWith(REMOTE_SCHEME)
}

export function parseRemote(p: string): { id: string; path: string } | null {
  if (!isRemotePath(p)) return null
  const rest = p.slice(REMOTE_SCHEME.length)
  const slash = rest.indexOf('/')
  if (slash < 0) return { id: rest, path: '/' }
  return { id: rest.slice(0, slash), path: rest.slice(slash) }
}

function makeRemotePath(id: string, path: string): string {
  return `${REMOTE_SCHEME}${id}${path.startsWith('/') ? '' : '/'}${path}`
}

async function connect(cfg: RemoteHostConfig): Promise<Live> {
  const existing = live.get(cfg.id)
  if (existing) return existing

  const client = new Client()
  const connectConfig: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port || 22,
    username: cfg.username,
    keepaliveInterval: 15000,
    readyTimeout: 20000
  }
  if (cfg.authType === 'password') {
    connectConfig.password = decrypt(cfg.passwordEnc)
  } else {
    connectConfig.privateKey = await readFile(cfg.keyPath ?? '', 'utf8')
    const pass = decrypt(cfg.passphraseEnc)
    if (pass) connectConfig.passphrase = pass
  }

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => resolve())
    client.on('error', (err) => reject(err))
    client.connect(connectConfig)
  })

  const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
    client.sftp((err, s) => (err ? reject(err) : resolve(s)))
  })

  const entry: Live = { client, sftp }
  client.on('close', () => live.delete(cfg.id))
  live.set(cfg.id, entry)
  return entry
}

function sanitize(h: RemoteHostConfig): Omit<RemoteHostConfig, 'passwordEnc' | 'passphraseEnc'> & {
  hasPassword: boolean
  hasPassphrase: boolean
} {
  const { passwordEnc, passphraseEnc, ...rest } = h
  return { ...rest, hasPassword: Boolean(passwordEnc), hasPassphrase: Boolean(passphraseEnc) }
}


function sftpReadDir(
  sftp: SFTPWrapper,
  path: string
): Promise<Array<{ name: string; path: string; isDir: boolean }>> {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      if (err) return reject(err)
      const base = path.endsWith('/') ? path : `${path}/`
      const out = list
        .map((e) => ({
          name: e.filename,
          path: `${base}${e.filename}`,
          isDir: e.longname.startsWith('d') || (e.attrs.mode & 0o40000) === 0o40000
        }))
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      resolve(out)
    })
  })
}

function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const stream = sftp.createReadStream(path)
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

function sftpWriteFile(sftp: SFTPWrapper, path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(path)
    stream.on('error', reject)
    stream.on('close', () => resolve())
    stream.end(content, 'utf8')
  })
}

function sftpMkdir(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err) => (err ? reject(err) : resolve()))
  })
}

function sftpUnlink(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(path, (err) => (err ? reject(err) : resolve()))
  })
}

function sftpRename(sftp: SFTPWrapper, from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(from, to, (err) => (err ? reject(err) : resolve()))
  })
}

export function remoteExec(
  id: string,
  command: string,
  cwd?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const conn = live.get(id)
  if (!conn) return Promise.resolve({ code: 1, stdout: '', stderr: 'Not connected' })
  const full = cwd ? `cd ${JSON.stringify(cwd)} && ${command}` : command
  return new Promise((resolve) => {
    conn.client.exec(full, (err, stream: ClientChannel) => {
      if (err) return resolve({ code: 1, stdout: '', stderr: err.message })
      let stdout = ''
      let stderr = ''
      stream.on('data', (d: Buffer) => (stdout += d.toString()))
      stream.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
      stream.on('close', (code: number) => resolve({ code: code ?? 0, stdout, stderr }))
    })
  })
}

export async function ensureRemote(id: string): Promise<Live | null> {
  if (live.has(id)) return live.get(id) ?? null
  const cfg = cached.hosts.find((h) => h.id === id)
  if (!cfg) return null
  try {
    return await connect(cfg)
  } catch {
    return null
  }
}

export const remoteSftp = {
  readDir: sftpReadDir,
  readFile: sftpReadFile,
  writeFile: sftpWriteFile,
  mkdir: sftpMkdir,
  unlink: sftpUnlink,
  rename: sftpRename
}

export function registerRemote(ipcMain_: IpcMain = ipcMain): void {
  ipcMain_.handle('remote:list', () => cached.hosts.map(sanitize))

  ipcMain_.handle('remote:upsert', (_e, partial: RemoteHostConfig & { password?: string; passphrase?: string }) => {
    const existing = cached.hosts.find((h) => h.id === partial.id)
    const next: RemoteHostConfig = {
      id: partial.id || `host_${Date.now().toString(36)}`,
      label: partial.label || partial.host,
      host: partial.host,
      port: partial.port || 22,
      username: partial.username,
      authType: partial.authType,
      keyPath: partial.keyPath,
      remoteRoot: partial.remoteRoot || '.',
      passwordEnc:
        partial.password !== undefined && partial.password !== ''
          ? encrypt(partial.password)
          : existing?.passwordEnc,
      passphraseEnc:
        partial.passphrase !== undefined && partial.passphrase !== ''
          ? encrypt(partial.passphrase)
          : existing?.passphraseEnc
    }
    cached.hosts = existing
      ? cached.hosts.map((h) => (h.id === next.id ? next : h))
      : [...cached.hosts, next]
    persist()
    return { id: next.id }
  })

  ipcMain_.handle('remote:remove', (_e, id: string) => {
    cached.hosts = cached.hosts.filter((h) => h.id !== id)
    live.get(id)?.client.end()
    live.delete(id)
    persist()
    return true
  })

  ipcMain_.handle('remote:connect', async (_e, id: string) => {
    const cfg = cached.hosts.find((h) => h.id === id)
    if (!cfg) return { error: 'Host not found' }
    try {
      const conn = await connect(cfg)
      let root = cfg.remoteRoot || '.'
      if (!root.startsWith('/')) {
        const pwd = await remoteExec(id, `cd ${JSON.stringify(root)} && pwd`)
        root = pwd.code === 0 ? pwd.stdout.trim() || '/' : '/'
      }
      void conn
      return {
        id,
        label: cfg.label,
        rootPath: makeRemotePath(id, root)
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain_.handle('remote:disconnect', (_e, id: string) => {
    live.get(id)?.client.end()
    live.delete(id)
    return true
  })

  ipcMain_.handle('remote:read-dir', async (_e, remotePath: string) => {
    const r = parseRemote(remotePath)
    if (!r) return []
    const conn = await ensureRemote(r.id)
    if (!conn) return []
    try {
      const list = await sftpReadDir(conn.sftp, r.path)
      return list.map((e) => ({ name: e.name, path: makeRemotePath(r.id, e.path), isDir: e.isDir }))
    } catch {
      return []
    }
  })

  ipcMain_.handle('remote:read-file', async (_e, remotePath: string) => {
    const r = parseRemote(remotePath)
    if (!r) return null
    const conn = await ensureRemote(r.id)
    if (!conn) return null
    try {
      const content = await sftpReadFile(conn.sftp, r.path)
      return { path: remotePath, name: r.path.split('/').pop() ?? r.path, content }
    } catch {
      return null
    }
  })

  ipcMain_.handle('remote:write-file', async (_e, payload: { path: string; content: string }) => {
    const r = parseRemote(payload.path)
    if (!r) return { error: 'Bad path' }
    const conn = await ensureRemote(r.id)
    if (!conn) return { error: 'Not connected' }
    try {
      await sftpWriteFile(conn.sftp, r.path, payload.content)
      return { path: payload.path }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain_.handle('remote:exec', async (_e, payload: { id: string; command: string; cwd?: string }) => {
    const r = payload.cwd ? parseRemote(payload.cwd) : null
    return remoteExec(payload.id, payload.command, r?.path)
  })
}
