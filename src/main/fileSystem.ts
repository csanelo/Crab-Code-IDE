import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { readFile, writeFile, readdir, rename, rm, mkdir, cp, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import iconv from 'iconv-lite'
import { isRemotePath, parseRemote, ensureRemote, remoteSftp } from './remote'

export interface OpenedFile {
  path: string
  name: string
  content: string
  encoding?: string
}

function detectBom(buf: Buffer): { encoding: string; bomLength: number } | null {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf8bom', bomLength: 3 }
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { encoding: 'utf16le', bomLength: 2 }
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { encoding: 'utf16be', bomLength: 2 }
  }
  return null
}

function decodeBuffer(buf: Buffer, encoding?: string): { content: string; encoding: string } {
  const enc = encoding && encoding !== 'auto' ? encoding : (detectBom(buf)?.encoding ?? 'utf8')
  const normalized = enc.toLowerCase()
  try {
    if (normalized === 'utf8bom') {
      const bom = detectBom(buf)
      const body = bom?.encoding === 'utf8bom' ? buf.subarray(3) : buf
      return { content: body.toString('utf8'), encoding: 'utf8bom' }
    }
    if (!iconv.encodingExists(normalized)) {
      return { content: buf.toString('utf8'), encoding: 'utf8' }
    }
    return { content: iconv.decode(buf, normalized), encoding: normalized }
  } catch {
    return { content: buf.toString('utf8'), encoding: 'utf8' }
  }
}

