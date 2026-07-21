import { promises as fs } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

type IndexedPoint = { value: string; line: number };
type IndexedFile = {
  path: string;
  lowerPath: string;
  lines: string[];
  lowerContent: string;
  symbols: IndexedPoint[];
  imports: IndexedPoint[];
};
type IndexState = {
  files: IndexedFile[];
  builtAt: number;
  building?: Promise<void>;
};
type RankedHit = { score: number; text: string };

const indexes = new Map<string, IndexState>();
const refreshTimers = new Map<string, NodeJS.Timeout>();
const ignored = new Set([
  ".git",
  ".idea",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vscode",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
]);
const textExtensions = new Set([
  "",
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const MAX_FILES = 6000;
const MAX_FILE_BYTES = 350_000;
const MAX_TOTAL_CHARS = 24_000_000;
const FRESH_FOR_MS = 60_000;

function canIndex(root: string): boolean {
  return Boolean(root) && !root.startsWith("ssh://");
}

function extractPoints(lines: string[]): {
  symbols: IndexedPoint[];
  imports: IndexedPoint[];
} {
  const symbols: IndexedPoint[] = [];
  const imports: IndexedPoint[] = [];
  const symbolPattern =
    /\b(?:class|interface|type|enum|function|const|let|var|def|fn|struct|trait)\s+([A-Za-z_$][\w$]*)/g;
  const importPatterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*from\s+([\w.]+)\s+import\b/g,
    /^\s*import\s+([\w.]+)/g,
    /^\s*use\s+([^;]+);/g,
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    symbolPattern.lastIndex = 0;
    for (const match of line.matchAll(symbolPattern)) {
      symbols.push({ value: match[1], line: index + 1 });
      if (symbols.length >= 500) break;
    }
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        imports.push({ value: match[1].trim(), line: index + 1 });
        if (imports.length >= 500) break;
      }
      if (imports.length >= 500) break;
    }
  }
  return { symbols, imports };
}

async function build(root: string): Promise<IndexedFile[]> {
  const files: IndexedFile[] = [];
  let totalChars = 0;
  let visited = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (
      files.length >= MAX_FILES ||
      totalChars >= MAX_TOTAL_CHARS ||
      depth > 14
    )
      return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalChars >= MAX_TOTAL_CHARS) return;
      if (
        ignored.has(entry.name) ||
        (entry.isDirectory() && entry.name.startsWith("."))
      )
        continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute, depth + 1);
        continue;
      }
      if (
        !entry.isFile() ||
        !textExtensions.has(extname(entry.name).toLowerCase())
      )
        continue;
      try {
        const stat = await fs.stat(absolute);
        if (stat.size > MAX_FILE_BYTES) continue;
        const content = await fs.readFile(absolute, "utf8");
        if (content.includes("\u0000")) continue;
        totalChars += content.length;
        const lines = content.split("\n");
        const points = extractPoints(lines);
        const path = relative(root, absolute);
        files.push({
          path,
          lowerPath: path.toLowerCase(),
          lines,
          lowerContent: content.toLowerCase(),
          symbols: points.symbols,
          imports: points.imports,
        });
        visited += 1;
        if (visited % 100 === 0)
          await new Promise<void>((done) => setImmediate(done));
      } catch {}
    }
  }

  await walk(root, 0);
  return files;
}

export async function warmProjectIndex(root: string): Promise<void> {
  if (!canIndex(root)) return;
  const key = resolve(root);
  const existing = indexes.get(key);
  if (existing?.building) return existing.building;
  if (existing && Date.now() - existing.builtAt < FRESH_FOR_MS) return;
  const state: IndexState = existing ?? { files: [], builtAt: 0 };
  const building = build(key)
    .then((files) => {
      state.files = files;
      state.builtAt = Date.now();
    })
    .catch(() => undefined)
    .finally(() => {
      state.building = undefined;
    });
  state.building = building;
  indexes.set(key, state);
  return building;
}

export function scheduleProjectIndexRefresh(root: string): void {
  if (!canIndex(root)) return;
  const key = resolve(root);
  const current = refreshTimers.get(key);
  if (current) clearTimeout(current);
  refreshTimers.set(
    key,
    setTimeout(() => {
      refreshTimers.delete(key);
      indexes.delete(key);
      void warmProjectIndex(key);
    }, 350),
  );
}

export async function searchProjectIndex(
  root: string,
  query: string,
  limit = 50,
): Promise<string[]> {
  if (!canIndex(root)) return [];
  const key = resolve(root);
  await warmProjectIndex(key);
  const state = indexes.get(key);
  if (!state) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: RankedHit[] = [];

  for (const file of state.files) {
    if (file.lowerPath.includes(q)) {
      hits.push({
        score: file.lowerPath.endsWith(q) ? 75 : 55,
        text: `[file] ${file.path}`,
      });
    }
    for (const symbol of file.symbols) {
      const value = symbol.value.toLowerCase();
      if (value === q || value.includes(q)) {
        hits.push({
          score: value === q ? 120 : 90,
          text: `[symbol] ${file.path}:${symbol.line}: ${symbol.value}`,
        });
      }
    }
    for (const imported of file.imports) {
      if (imported.value.toLowerCase().includes(q)) {
        hits.push({
          score: 80,
          text: `[import] ${file.path}:${imported.line}: ${imported.value}`,
        });
      }
    }
    const contentIndex = file.lowerContent.indexOf(q);
    if (contentIndex >= 0) {
      const line = file.lowerContent.slice(0, contentIndex).split("\n").length;
      const snippet = file.lines[line - 1]?.trim().slice(0, 160) ?? "";
      hits.push({ score: 40, text: `[text] ${file.path}:${line}: ${snippet}` });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return [...new Set(hits.map((hit) => hit.text))].slice(0, limit);
}
