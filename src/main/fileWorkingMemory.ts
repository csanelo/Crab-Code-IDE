import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import Store from "electron-store";

interface FileMemoryEntry {
  path: string;
  fingerprint: string | null;
  lineCount: number;
  symbols: string[];
  summary: string;
  lastReadAt: number;
  updatedAt: number;
}

interface ProjectFileMemory {
  root: string;
  updatedAt: number;
  files: Record<string, FileMemoryEntry>;
}

interface FileMemoryState {
  projects: Record<string, ProjectFileMemory>;
}

const MAX_PROJECTS = 24;
const MAX_FILES_PER_PROJECT = 80;
const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_CHARS = 16_000;
const MAX_SUMMARY_CHARS = 1_400;
const MAX_SYMBOLS = 80;
const REMOTE_MEMORY_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const REMOTE_ROOT = /^ssh:\/\//i;

const store = new Store<FileMemoryState>({
  name: "crab-agent-file-memory",
  defaults: { projects: {} },
});

function projectKey(root: string): string {
  const normalized = root.trim().replace(/\\/g, "/").replace(/\/$/, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

function normalizeTrackedPath(root: string, filePath: string): string {
  const clean = filePath.trim();
  if (!clean) return "";
  if (REMOTE_ROOT.test(root)) return clean.replace(/\\/g, "/");
  const absolute = isAbsolute(clean) ? resolve(clean) : resolve(root, clean);
  const rel = relative(resolve(root), absolute);
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return rel.replace(/\\/g, "/");
  return absolute.replace(/\\/g, "/");
}

function absoluteTrackedPath(root: string, filePath: string): string | null {
  if (!root || REMOTE_ROOT.test(root)) return null;
  return isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
}

export async function getFileFingerprint(
  root: string,
  filePath: string,
): Promise<string | null> {
  const absolute = absoluteTrackedPath(root, filePath);
  if (!absolute) return null;
  try {
    const stat = await fs.stat(absolute);
    return stat.isFile() ? `${stat.size}:${Math.trunc(stat.mtimeMs)}` : null;
  } catch {
    return null;
  }
}

function cleanSummary(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b/g, "[redacted secret]")
    .replace(/\b(password|token|api[_ -]?key|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SUMMARY_CHARS);
}

function sourceLines(numberedText: string): string[] {
  return numberedText.split("\n").map((line) => line.replace(/^\s*\d+\s{2}/, ""));
}

function extractSymbols(numberedText: string): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];
  const declaration = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(class|interface|type|enum|function|const|let|var)\s+([A-Za-z_$][\w$]*)/;
  for (const line of sourceLines(numberedText)) {
    const match = line.match(declaration);
    if (!match) continue;
    const symbol = `${match[1]} ${match[2]}`;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
    if (symbols.length >= MAX_SYMBOLS) break;
  }
  return symbols;
}

function persistProjects(projects: Record<string, ProjectFileMemory>): void {
  const kept = Object.fromEntries(
    Object.entries(projects)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PROJECTS),
  );
  store.set("projects", kept);
}

function upsertProject(
  root: string,
  update: (project: ProjectFileMemory) => void,
): void {
  if (!root) return;
  const projects = { ...store.get("projects") };
  const key = projectKey(root);
  const previous = projects[key];
  const project: ProjectFileMemory = previous
    ? { ...previous, files: { ...previous.files } }
    : { root, updatedAt: Date.now(), files: {} };
  update(project);
  project.updatedAt = Date.now();
  project.files = Object.fromEntries(
    Object.entries(project.files)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_FILES_PER_PROJECT),
  );
  projects[key] = project;
  persistProjects(projects);
}

export async function rememberFileRead(
  root: string,
  filePath: string,
  numberedText: string,
): Promise<void> {
  const path = normalizeTrackedPath(root, filePath);
  if (!root || !path || /^(?:Error|Retry):/i.test(numberedText.trim())) return;
  const fingerprint = await getFileFingerprint(root, path);
  const lines = sourceLines(numberedText);
  const symbols = extractSymbols(numberedText);
  upsertProject(root, (project) => {
    const previous = project.files[path];
    const sameVersion = previous && previous.fingerprint === fingerprint;
    project.files[path] = {
      path,
      fingerprint,
      lineCount: lines.length,
      symbols,
      summary: sameVersion ? previous.summary : "",
      lastReadAt: Date.now(),
      updatedAt: Date.now(),
    };
  });
}

export async function rememberFileInsight(
  root: string,
  filePath: string,
  summary: string,
): Promise<boolean> {
  const path = normalizeTrackedPath(root, filePath);
  const clean = cleanSummary(summary);
  if (!root || !path || !clean) return false;
  const fingerprint = await getFileFingerprint(root, path);
  upsertProject(root, (project) => {
    const previous = project.files[path];
    const sameVersion = previous && previous.fingerprint === fingerprint;
    project.files[path] = {
      path,
      fingerprint,
      lineCount: sameVersion ? previous.lineCount : 0,
      symbols: sameVersion ? previous.symbols : [],
      summary: clean,
      lastReadAt: sameVersion ? previous.lastReadAt : Date.now(),
      updatedAt: Date.now(),
    };
  });
  return true;
}

export function forgetFileWorkingMemory(root: string, filePath: string): void {
  const path = normalizeTrackedPath(root, filePath);
  if (!root || !path) return;
  upsertProject(root, (project) => {
    delete project.files[path];
  });
}

export async function buildFileWorkingMemoryContext(root: string): Promise<string> {
  if (!root) return "";
  const projects = { ...store.get("projects") };
  const key = projectKey(root);
  const project = projects[key];
  if (!project) return "";

  const candidates = Object.values(project.files)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONTEXT_FILES * 2);
  const valid: FileMemoryEntry[] = [];
  let changed = false;
  for (const entry of candidates) {
    if (REMOTE_ROOT.test(root)) {
      if (Date.now() - entry.updatedAt > REMOTE_MEMORY_MAX_AGE_MS) {
        delete project.files[entry.path];
        changed = true;
        continue;
      }
    } else {
      const current = await getFileFingerprint(root, entry.path);
      if (!current || current !== entry.fingerprint) {
        delete project.files[entry.path];
        changed = true;
        continue;
      }
    }
    valid.push(entry);
    if (valid.length >= MAX_CONTEXT_FILES) break;
  }
  if (changed) {
    project.updatedAt = Date.now();
    projects[key] = project;
    persistProjects(projects);
  }
  if (valid.length === 0) return "";

  const lines = [
    "# Verified file working memory",
    "These entries were remembered from earlier turns. Local fingerprints were checked immediately before this request.",
    "Reuse these conclusions instead of reopening unchanged files. Read a file only when exact current text is required for an edit or the memory is insufficient.",
  ];
  for (const entry of valid) {
    const verification = REMOTE_ROOT.test(root) ? "remote snapshot" : "unchanged";
    lines.push(`- ${entry.path} (${verification}${entry.lineCount ? `, ${entry.lineCount} lines` : ""})`);
    if (entry.symbols.length) lines.push(`  Symbols: ${entry.symbols.join(", ")}`);
    if (entry.summary) lines.push(`  Remembered analysis: ${entry.summary.replace(/\n/g, " ")}`);
    if (lines.join("\n").length >= MAX_CONTEXT_CHARS) break;
  }
  return lines.join("\n").slice(0, MAX_CONTEXT_CHARS);
}