function encodeContent(content: string, encoding?: string): Buffer {
  const enc = (encoding ?? 'utf8').toLowerCase()
  if (enc === 'utf8' || enc === 'utf-8') return Buffer.from(content, 'utf8')
  if (enc === 'utf8bom') {
    return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')])
  }
  try {
    if (iconv.encodingExists(enc)) {
      const addBOM = enc === 'utf16le' || enc === 'utf16be' || enc === 'utf16'
      return iconv.encode(content, enc, { addBOM })
    }
  } catch {
  }
  return Buffer.from(content, 'utf8')
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

const IGNORED = new Set([
  'node_modules',
  '.git',
  '.DS_Store',
  'dist',
  'out',
  '.cache',
  '.next',
  '.nuxt',
  '.vercel',
  '.parcel-cache',
  '.turbo',
  '.expo',
  'build',
  'target',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  '.idea',
  '.vscode',
  'coverage',
  '.gradle',
  'Pods',
  'DerivedData'
])

export function registerFileSystem(win: BrowserWindow): void {
  ipcMain.handle('fs:open-folder', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Открыть папку',
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    return { path, name: basename(path) }
  })

  ipcMain.handle('fs:open-file', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Открыть файл',
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const path = res.filePaths[0]
    const content = await readFile(path, 'utf8').catch(() => '')
    return { path, name: basename(path), content } satisfies OpenedFile
  })

  ipcMain.handle('fs:read-dir', async (_e, dir: string) => {
    if (isRemotePath(dir)) {
      const r = parseRemote(dir)
      const conn = r && (await ensureRemote(r.id))
      if (!r || !conn) return [] as DirEntry[]
      try {
        const list = await remoteSftp.readDir(conn.sftp, r.path)
        return list
          .filter((e) => !IGNORED.has(e.name))
          .map((e) => ({ name: e.name, path: `ssh://${r.id}${e.path}`, isDir: e.isDir }))
      } catch {
        return [] as DirEntry[]
      }
    }
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const mapped: DirEntry[] = entries
        .filter((e) => !IGNORED.has(e.name))
        .map((e) => ({ name: e.name, path: join(dir, e.name), isDir: e.isDirectory() }))
      mapped.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return mapped
    } catch {
      return [] as DirEntry[]
    }
  })

  ipcMain.handle('fs:read-file', async (_e, path: string, encoding?: string) => {
    if (isRemotePath(path)) {
      const r = parseRemote(path)
      const conn = r && (await ensureRemote(r.id))
      if (!r || !conn) return null
      try {
        const content = await remoteSftp.readFile(conn.sftp, r.path)
        return {
          path,
          name: r.path.split('/').pop() ?? r.path,
          content,
          encoding: 'utf8'
        } satisfies OpenedFile
      } catch {
        return null
      }
    }
    try {
      const buf = await readFile(path)
      const { content, encoding: used } = decodeBuffer(buf, encoding)
      return { path, name: basename(path), content, encoding: used } satisfies OpenedFile
    } catch {
      return null
    }
  })

  ipcMain.handle('fs:read-binary', async (_e, path: string) => {
    try {
      const buf = await readFile(path)
      return { path, name: basename(path), base64: buf.toString('base64'), size: buf.length }
    } catch {
      return null
    }
  })

  ipcMain.handle(
    'fs:write-binary',
    async (_e, payload: { path: string; base64: string }) => {
      try {
        await writeFile(payload.path, Buffer.from(payload.base64, 'base64'))
        return { path: payload.path, name: basename(payload.path) }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'fs:save',
    async (_e, payload: { path: string | null; content: string; encoding?: string }) => {
      if (payload.path && isRemotePath(payload.path)) {
        const r = parseRemote(payload.path)
        const conn = r && (await ensureRemote(r.id))
        if (!r || !conn) return null
        try {
          await remoteSftp.writeFile(conn.sftp, r.path, payload.content)
          return { path: payload.path, name: r.path.split('/').pop() ?? r.path }
        } catch {
          return null
        }
      }
      let target = payload.path
      if (!target) {
        const res = await dialog.showSaveDialog(win, { title: 'Сохранить' })
        if (res.canceled || !res.filePath) return null
        target = res.filePath
      }
      await writeFile(target, encodeContent(payload.content, payload.encoding))
      return { path: target, name: basename(target) }
    }
  )

  ipcMain.handle('fs:save-as', async (_e, payload: { content: string; suggestedName?: string }) => {
    const res = await dialog.showSaveDialog(win, {
      title: 'Сохранить как',
      defaultPath: payload.suggestedName
    })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, payload.content, 'utf8')
    return { path: res.filePath, name: basename(res.filePath) }
  })

  ipcMain.handle(
    'fs:rename',
    async (_e, payload: { path: string; newName: string }) => {
      if (isRemotePath(payload.path)) {
        const r = parseRemote(payload.path)
        const conn = r && (await ensureRemote(r.id))
        if (!r || !conn) return { error: 'Not connected' }
        const dest = r.path.replace(/[^/]+$/, payload.newName)
        try {
          await remoteSftp.rename(conn.sftp, r.path, dest)
          return { path: `ssh://${r.id}${dest}`, name: payload.newName }
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      }
      const dest = join(dirname(payload.path), payload.newName)
      try {
        await rename(payload.path, dest)
        return { path: dest, name: basename(dest) }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('fs:delete', async (_e, path: string) => {
    if (isRemotePath(path)) {
      const r = parseRemote(path)
      const conn = r && (await ensureRemote(r.id))
      if (!r || !conn) return false
      try {
        await remoteSftp.unlink(conn.sftp, r.path).catch(async () => {
          const { remoteExec } = await import('./remote')
          await remoteExec(r.id, `rm -rf ${JSON.stringify(r.path)}`)
        })
        return true
      } catch {
        return false
      }
    }
    try {
      await rm(path, { recursive: true, force: true })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'fs:import-data',
    async (_e, payload: { destDir: string; files: { name: string; base64: string }[] }) => {
      const { destDir, files } = payload
      const imported: { path: string; name: string }[] = []
      for (const file of files) {
        try {
          const base = basename(file.name) || 'file'
          let target = join(destDir, base)
          if (existsSync(target)) {
            const dot = base.lastIndexOf('.')
            const stem = dot > 0 ? base.slice(0, dot) : base
            const ext = dot > 0 ? base.slice(dot) : ''
            let i = 1
            while (existsSync(target)) {
              target = join(destDir, `${stem} ${i}${ext}`)
              i++
            }
          }
          await writeFile(target, Buffer.from(file.base64, 'base64'))
          imported.push({ path: target, name: basename(target) })
        } catch {
        }
      }
      return { imported }
    }
  )

  ipcMain.handle(
    'fs:import',
    async (_e, payload: { sources: string[]; destDir: string }) => {
      const { sources, destDir } = payload
      const imported: { path: string; name: string }[] = []
      for (const source of sources) {
        try {
          let target = join(destDir, basename(source))
          if (existsSync(target)) {
            const base = basename(source)
            const dot = base.lastIndexOf('.')
            const isFile = (await stat(source)).isFile()
            const stem = isFile && dot > 0 ? base.slice(0, dot) : base
            const ext = isFile && dot > 0 ? base.slice(dot) : ''
            let i = 1
            while (existsSync(target)) {
              target = join(destDir, `${stem} ${i}${ext}`)
              i++
            }
          }
          await cp(source, target, { recursive: true })
          imported.push({ path: target, name: basename(target) })
        } catch {
        }
      }
      return { imported }
    }
  )

  ipcMain.handle('fs:show-in-folder', async (_e, path: string) => {
    if (!path) return false
    shell.showItemInFolder(path)
    return true
  })

  ipcMain.handle(
    'fs:create-file',
    async (_e, payload: { dir: string; name?: string }) => {
      if (isRemotePath(payload.dir)) {
        const r = parseRemote(payload.dir)
        const conn = r && (await ensureRemote(r.id))
        if (!r || !conn) return { error: 'Not connected' }
        const base = payload.name?.trim() || 'untitled.txt'
        const target = `${r.path.replace(/\/$/, '')}/${base}`
        try {
          await remoteSftp.writeFile(conn.sftp, target, '')
          return { path: `ssh://${r.id}${target}`, name: base }
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      }
      try {
        const base = payload.name?.trim() || 'untitled.txt'
        let target = join(payload.dir, base)
        let i = 1
        const dot = base.lastIndexOf('.')
        const stem = dot > 0 ? base.slice(0, dot) : base
        const ext = dot > 0 ? base.slice(dot) : ''
        while (existsSync(target)) {
          target = join(payload.dir, `${stem} ${i}${ext}`)
          i++
        }
        await writeFile(target, '', 'utf8')
        return { path: target, name: basename(target) }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'fs:create-dir',
    async (_e, payload: { dir: string; name?: string }) => {
      if (isRemotePath(payload.dir)) {
        const r = parseRemote(payload.dir)
        const conn = r && (await ensureRemote(r.id))
        if (!r || !conn) return { error: 'Not connected' }
        const base = payload.name?.trim() || 'New folder'
        const target = `${r.path.replace(/\/$/, '')}/${base}`
        try {
          await remoteSftp.mkdir(conn.sftp, target)
          return { path: `ssh://${r.id}${target}`, name: base }
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      }
      try {
        const base = payload.name?.trim() || 'New folder'
        let target = join(payload.dir, base)
        let i = 1
        while (existsSync(target)) {
          target = join(payload.dir, `${base} ${i}`)
          i++
        }
        await mkdir(target, { recursive: true })
        return { path: target, name: basename(target) }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'fs:move',
    async (_e, payload: { source: string; destDir: string }) => {
      try {
        const { source, destDir } = payload
        const normSrc = source.replace(/[\\/]+$/, '')
        const normDest = destDir.replace(/[\\/]+$/, '')
        if (normDest === normSrc || normDest.startsWith(normSrc + '/') || normDest.startsWith(normSrc + '\\')) {
          return { error: 'Cannot move a folder into itself.' }
        }
        if (dirname(normSrc) === normDest) {
          return { path: source, name: basename(source) }
        }
        let target = join(destDir, basename(source))
        if (existsSync(target)) {
          const base = basename(source)
          const dot = base.lastIndexOf('.')
          const isFile = (await stat(source)).isFile()
          const stem = isFile && dot > 0 ? base.slice(0, dot) : base
          const ext = isFile && dot > 0 ? base.slice(dot) : ''
          let i = 1
          while (existsSync(target)) {
            target = join(destDir, `${stem} ${i}${ext}`)
            i++
          }
        }
        try {
          await rename(source, target)
        } catch {
          await cp(source, target, { recursive: true })
          await rm(source, { recursive: true, force: true })
        }
        return { path: target, name: basename(target) }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'fs:revert',
    async (_e, payload: { path: string; before: string; existed: boolean }) => {
      try {
        if (!payload.existed) {
          await rm(payload.path, { force: true })
        } else {
          await writeFile(payload.path, payload.before, 'utf8')
        }
        return true
      } catch {
        return false
      }
    }
  )

  let searchToken = 0
  const MAX_SCAN = 25_000

  ipcMain.handle(
    'fs:search',
    async (_e, payload: { root: string; query: string; limit?: number }) => {
      const { root, query, limit = 200 } = payload
      const q = query.trim().toLowerCase()
      if (!root || !q) return [] as DirEntry[]

      const myToken = ++searchToken
      const results: DirEntry[] = []
      let scanned = 0
      const matchAll = q === '.'

      async function walk(dir: string, depth: number): Promise<void> {
        if (myToken !== searchToken) return
        if (results.length >= limit || scanned >= MAX_SCAN || depth > 14) return
        let entries: import('node:fs').Dirent[] = []
        try {
          entries = await readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          if (myToken !== searchToken) return
          if (results.length >= limit || scanned >= MAX_SCAN) return
          if (IGNORED.has(e.name)) continue
          if (e.name.startsWith('.') && e.name.length > 1 && !e.isFile()) {
            continue
          }
          scanned++
          const full = join(dir, e.name)
          if (matchAll || e.name.toLowerCase().includes(q)) {
            results.push({ name: e.name, path: full, isDir: e.isDirectory() })
          }
          if (e.isDirectory()) await walk(full, depth + 1)
        }
      }

      await walk(root, 0)
      if (myToken !== searchToken) return [] as DirEntry[]
      return results
    }
  )

  const SYMBOL_EXTS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.hpp', '.cc',
    '.cs', '.php', '.rb', '.swift', '.kt'
  ])
  const SYMBOL_RE =
    /(?:function|class|interface|type|enum|struct|def|func|fn|const|let|var)\s+([A-Za-z_$][\w$]*)/g

  let symbolToken = 0

  ipcMain.handle(
    'fs:search-symbols',
    async (_e, payload: { root: string; query: string; limit?: number }) => {
      const { root, query, limit = 30 } = payload
      const q = query.trim().toLowerCase()
      if (!root || !q) return [] as Array<{ name: string; path: string; line: number; kind: string }>

      const myToken = ++symbolToken
      const out: Array<{ name: string; path: string; line: number; kind: string }> = []
      let filesScanned = 0
      const MAX_FILES = 1500

      async function walk(dir: string, depth: number): Promise<void> {
        if (myToken !== symbolToken || out.length >= limit || filesScanned >= MAX_FILES || depth > 12)
          return
        let entries: import('node:fs').Dirent[] = []
        try {
          entries = await readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          if (myToken !== symbolToken || out.length >= limit || filesScanned >= MAX_FILES) return
          if (IGNORED.has(e.name)) continue
          if (e.name.startsWith('.') && !e.isFile()) continue
          const full = join(dir, e.name)
          if (e.isDirectory()) {
            await walk(full, depth + 1)
            continue
          }
          const dot = e.name.lastIndexOf('.')
          const ext = dot >= 0 ? e.name.slice(dot) : ''
          if (!SYMBOL_EXTS.has(ext)) continue
          filesScanned++
          let content = ''
          try {
            content = await readFile(full, 'utf8')
          } catch {
            continue
          }
          if (content.length > 400_000) continue
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (out.length >= limit) break
            SYMBOL_RE.lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = SYMBOL_RE.exec(lines[i])) !== null) {
              const name = m[1]
              if (name.toLowerCase().includes(q)) {
                out.push({ name, path: full, line: i + 1, kind: m[0].split(/\s+/)[0] })
                if (out.length >= limit) break
              }
            }
          }
        }
      }

      await walk(root, 0)
      if (myToken !== symbolToken) return []
      return out
    }
  )

  const SEARCH_TEXT_EXT_SKIP = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg', '.pdf',
    '.zip', '.gz', '.tar', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.mov', '.avi', '.woff', '.woff2', '.ttf', '.eot', '.class',
    '.lock', '.bin', '.wasm'
  ])

  function globToRegExp(glob: string): RegExp {
    const esc = glob
      .trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/\\\\]*')
      .replace(/\u0000/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(esc, 'i')
  }

  function buildSearchRegex(
    query: string,
    opts: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }
  ): RegExp | null {
    if (!query) return null
    let pattern = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`
    try {
      return new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi')
    } catch {
      return null
    }
  }

  interface SearchMatch {
    line: number
    column: number
    length: number
    preview: string
  }
  interface SearchFileResult {
    path: string
    relPath: string
    matches: SearchMatch[]
  }

  let contentSearchToken = 0

  ipcMain.handle(
    'fs:search-content',
    async (
      _e,
      payload: {
        root: string
        query: string
        regex?: boolean
        caseSensitive?: boolean
        wholeWord?: boolean
        include?: string
        exclude?: string
        maxResults?: number
      }
    ) => {
      const { root, query } = payload
      if (!root || !query) return { results: [] as SearchFileResult[], truncated: false }
      const re = buildSearchRegex(query, payload)
      if (!re) return { results: [] as SearchFileResult[], truncated: false, error: 'Invalid pattern' }

      const includeRes = (payload.include ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(globToRegExp)
      const excludeRes = (payload.exclude ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(globToRegExp)

      const maxResults = payload.maxResults ?? 2000
      const myToken = ++contentSearchToken
      const results: SearchFileResult[] = []
      let total = 0
      let truncated = false
      let filesScanned = 0
      const MAX_FILES = 20_000

      async function walk(dir: string): Promise<void> {
        if (myToken !== contentSearchToken || truncated || filesScanned >= MAX_FILES) return
        let entries: import('node:fs').Dirent[] = []
        try {
          entries = await readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          if (myToken !== contentSearchToken || truncated) return
          if (IGNORED.has(e.name)) continue
          const full = join(dir, e.name)
          if (e.isDirectory()) {
            await walk(full)
            continue
          }
          const rel = full.slice(root.length).replace(/^[\\/]/, '').replace(/\\/g, '/')
          const dot = e.name.lastIndexOf('.')
          const ext = dot >= 0 ? e.name.slice(dot).toLowerCase() : ''
          if (SEARCH_TEXT_EXT_SKIP.has(ext)) continue
          if (includeRes.length && !includeRes.some((r) => r.test(rel))) continue
          if (excludeRes.length && excludeRes.some((r) => r.test(rel))) continue
          filesScanned++
          let content = ''
          try {
            const st = await stat(full)
            if (st.size > 2_000_000) continue
            content = await readFile(full, 'utf8')
          } catch {
            continue
          }
          if (content.includes('\u0000')) continue
          const lines = content.split('\n')
          const fileMatches: SearchMatch[] = []
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            re.lastIndex = 0
            let m: RegExpExecArray | null
            while ((m = re.exec(line)) !== null) {
              fileMatches.push({
                line: i + 1,
                column: m.index + 1,
                length: m[0].length,
                preview: line.length > 400 ? line.slice(0, 400) : line
              })
              total++
              if (m.index === re.lastIndex) re.lastIndex++
              if (total >= maxResults) {
                truncated = true
                break
              }
            }
            if (truncated) break
          }
          if (fileMatches.length) results.push({ path: full, relPath: rel, matches: fileMatches })
        }
      }

      await walk(root)
      if (myToken !== contentSearchToken) return { results: [], truncated: false }
      return { results, truncated }
    }
  )

  ipcMain.handle(
    'fs:replace-in-file',
    async (
      _e,
      payload: {
        path: string
        query: string
        replacement: string
        regex?: boolean
        caseSensitive?: boolean
        wholeWord?: boolean
      }
    ) => {
      const re = buildSearchRegex(payload.query, payload)
      if (!re) return { ok: false, error: 'Invalid pattern' }
      try {
        const content = await readFile(payload.path, 'utf8')
        const next = content.replace(re, payload.regex ? payload.replacement : () => payload.replacement)
        if (next === content) return { ok: true, changed: 0 }
        await writeFile(payload.path, next, 'utf8')
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('terminal:new', async (_e, cwd: string | null) => {
    const dir = cwd || process.cwd()
    try {
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', 'cmd.exe'], { cwd: dir, detached: true }).unref()
      } else if (process.platform === 'darwin') {
        spawn('open', ['-a', 'Terminal', dir], { detached: true }).unref()
      } else {
        const term = process.env.TERMINAL || 'x-terminal-emulator'
        spawn(term, [], { cwd: dir, detached: true }).unref()
      }
      return true
    } catch {
      await shell.openPath(dir)
      return false
    }
  })
}
