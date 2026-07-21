import type { IpcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'


export interface Skill {
  name: string
  description: string
  path: string
}

const REL_DIR = ['.crab', 'skills']
const GLOBAL_DIR = join(homedir(), '.crab', 'skills')

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
        path: `.crab/skills/${name}/SKILL.md`
      })
    } catch {
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

export async function listGlobalSkills(): Promise<Skill[]> {
  return readSkillsDir(GLOBAL_DIR)
}

export async function syncSkills(root: string): Promise<void> {
  if (!root) return
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(GLOBAL_DIR, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return
      const srcFile = join(GLOBAL_DIR, entry.name, 'SKILL.md')
      let content: string
      try {
        content = await fs.readFile(srcFile, 'utf8')
      } catch {
        return
      }
      const destDir = join(root, ...REL_DIR, entry.name)
      const destFile = join(destDir, 'SKILL.md')
      try {
        const existing = await fs.readFile(destFile, 'utf8')
        if (existing === content) return
      } catch {
      }
      await fs.mkdir(destDir, { recursive: true })
      await fs.writeFile(destFile, content, 'utf8')
    })
  )
}

export async function listSkills(root: string): Promise<Skill[]> {
  const byName = new Map<string, Skill>()
  for (const s of await readSkillsDir(GLOBAL_DIR)) byName.set(s.name, s)

  if (root) {
    const projectDir = join(root, ...REL_DIR)
    let entries: import('node:fs').Dirent[] = []
    try {
      entries = await fs.readdir(projectDir, { withFileTypes: true })
    } catch {
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      try {
        const src = await fs.readFile(join(projectDir, entry.name, 'SKILL.md'), 'utf8')
        const { fields, body } = parseFrontmatter(src)
        const name = sanitizeName(fields.name || entry.name)
        if (!name || byName.has(name)) continue
        const gDir = join(GLOBAL_DIR, name)
        await fs.mkdir(gDir, { recursive: true })
        await fs.writeFile(join(gDir, 'SKILL.md'), src, 'utf8')
        byName.set(name, {
          name,
          description: fields.description || deriveDescription(body),
          path: `.crab/skills/${name}/SKILL.md`
        })
      } catch {
      }
    }
    await syncSkills(root)
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}


interface FetchResult {
  ok: boolean
  name?: string
  description?: string
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

function buildCandidates(input: string): string[] {
  const url = input.trim()
  if (/raw\.githubusercontent\.com/i.test(url)) return [url]

  const blob = url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/([^/]+)\/(.+?)\/?$/i)
  if (blob) {
    const [, owner, repo, branch, rest] = blob
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`
    if (/SKILL\.md$/i.test(rest)) return [`${base}/${rest}`]
    return [`${base}/${rest}/SKILL.md`, `${base}/${rest.replace(/\/$/, '')}/SKILL.md`]
  }

  const repoM = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i)
  if (repoM) {
    const [, owner, repoRaw] = repoM
    const repo = repoRaw.replace(/\.git$/i, '')
    const branches = ['main', 'master']
    const paths = ['SKILL.md', 'skill.md', '.crab/SKILL.md', 'SKILLS.md']
    const out: string[] = []
    for (const b of branches) for (const p of paths) out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/${p}`)
    return out
  }

  return [url]
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
  content: string
): Promise<{ name: string; description: string }> {
  const { fields, body } = parseFrontmatter(content)
  const name = sanitizeName(fields.name || preferredName || 'skill')
  const globalDir = join(GLOBAL_DIR, name)
  await fs.mkdir(globalDir, { recursive: true })
  await fs.writeFile(join(globalDir, 'SKILL.md'), content, 'utf8')
  if (root) {
    const projDir = join(root, ...REL_DIR, name)
    await fs.mkdir(projDir, { recursive: true })
    await fs.writeFile(join(projDir, 'SKILL.md'), content, 'utf8')
  }
  return { name, description: fields.description || deriveDescription(body) }
}

