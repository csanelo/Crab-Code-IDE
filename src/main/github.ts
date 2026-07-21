import { ipcMain, safeStorage, type IpcMain } from 'electron'
import { app } from 'electron'
import Store from 'electron-store'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'


interface GithubState {
  tokenEnc?: string
  login?: string
  avatarUrl?: string
}

const store = new Store<{ github: GithubState }>({
  name: 'sreda-github',
  defaults: { github: {} }
})

let cached: GithubState = { ...store.get('github') }

function persist(): void {
  store.set('github', cached)
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

function token(): string {
  return decrypt(cached.tokenEnc)
}

function authHeaderArgs(): string[] {
  const t = token()
  if (!t) return []
  const basic = Buffer.from(`x-access-token:${t}`).toString('base64')
  return ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`]
}

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

function runGit(args: string[], cwd?: string): Promise<GitResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let child: ReturnType<typeof spawn>
    try {
      child = spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      })
    } catch (err) {
      resolve({ code: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err) })
      return
    }
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: stderr || err.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function reposRoot(): string {
  return join(app.getPath('userData'), 'repos')
}

async function ghFetch(path: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CrabCode'
    }
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

export interface GithubRepo {
  fullName: string
  name: string
  owner: string
  cloneUrl: string
  private: boolean
  description: string | null
  updatedAt: string
}


export function getGithubAuth(): { connected: boolean; login: string | null } {
  return { connected: Boolean(cached.tokenEnc), login: cached.login ?? null }
}

export async function connectGithub(
  pat: string
): Promise<{ ok: boolean; login?: string | null; error?: string }> {
  const clean = (pat ?? '').trim()
  if (!clean) return { ok: false, error: 'Token is empty' }
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${clean}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CrabCode'
    }
  })
  if (!res.ok) {
    return { ok: false, error: res.status === 401 ? 'Invalid token' : `GitHub error ${res.status}` }
  }
  const user = (await res.json()) as { login?: string; avatar_url?: string }
  cached = { tokenEnc: encrypt(clean), login: user.login, avatarUrl: user.avatar_url }
  persist()
  return { ok: true, login: user.login ?? null }
}

export async function commitAndPush(payload: {
  path: string
  message: string
  paths?: string[]
}): Promise<{ ok: boolean; error?: string; committed?: boolean }> {
  const { path, message, paths } = payload
  if (!path || !existsSync(join(path, '.git'))) return { ok: false, error: 'Not a git repo' }
  if (!cached.tokenEnc) return { ok: false, error: 'GitHub is not connected' }

  const name = cached.login || 'CrabCode'
  const email = cached.login ? `${cached.login}@users.noreply.github.com` : 'agent@crabcode.app'

  const add =
    paths && paths.length > 0
      ? await runGit(['add', '--', ...paths], path)
      : await runGit(['add', '-A'], path)
  if (add.code !== 0) return { ok: false, error: add.stderr.trim() || 'git add failed' }

  const commitArgs = ['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-m', message || 'Update']
  if (paths && paths.length > 0) commitArgs.push('--', ...paths)
  const commit = await runGit(commitArgs, path)
  if (commit.code !== 0) {
    if (/nothing to commit/i.test(commit.stdout + commit.stderr)) {
      return { ok: false, error: 'Nothing to commit' }
    }
    return { ok: false, error: commit.stderr.trim() || 'Commit failed' }
  }

  const push = await runGit([...authHeaderArgs(), 'push'], path)
  if (push.code !== 0) {
    const branchRes = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], path)
    const branch = branchRes.stdout.trim() || 'main'
    const push2 = await runGit([...authHeaderArgs(), 'push', '--set-upstream', 'origin', branch], path)
    if (push2.code !== 0) {
      return { ok: false, error: push2.stderr.trim() || 'Push failed', committed: true }
    }
  }
  return { ok: true }
}

export function registerGithub(ipcMain_: IpcMain = ipcMain): void {
  ipcMain_.handle('github:get-auth', async () => {
    if (cached.tokenEnc && !cached.avatarUrl) {
      try {
        const { ok, data } = await ghFetch('/user')
        if (ok && data && typeof data === 'object') {
          const u = data as { login?: string; avatar_url?: string }
          if (u.avatar_url) {
            cached.avatarUrl = u.avatar_url
            if (u.login) cached.login = u.login
            persist()
          }
        }
      } catch {
      }
    }
    return {
      connected: Boolean(cached.tokenEnc),
      login: cached.login ?? null,
      avatarUrl: cached.avatarUrl ?? null
    }
  })

  ipcMain_.handle('github:connect', async (_e, pat: string) => {
    const r = await connectGithub(pat)
    return { ...r, avatarUrl: cached.avatarUrl ?? null }
  })

  ipcMain_.handle('github:disconnect', () => {
    cached = {}
    persist()
    return { ok: true }
  })

  ipcMain_.handle('github:list-repos', async () => {
    if (!cached.tokenEnc) return { ok: false, error: 'Not connected', repos: [] as GithubRepo[] }
    const { ok, status, data } = await ghFetch(
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
    )
    if (!ok || !Array.isArray(data)) {
      return { ok: false, error: `GitHub error ${status}`, repos: [] as GithubRepo[] }
    }
    const repos: GithubRepo[] = (data as Array<Record<string, unknown>>).map((r) => ({
      fullName: String(r.full_name),
      name: String(r.name),
      owner: String((r.owner as { login?: string })?.login ?? ''),
      cloneUrl: String(r.clone_url),
      private: Boolean(r.private),
      description: (r.description as string) ?? null,
      updatedAt: String(r.updated_at ?? '')
    }))
    return { ok: true, repos }
  })

  ipcMain_.handle(
    'github:clone',
    async (_e, payload: { fullName: string; cloneUrl: string }) => {
      if (!cached.tokenEnc) return { error: 'Not connected' }
      const safeName = payload.fullName.replace(/[\\/]/g, '__')
      const dest = join(reposRoot(), safeName)
      try {
        await mkdir(reposRoot(), { recursive: true })
      } catch {
      }
      if (existsSync(join(dest, '.git'))) {
        return { path: dest, name: payload.fullName }
      }
      const res = await runGit([...authHeaderArgs(), 'clone', payload.cloneUrl, dest])
      if (res.code !== 0) {
        const msg = /not found|could not resolve|git'? is not recognized|command not found/i.test(
          res.stderr
        )
          ? res.stderr.trim() || 'git is not installed or repo not found'
          : res.stderr.trim() || 'Clone failed'
        return { error: msg }
      }
      return { path: dest, name: payload.fullName }
    }
  )

  ipcMain_.handle('github:status', async (_e, path: string) => {
    if (!path || !existsSync(join(path, '.git'))) return { isRepo: false }
    const branchRes = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], path)
    const statusRes = await runGit(['status', '--porcelain'], path)
    const aheadRes = await runGit(['rev-list', '--count', '@{u}..HEAD'], path)
    const behindRes = await runGit(['rev-list', '--count', 'HEAD..@{u}'], path)
    const upstreamRes = await runGit(['rev-parse', '--abbrev-ref', '@{u}'], path)
    const changed = statusRes.stdout.split('\n').filter((l) => l.trim().length > 0).length
    const ahead = Number.parseInt(aheadRes.stdout.trim(), 10)
    const behind = Number.parseInt(behindRes.stdout.trim(), 10)
    return {
      isRepo: true,
      branch: branchRes.stdout.trim() || 'HEAD',
      changed,
      ahead: Number.isFinite(ahead) ? ahead : 0,
      behind: Number.isFinite(behind) ? behind : 0,
      hasUpstream: upstreamRes.code === 0
    }
  })

  ipcMain_.handle('github:pull', async (_e, path: string) => {
    if (!path || !existsSync(join(path, '.git'))) return { ok: false, error: 'Not a git repo' }
    const res = await runGit([...authHeaderArgs(), 'pull', '--no-rebase'], path)
    if (res.code !== 0) {
      return { ok: false, error: res.stderr.trim() || res.stdout.trim() || 'Pull failed' }
    }
    return { ok: true }
  })

  ipcMain_.handle(
    'github:commit-push',
    async (_e, payload: { path: string; message: string; paths?: string[] }) => {
      return commitAndPush(payload)
    }
  )
}

export function repoDisplayName(path: string): string {
  return basename(path).replace(/__/g, '/')
}

export function registerSsh(ipcMain_: IpcMain = ipcMain): void {
  ipcMain_.handle('ssh:clone', async (_e, payload: { url: string }) => {
    const url = (payload?.url ?? '').trim()
    if (!url) return { error: 'URL is empty' }
    if (!/^(ssh:\/\/|git@|[^@\s]+@[^:\s]+:)/.test(url)) {
      return { error: 'Not an SSH git URL (expected git@host:owner/repo.git)' }
    }
    const tail = url.replace(/\.git$/, '').replace(/^ssh:\/\//, '')
    const m = /[:/]([^/:]+\/[^/:]+)$/.exec(tail) ?? /[:/]([^/:]+)$/.exec(tail)
    const fullName = (m?.[1] ?? tail).replace(/^.*@/, '')
    const safeName = `ssh__${fullName.replace(/[\\/]/g, '__')}`
    const dest = join(reposRoot(), safeName)

    try {
      await mkdir(reposRoot(), { recursive: true })
    } catch {
    }
    if (existsSync(join(dest, '.git'))) {
      return { path: dest, name: fullName }
    }
    const res = await runGit(
      ['-c', 'core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new', 'clone', url, dest]
    )
    if (res.code !== 0) {
      return { error: res.stderr.trim() || 'SSH clone failed' }
    }
    return { path: dest, name: fullName }
  })
}
