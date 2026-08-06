import type { ToolResult } from "./agentTools";

export interface TaskToolMemory {
  cache: Map<string, CachedToolResult>;
  projectRevision: number;
  unknownRevision: number;
  pathRevisions: Map<string, number>;
}

interface CachedToolResult {
  scope: "path" | "project";
  path?: string;
  pathRevision: number;
  projectRevision: number;
  unknownRevision: number;
  fingerprint?: string | null;
}

const PATH_SCOPED_TOOLS = new Set([
  "read_file",
  "get_file_outline",
  "get_ast_tree",
  "get_symbol_scope",
  "lsp_diagnostics",
  "lsp_find_references",
  "lsp_goto_definition",
]);

const PROJECT_SCOPED_TOOLS = new Set([
  "list_dir",
  "search",
  "find_symbol_definition",
  "find_symbol_references",
  "codebase_map",
  "read_memory",
  "list_skills",
  "list_mcp_servers",
  "list_ssh_hosts",
  "github_status",
]);

function normalizePath(value: unknown): string {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function normalizeValue(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (key === "path" || key === "from" || key === "to" || key === "target") {
    return normalizePath(value);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeValue("", item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([nestedKey, nestedValue]) => {
          const normalized = normalizeValue(nestedKey, nestedValue);
          return normalized === undefined ? [] : [[nestedKey, normalized]];
        }),
    );
  }
  return typeof value === "string" ? value.trim() : value;
}

function signature(name: string, input: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(normalizeValue("", input))}`;
}

function toolScope(
  name: string,
  input: Record<string, unknown>,
): { scope: "path" | "project"; path?: string } | null {
  if (PATH_SCOPED_TOOLS.has(name)) {
    const path = normalizePath(input.path);
    return path ? { scope: "path", path } : { scope: "project" };
  }
  return PROJECT_SCOPED_TOOLS.has(name) ? { scope: "project" } : null;
}

export function createTaskToolMemory(): TaskToolMemory {
  return {
    cache: new Map(),
    projectRevision: 0,
    unknownRevision: 0,
    pathRevisions: new Map(),
  };
}

export function recallToolResult(
  memory: TaskToolMemory | undefined,
  name: string,
  input: Record<string, unknown>,
  fingerprint?: string | null,
): ToolResult | null {
  if (!memory) return null;
  const entry = memory.cache.get(signature(name, input));
  if (!entry || entry.unknownRevision !== memory.unknownRevision) return null;
  if (entry.scope === "project" && entry.projectRevision !== memory.projectRevision) return null;
  if (
    entry.scope === "path" &&
    entry.path &&
    entry.pathRevision !== (memory.pathRevisions.get(entry.path) ?? 0)
  ) {
    return null;
  }
  if (
    fingerprint !== undefined &&
    entry.fingerprint !== undefined &&
    fingerprint !== entry.fingerprint
  ) {
    return null;
  }
  return {
    text:
      `WORKING_MEMORY_HIT: The exact unchanged ${name} result is already available earlier in this task. ` +
      "Do not inspect or analyze it again. Reuse the earlier result and continue with the next necessary step.",
    memoryHit: true,
  };
}

export function rememberToolResult(
  memory: TaskToolMemory | undefined,
  name: string,
  input: Record<string, unknown>,
  result: ToolResult,
  fingerprint?: string | null,
): void {
  if (!memory || result.memoryHit || result.command || result.image) return;
  if (/^(?:Error|Retry):/i.test(result.text.trim())) return;
  const scope = toolScope(name, input);
  if (!scope) return;
  memory.cache.set(signature(name, input), {
    ...scope,
    pathRevision: scope.path ? (memory.pathRevisions.get(scope.path) ?? 0) : 0,
    projectRevision: memory.projectRevision,
    unknownRevision: memory.unknownRevision,
    fingerprint,
  });
}

function bumpPath(memory: TaskToolMemory, value: unknown): void {
  const path = normalizePath(value);
  if (!path) return;
  memory.pathRevisions.set(path, (memory.pathRevisions.get(path) ?? 0) + 1);
}

export function invalidateTaskToolMemory(
  memory: TaskToolMemory | undefined,
  name: string,
  input: Record<string, unknown>,
  mutated: boolean,
): void {
  if (!memory) return;
  const unknownMutation = name === "run_command";
  if (!mutated && !unknownMutation) return;
  memory.projectRevision += 1;
  if (unknownMutation || name === "create_dir") memory.unknownRevision += 1;
  bumpPath(memory, input.path);
  bumpPath(memory, input.from);
  bumpPath(memory, input.to);
}