export async function addSkillFromUrl(root: string, input: string): Promise<FetchResult> {
  if (!input || !/^https?:\/\//i.test(input.trim())) {
    return { ok: false, error: 'Provide a GitHub URL to a SKILL.md (file, folder or repo).' }
  }

  const candidates = buildCandidates(input)
  let content: string | null = null
  for (const c of candidates) {
    content = await httpGet(c)
    if (content && content.trim()) break
  }
  if (!content || !content.trim()) {
    return { ok: false, error: 'Could not find a SKILL.md at that GitHub location.' }
  }

  const { fields, body } = parseFrontmatter(content)
  const name = sanitizeName(fields.name || nameFromUrl(input) || 'skill')
  if (!name) return { ok: false, error: 'Could not derive a valid skill name.' }

  const installed = await installSkillContent(root, name, content)
  return { ok: true, name: installed.name, description: installed.description }
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
  const candidates: string[] = []
  for (const b of branches) {
    for (const dir of layouts) {
      candidates.push(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${b}/${dir}/SKILL.md`)
    }
  }

  let content: string | null = null
  for (const c of candidates) {
    content = await httpGet(c)
    if (content && content.trim()) break
  }
  if (!content || !content.trim()) {
    return { ok: false, error: `Could not find skill "${skill}" in ${repo.owner}/${repo.repo}.` }
  }

  const installed = await installSkillContent(root, skillName, content)
  return { ok: true, name: installed.name, description: installed.description }
}

export async function listRepoSkills(repoUrl: string): Promise<{ ok: boolean; skills?: string[]; error?: string }> {
  const repo = parseRepo(repoUrl)
  if (!repo) return { ok: false, error: 'Provide a GitHub repository URL.' }
  for (const dir of ['skills', '']) {
    const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${dir}`
    const json = await httpGet(api)
    if (!json) continue
    try {
      const entries = JSON.parse(json) as { name: string; type: string }[]
      const dirs = entries.filter((e) => e.type === 'dir').map((e) => e.name)
      if (dirs.length) return { ok: true, skills: dirs }
    } catch {
    }
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
    'A "skill" is a self-contained capability stored as a SKILL.md file with YAML frontmatter ' +
    '(`name`, `description`) followed by Markdown instructions. Skills live under .crab/skills/<name>/SKILL.md, ' +
    'are global (they follow the user across every project), and each is exposed as a "/<name>" slash command. ' +
    'Progressive disclosure: only the name + description are in your context; read the full SKILL.md with ' +
    'read_file (or list_skills) only when a skill is invoked or a task clearly matches one.\n' +
    '\n' +
    '## How to obtain / make skills\n' +
    '- INSTALL from a single SKILL.md / folder / repo-root: `add_skill { url }`.\n' +
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
    'files with relative paths if needed. After creating or installing, tell the user it is available as "/<name>".\n'

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
  ipcMain.handle('skills:list', async (_e, root: string) => listSkills(root))
  ipcMain.handle('skills:add', async (_e, payload: { root: string; url: string }) =>
    addSkillFromUrl(payload.root, payload.url)
  )
  ipcMain.handle('skills:addFromRepo', async (_e, payload: { root: string; url: string; skill: string }) =>
    addSkillFromRepo(payload.root, payload.url, payload.skill)
  )
  ipcMain.handle('skills:listRepo', async (_e, url: string) => listRepoSkills(url))
  ipcMain.handle(
    'skills:create',
    async (_e, payload: { root: string; name: string; description: string; body: string }) =>
      createSkill(payload.root, payload.name, payload.description, payload.body)
  )
  ipcMain.handle('skills:remove', async (_e, payload: { root: string; name: string }) =>
    removeSkill(payload.root, payload.name)
  )
  ipcMain.handle('skills:sync', async (_e, root: string) => {
    await syncSkills(root)
    return true
  })
}
