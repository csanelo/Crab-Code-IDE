import type { IpcMain } from 'electron'
import { handleIpc } from './ipcHelper'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'


export interface Skill {
  name: string
  description: string
  path: string
  files: number
}

const REL_DIR = ['.crab', 'skills']
const GLOBAL_DIR = join(homedir(), '.crab', 'skills')
const IGNORED_BUNDLE_ENTRIES = new Set([
  '.git',
  '.DS_Store',
  'node_modules',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  'dist',
  'build'
])
const MAX_GITHUB_BUNDLE_FILES = 500
const MAX_GITHUB_BUNDLE_BYTES = 32 * 1024 * 1024

function parseFrontmatter(src: string): { fields: Record<string, string>; body: string } {
  const m = src.match(/^\s*---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { fields: {}, body: src }
  const fields: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/)
    if (kv) fields[kv[1].trim().toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return { fields, body: m[2] }
}

function deriveDescription(body: string): string {
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    return line.replace(/[*_`]/g, '').slice(0, 120)
  }
  const h = body.match(/^#\s+(.+)$/m)
  return h ? h[1].trim().slice(0, 120) : ''
}

function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function readSkillsDir(dir: string): Promise<Skill[]> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const skills: Skill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const src = await fs.readFile(join(dir, entry.name, 'SKILL.md'), 'utf8')
      const { fields, body } = parseFrontmatter(src)
      const name = sanitizeName(fields.name || entry.name)
      if (!name) continue
      skills.push({
        name,
        description: fields.description || deriveDescription(body),
        path: `.crab/skills/${name}/SKILL.md`,
        files: await countSkillFiles(join(dir, entry.name))
      })
    } catch {
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

function ignoredBundleEntry(name: string): boolean {
  return IGNORED_BUNDLE_ENTRIES.has(name) || /\.(?:py[co]|tmp|log)$/i.test(name)
}

async function countSkillFiles(dir: string): Promise<number> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  let count = 0
  for (const entry of entries) {
    if (ignoredBundleEntry(entry.name) || entry.isSymbolicLink()) continue
    if (entry.isDirectory()) count += await countSkillFiles(join(dir, entry.name))
    else if (entry.isFile()) count += 1
  }
  return count
}

async function filesEqual(a: string, b: string): Promise<boolean> {
  try {
    const [aStat, bStat] = await Promise.all([fs.stat(a), fs.stat(b)])
    if (aStat.size !== bStat.size) return false
    const [aData, bData] = await Promise.all([fs.readFile(a), fs.readFile(b)])
    return aData.equals(bData)
  } catch {
    return false
  }
}

/** Copies every reusable skill file while excluding generated dependency/cache folders. */
async function mergeSkillDirectory(
  sourceDir: string,
  destinationDir: string,
  preferSource: boolean
): Promise<void> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true })
  } catch {
    return
  }
  await fs.mkdir(destinationDir, { recursive: true })
  for (const entry of entries) {
    if (ignoredBundleEntry(entry.name) || entry.isSymbolicLink()) continue
    const source = join(sourceDir, entry.name)
    const destination = join(destinationDir, entry.name)
    if (entry.isDirectory()) {
      await mergeSkillDirectory(source, destination, preferSource)
      continue
    }
    if (!entry.isFile() || (await filesEqual(source, destination))) continue
    let shouldCopy = preferSource
    if (!shouldCopy) {
      try {
        const [sourceStat, destinationStat] = await Promise.all([
          fs.stat(source),
          fs.stat(destination)
        ])
        shouldCopy = sourceStat.mtimeMs > destinationStat.mtimeMs
      } catch {
        shouldCopy = true
      }
    }
    if (!shouldCopy) continue
    await fs.mkdir(dirname(destination), { recursive: true })
    await fs.copyFile(source, destination)
  }
}

/** Promotes scripts/assets created or installed by the agent in a project into the global skill. */
async function importProjectSkillBundles(root: string): Promise<void> {
  if (!root) return
  const projectDir = join(root, ...REL_DIR)
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(projectDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const sourceDir = join(projectDir, entry.name)
    let src: string
    try {
      src = await fs.readFile(join(sourceDir, 'SKILL.md'), 'utf8')
    } catch {
      continue
    }
    const { fields } = parseFrontmatter(src)
    const name = sanitizeName(fields.name || entry.name)
    if (!name) continue
    await mergeSkillDirectory(sourceDir, join(GLOBAL_DIR, name), false)
  }
}

async function syncGlobalSkillBundles(root: string): Promise<void> {
  if (!root) return
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(GLOBAL_DIR, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.install-')) continue
    await mergeSkillDirectory(
      join(GLOBAL_DIR, entry.name),
      join(root, ...REL_DIR, entry.name),
      true
    )
  }
}

export async function listGlobalSkills(): Promise<Skill[]> {
  return readSkillsDir(GLOBAL_DIR)
}

export async function syncSkills(root: string): Promise<void> {
  if (!root) return
  await importProjectSkillBundles(root)
  await syncGlobalSkillBundles(root)
}

export async function listSkills(root: string): Promise<Skill[]> {
  if (root) await syncSkills(root)
  return readSkillsDir(GLOBAL_DIR)
}


interface FetchResult {
  ok: boolean
  name?: string
  description?: string
  files?: number
  error?: string
}

async function httpGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CrabCode', Accept: 'application/vnd.github.raw, text/plain, */*' }
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const GITHUB_RAW_ORIGIN = 'https://' + 'raw.githubusercontent.com'
const GITHUB_API_ORIGIN = 'https://' + 'api.github.com'

interface GitHubBundleSource {
  owner: string
  repo: string
  branch: string
  directory: string
}

interface SkillCandidate {
  url: string
  bundle?: GitHubBundleSource
}

interface GitHubContentEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  download_url?: string | null
  size?: number
}

function encodeGitHubPath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

async function httpGetBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'CrabCode' } })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function httpGetJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CrabCode', Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function downloadGitHubBundle(
  source: GitHubBundleSource,
  destinationDir: string
): Promise<{ files: number; bytes: number }> {
  const state = { files: 0, bytes: 0 }

  async function visit(remoteDir: string, localDir: string): Promise<void> {
    const encoded = encodeGitHubPath(remoteDir)
    const endpoint =
      `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(source.owner)}/` +
      `${encodeURIComponent(source.repo)}/contents${encoded ? `/${encoded}` : ''}` +
      `?ref=${encodeURIComponent(source.branch)}`
    const response = await httpGetJson<GitHubContentEntry[] | GitHubContentEntry>(endpoint)
    if (!response) throw new Error(`Could not download skill directory: ${remoteDir || '/'}`)
    const entries = Array.isArray(response) ? response : [response]
    await fs.mkdir(localDir, { recursive: true })

    for (const entry of entries) {
      if (
        !entry.name ||
        entry.name.includes('/') ||
        entry.name.includes('\\') ||
        ignoredBundleEntry(entry.name) ||
        entry.type === 'symlink' ||
        entry.type === 'submodule'
      ) continue
      if (entry.type === 'dir') {
        await visit(entry.path, join(localDir, entry.name))
        continue
      }
      if (entry.type !== 'file' || !entry.download_url) continue
      if (state.files >= MAX_GITHUB_BUNDLE_FILES) {
        throw new Error(`Skill bundle exceeds ${MAX_GITHUB_BUNDLE_FILES} files.`)
      }
      const declaredSize = Math.max(0, Number(entry.size ?? 0))
      if (state.bytes + declaredSize > MAX_GITHUB_BUNDLE_BYTES) {
        throw new Error('Skill bundle exceeds the 32 MB installation limit.')
      }
      const data = await httpGetBuffer(entry.download_url)
      if (!data) throw new Error(`Could not download ${entry.path}`)
      if (state.bytes + data.byteLength > MAX_GITHUB_BUNDLE_BYTES) {
        throw new Error('Skill bundle exceeds the 32 MB installation limit.')
      }
      await fs.writeFile(join(localDir, entry.name), data)
      state.files += 1
      state.bytes += data.byteLength
    }
  }

  await visit(source.directory, destinationDir)
  return state
}

function bundleFromRawUrl(url: string): GitHubBundleSource | undefined {
  const raw = url.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i)
  if (!raw) return undefined
  const filePath = raw[4].replace(/^\/+/, '')
  const parent = dirname(filePath)
  return {
    owner: raw[1],
    repo: raw[2],
    branch: raw[3],
    directory: parent === '.' ? '' : parent.replace(/\\/g, '/')
  }
}

function buildCandidates(input: string): SkillCandidate[] {
  const url = input.trim()
  if (/raw\.githubusercontent\.com/i.test(url)) {
    return [{ url, bundle: bundleFromRawUrl(url) }]
  }

  const blob = url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/([^/]+)\/(.+?)\/?$/i)
  if (blob) {
    const [, owner, repo, branch, rest] = blob
    const cleanRest = rest.replace(/\/$/, '')
    const skillPath = /SKILL\.md$/i.test(cleanRest) ? cleanRest : `${cleanRest}/SKILL.md`
    const parent = dirname(skillPath)
    return [{
      url: `${GITHUB_RAW_ORIGIN}/${owner}/${repo}/${branch}/${skillPath}`,
      bundle: {
        owner,
        repo: repo.replace(/\.git$/i, ''),
        branch,
        directory: parent === '.' ? '' : parent.replace(/\\/g, '/')
      }
    }]
  }

  const repoM = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i)
  if (repoM) {
    const [, owner, repoRaw] = repoM
    const repo = repoRaw.replace(/\.git$/i, '')
    const branches = ['main', 'master']
    const paths = ['SKILL.md', 'skill.md', '.crab/SKILL.md', 'SKILLS.md']
    const out: SkillCandidate[] = []
    for (const branch of branches) {
      for (const path of paths) {
        const parent = dirname(path)
        out.push({
          url: `${GITHUB_RAW_ORIGIN}/${owner}/${repo}/${branch}/${path}`,
          bundle: {
            owner,
            repo,
            branch,
            directory: parent === '.' ? '' : parent.replace(/\\/g, '/')
          }
        })
      }
    }
    return out
  }

  return [{ url }]
}

function nameFromUrl(input: string): string {
  const blob = input.match(/github\.com\/[^/]+\/([^/]+)\/(?:blob|tree)\/[^/]+\/(.+?)\/?$/i)
  if (blob) {
    const dir = blob[2].replace(/\/?SKILL\.md$/i, '')
    const last = dir.split('/').filter(Boolean).pop()
    return last ? sanitizeName(last) : sanitizeName(blob[1])
  }
  const repoM = input.match(/github\.com\/[^/]+\/([^/?#]+)/i)
  if (repoM) return sanitizeName(repoM[1].replace(/\.git$/i, ''))
  return ''
}

function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = input.match(/github\.com\/([^/]+)\/([^/?#]+)/i)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/i, '') }
}

async function installSkillContent(
  root: string,
  preferredName: string,
  content: string,
  bundle?: GitHubBundleSource
): Promise<{ name: string; description: string; files: number }> {
  const { fields, body } = parseFrontmatter(content)
  const name = sanitizeName(fields.name || preferredName || 'skill')
  const globalDir = join(GLOBAL_DIR, name)
  await fs.mkdir(globalDir, { recursive: true })
  let files = 1
  if (bundle) {
    const downloaded = await downloadGitHubBundle(bundle, globalDir)
    files = Math.max(1, downloaded.files)
  }
  // Always expose one canonical instruction filename even if the source used skill.md.
  await fs.writeFile(join(globalDir, 'SKILL.md'), content, 'utf8')
  if (root) {
    await mergeSkillDirectory(globalDir, join(root, ...REL_DIR, name), true)
  }
  return { name, description: fields.description || deriveDescription(body), files }
}

export async function addSkillFromUrl(root: string, input: string): Promise<FetchResult> {
  if (!input || !/^https?:\/\//i.test(input.trim())) {
    return { ok: false, error: 'Provide a GitHub URL to a SKILL.md (file, folder or repo).' }
  }

  const candidates = buildCandidates(input)
  let content: string | null = null
  let matched: SkillCandidate | undefined
  for (const candidate of candidates) {
    content = await httpGet(candidate.url)
    if (content && content.trim()) {
      matched = candidate
      break
    }
  }
  if (!content || !content.trim()) {
    return { ok: false, error: 'Could not find a SKILL.md at that GitHub location.' }
  }

  const { fields } = parseFrontmatter(content)
  const name = sanitizeName(fields.name || nameFromUrl(input) || 'skill')
  if (!name) return { ok: false, error: 'Could not derive a valid skill name.' }

  const installed = await installSkillContent(root, name, content, matched?.bundle)
  return {
    ok: true,
    name: installed.name,
    description: installed.description,
    files: installed.files
  }
}

export async function addSkillFromRepo(
  root: string,
  repoUrl: string,
  skill: string
): Promise<FetchResult> {
  const repo = parseRepo(repoUrl)
  if (!repo) return { ok: false, error: 'Provide a GitHub repository URL.' }
  const skillName = sanitizeName(skill)
  if (!skillName) return { ok: false, error: 'Provide a valid skill name.' }

  const branches = ['main', 'master']
  const layouts = [`skills/${skill}`, `${skill}`, `skill/${skill}`, `.crab/skills/${skill}`]
  const candidates: SkillCandidate[] = []
  for (const branch of branches) {
    for (const directory of layouts) {
      candidates.push({
        url: `${GITHUB_RAW_ORIGIN}/${repo.owner}/${repo.repo}/${branch}/${directory}/SKILL.md`,
        bundle: { owner: repo.owner, repo: repo.repo, branch, directory }
      })
    }
  }

  let content: string | null = null
  let matched: SkillCandidate | undefined
  for (const candidate of candidates) {
    content = await httpGet(candidate.url)
    if (content && content.trim()) {
      matched = candidate
      break
    }
  }
  if (!content || !content.trim()) {
    return { ok: false, error: `Could not find skill "${skill}" in ${repo.owner}/${repo.repo}.` }
  }

  const installed = await installSkillContent(root, skillName, content, matched?.bundle)
  return {
    ok: true,
    name: installed.name,
    description: installed.description,
    files: installed.files
  }
}

export async function listRepoSkills(repoUrl: string): Promise<{ ok: boolean; skills?: string[]; error?: string }> {
  const repo = parseRepo(repoUrl)
  if (!repo) return { ok: false, error: 'Provide a GitHub repository URL.' }
  for (const directory of ['skills', '']) {
    const suffix = directory ? `/${directory}` : ''
    const api = `${GITHUB_API_ORIGIN}/repos/${repo.owner}/${repo.repo}/contents${suffix}`
    const entries = await httpGetJson<{ name: string; type: string }[]>(api)
    if (!entries) continue
    const directories = entries.filter((entry) => entry.type === 'dir').map((entry) => entry.name)
    if (directories.length) return { ok: true, skills: directories }
  }
  return { ok: false, error: `Could not list skills in ${repo.owner}/${repo.repo}.` }
}

export async function createSkill(
  root: string,
  name: string,
  description: string,
  body: string
): Promise<FetchResult> {
  const skillName = sanitizeName(name)
  if (!skillName) return { ok: false, error: 'Provide a valid skill name.' }
  let content = body ?? ''
  if (!/^\s*---\n/.test(content)) {
    const fm = `---\nname: ${skillName}\ndescription: ${(description || '').replace(/\n/g, ' ').trim()}\n---\n\n`
    content = fm + content.trimStart()
  }
  const installed = await installSkillContent(root, skillName, content)
  return { ok: true, name: installed.name, description: installed.description }
}

export async function buildSkillsCatalog(root: string): Promise<string> {
  const skills = await listSkills(root)

  const knowledge =
    '\n\n# Skills (reusable, installable capabilities — like Claude Code / Codex)\n' +
    'A "skill" is a self-contained DIRECTORY whose entry point is SKILL.md with YAML frontmatter ' +
    '(`name`, `description`) followed by Markdown instructions. The same directory may contain scripts, ' +
    'references, assets, templates and dependency manifests. Skills live under .crab/skills/<name>/, ' +
    'are global (they follow the user across every project), and each is exposed as a "/<name>" slash command. ' +
    'Progressive disclosure: only the name + description are in your context; read the full SKILL.md with ' +
    'read_file (or list_skills) only when a skill is invoked or a task clearly matches one.\n' +
    '\n' +
    '## How to obtain / make skills\n' +
    '- INSTALL from a single SKILL.md / folder / repo-root: `add_skill { url }`. For GitHub sources CrabCode ' +
    'downloads the ENTIRE directory recursively, not only SKILL.md, and synchronizes it into every local project.\n' +
    '- INSTALL specific skills from a collection repo: `add_skill { url, skills: ["name1","name2"] }`. ' +
    'This is exactly what the command `npx skills add <repo> --skill <name> --skill <name>` means — each ' +
    '`--skill <name>` maps to one entry in the `skills` array, fetched from `skills/<name>/SKILL.md` in that repo.\n' +
    '- DISCOVER what a repo offers: `list_skills { repo }` (or `add_skill { url }` on a bare repo) lists its skills.\n' +
    '- CREATE a new skill yourself: `create_skill { name, description, body }` — write clear, practical, ' +
    'step-by-step Markdown instructions in `body`; frontmatter is added automatically. It installs instantly.\n' +
    '- The canonical public skill collection is https://github.com/anthropics/skills (skills include ' +
    'frontend-design, skill-creator, mcp-builder, pdf, docx, pptx, xlsx, webapp-testing, canvas-design, ' +
    'brand-guidelines, theme-factory and more). So ' +
    '`npx skills add https://github.com/anthropics/skills --skill frontend-design` → ' +
    '`add_skill { url: "https://github.com/anthropics/skills", skills: ["frontend-design"] }`.\n' +
    '\n' +
    '## Authoring a good SKILL.md\n' +
    '1) Frontmatter `name` (kebab-case) and a one-line `description`. 2) A short "When to use this" section. ' +
    '3) Numbered, concrete steps the agent can follow. 4) Keep it focused on ONE capability; reference extra ' +
    'files with relative paths. Put EVERY reusable script, reference, asset, template and requirements/package ' +
    'manifest inside .crab/skills/<name>/ so it is promoted to the global bundle and follows the user to new ' +
    'projects. Do not put generated node_modules, virtualenvs, caches, builds or secrets in a skill. ' +
    'After creating or installing, tell the user it is available as "/<name>".\n'

  if (skills.length === 0) {
    return knowledge + '\nNo skills are installed yet. Offer to install from anthropics/skills or create one.'
  }
  const lines = skills.map((s) => `- /${s.name}: ${s.description || '(no description)'} [${s.path}]`)
  return (
    knowledge +
    '\n## Installed skills\n' +
    'When a skill below is invoked, OR a task clearly matches one, FIRST read its SKILL.md with read_file to ' +
    'load the full instructions, then follow them.\n' +
    lines.join('\n')
  )
}

export async function removeSkill(root: string, name: string): Promise<boolean> {
  const safeName = sanitizeName(name)
  if (!safeName) return false
  try {
    await fs.rm(join(GLOBAL_DIR, safeName), { recursive: true, force: true })
    if (root) await fs.rm(join(root, ...REL_DIR, safeName), { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

export function registerSkills(ipcMain: IpcMain): void {
  handleIpc('skills:list', async (_e, root: string) => listSkills(root))
  handleIpc('skills:add', async (_e, payload: { root: string; url: string }) =>
    addSkillFromUrl(payload.root, payload.url)
  )
  handleIpc('skills:addFromRepo', async (_e, payload: { root: string; url: string; skill: string }) =>
    addSkillFromRepo(payload.root, payload.url, payload.skill)
  )
  handleIpc('skills:listRepo', async (_e, url: string) => listRepoSkills(url))
  handleIpc(
    'skills:create',
    async (_e, payload: { root: string; name: string; description: string; body: string }) =>
      createSkill(payload.root, payload.name, payload.description, payload.body)
  )
  handleIpc('skills:remove', async (_e, payload: { root: string; name: string }) =>
    removeSkill(payload.root, payload.name)
  )
  handleIpc('skills:sync', async (_e, root: string) => {
    await syncSkills(root)
    return true
  })
}
