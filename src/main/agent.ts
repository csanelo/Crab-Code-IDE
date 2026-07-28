import { createHash, randomUUID } from "node:crypto";
import { BrowserWindow, clipboard, dialog, nativeImage, type IpcMain } from "electron";
import { getActiveProvider } from "./providers";
import {
  TOOL_DEFS,
  runTool,
  readProjectMemory,
  readProjectSteering,
} from "./agentTools";
import { buildSkillsCatalog } from "./skills";
import { scheduleProjectIndexRefresh, warmProjectIndex } from "./projectIndex";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: { mimeType: string; dataUrl: string }[];
}

interface SendOptions {
  cwd: string | null;
  access?: "normal" | "high";
  editMode?: "auto" | "ask" | "readonly";
  webEnabled?: boolean;
  commandExecutionRequested?: boolean;
  send?: Emit;
  requestId?: string;
}

const WEB_TOOL_NAMES = new Set([
  "web_search",
  "fetch_url",
  "browser_open",
  "browser_read",
  "browser_screenshot",
]);

const CONFIRM_MUTATING_TOOLS = new Set([
  "write_file",
  "edit_file",
  "create_dir",
  "delete_path",
  "move_path",
  "copy_path",
  "run_command",
  "open_path",
  "github_commit",
  "computer_focus_window",
  "computer_click",
  "computer_type",
  "computer_keypress",
  "computer_scroll",
]);

function toolApprovalTarget(input: Record<string, unknown>): string {
  if (typeof input.processId === "number") return `Desktop process ${input.processId}`;
  if (typeof input.x === "number" && typeof input.y === "number") {
    return `Desktop coordinates ${input.x}, ${input.y}`;
  }
  if (typeof input.path === "string") return input.path;
  if (typeof input.from === "string" && typeof input.to === "string") {
    return `${input.from} → ${input.to}`;
  }
  return "Текущий проект";
}

const MUTATING_TOOL_NAMES = new Set([
  "write_file",
  "edit_file",
  "create_dir",
  "delete_path",
  "move_path",
  "copy_path",
  "run_command",
  "github_commit",
  "open_path",
  "computer_focus_window",
  "computer_click",
  "computer_type",
  "computer_keypress",
  "computer_scroll",
]);

function availableToolDefs(opts: SendOptions) {
  let tools = opts.webEnabled
    ? TOOL_DEFS
    : TOOL_DEFS.filter((tool) => !WEB_TOOL_NAMES.has(tool.name));
  if (!opts.commandExecutionRequested) {
    tools = tools.filter((tool) => tool.name !== "run_command");
  }
  // Plan mode: the model must not even see tools that could change anything.
  if (opts.editMode === "readonly") {
    tools = tools.filter((tool) => !MUTATING_TOOL_NAMES.has(tool.name));
  }
  return tools;
}

function currentUserExplicitlyRequestsWeb(messages: ChatMessage[]): boolean {
  const current = [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim();
  if (!current) return false;

  const denied =
    /(?:не\s+(?:ищи|искать|используй|открывай|проверяй).{0,24}(?:интернет|веб|сети)|(?:do not|don't|without)\s+(?:search|browse|use).{0,24}(?:web|internet|online))/i;
  if (denied.test(current)) return false;

  return /(?:https?:\/\/|\b(?:search|browse|google|look up|check)\s+(?:the\s+)?(?:web|online|internet)\b|\b(?:web|internet|online)\s+(?:search|research)\b|(?:в интернете|в сети|веб[- ]?поиск|интернет[- ]?поиск|погугл|загугл|найди в интернете|поищи в интернете|проверь в интернете|открой сайт|прочитай сайт))/i.test(
    current,
  );
}


function currentUserExplicitlyRequestsCommandExecution(
  messages: ChatMessage[],
): boolean {
  const current = [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim();
  if (!current) return false;

  const denied =
    /(?:не\s+(?:запускай|выполняй|исполняй)|(?:do not|don't)\s+(?:run|execute|launch))/i;
  if (denied.test(current)) return false;

  return /(?:^\/run\b|(?:сам\s+)?(?:запусти|выполни|исполни)(?:\s+[^.\n]{0,80})?(?:в терминале|через терминал|команду|скрипт|тесты|сборку|проект)?|\b(?:run|execute|launch)\b(?:\s+[^.\n]{0,80})?(?:in the terminal|command|script|tests?|build|project)?)/i.test(
    current,
  );
}

async function runToolForRequest(
  opts: SendOptions,
  name: string,
  input: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof runTool>>> {
  const opensWebUrl =
    name === "open_path" &&
    /^https?:\/\//i.test(String(input.target ?? "").trim());
  if (!opts.webEnabled && (WEB_TOOL_NAMES.has(name) || opensWebUrl)) {
    return {
      text: "Error: Web access is disabled. Enable Web in the + menu to use the internet.",
    };
  }
  if (name === "run_command" && !opts.commandExecutionRequested) {
    return {
      text: "Error: command execution was not explicitly requested. Use propose_command so the user gets a command card with a Run button.",
    };
  }
  if (opts.editMode === "ask" && CONFIRM_MUTATING_TOOLS.has(name)) {
    const confirmId = randomUUID();
    const confirmTarget = toolApprovalTarget(input);
    if (opts.send && opts.requestId) {
      opts.send("agent:tool", opts.requestId, {
        id: confirmId, name, input,
        status: "confirm-pending", confirmId, confirmTarget,
      });
    }
    const allowed = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 60_000);
      const wins = BrowserWindow.getAllWindows();
      const win = wins[0];
      if (!win) { clearTimeout(timer); resolve(false); return; }
      win.webContents.ipc.once(
        `agent:confirm-response:${confirmId}`,
        (_ev: unknown, _id: string, ok: boolean) => { clearTimeout(timer); resolve(ok); },
      );
    });
    if (opts.send && opts.requestId) {
      opts.send("agent:tool", opts.requestId, {
        id: confirmId, name, input,
        status: "confirm-resolved", confirmId, confirmTarget,
        confirmAllowed: allowed,
      });
    }
    if (!allowed) {
      return { text: `Изменение отклонено пользователем: ${name}.` };
    }
  }
  const result = await runTool(
    opts.cwd ?? "",
    name,
    input,
    opts.access,
    opts.editMode,
  );
  if (result.mutated && opts.cwd) scheduleProjectIndexRefresh(opts.cwd);
  if (result.mutated) broadcastWorkspaceChange(opts.cwd, name, result, input);
  return result;
}

// Every mutation made by the agent (in any window) is broadcast to all windows,
// so the IDE editor/file tree reload the file even when the edit came from the
// separate Agent window.
function broadcastWorkspaceChange(
  cwd: string | null,
  name: string,
  result: Awaited<ReturnType<typeof runTool>>,
  input: Record<string, unknown>,
): void {
  const rel =
    result.meta?.path ??
    (typeof input.path === "string"
      ? input.path
      : typeof input.to === "string"
        ? input.to
        : null);
  const payload = { tool: name, cwd, path: rel };
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send("workspace:changed", payload);
  }
}

const HISTORY_CHAR_BUDGET = 180_000;
const OLD_MESSAGE_CHAR_LIMIT = 36_000;
const RECENT_MESSAGE_FLOOR = 8;
const TOOL_RESULT_CHAR_LIMIT = 24_000;
const OLD_TOOL_RESULT_CHAR_LIMIT = 3_000;

function truncateMiddle(text: string, limit: number, label: string): string {
  if (text.length <= limit) return text;
  const marker = `\n\n[${label}: ${text.length - limit} characters omitted]\n\n`;
  const available = Math.max(0, limit - marker.length);
  const head = Math.ceil(available * 0.65);
  const tail = available - head;
  return `${text.slice(0, head)}${marker}${tail > 0 ? text.slice(-tail) : ""}`;
}

function compactHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages;
  const normalized = messages.map((message, index) => {
    const latest = index === messages.length - 1;
    const keepImages = latest || index >= messages.length - 4;
    const imageNote =
      !keepImages && message.images?.length
        ? `\n\n[${message.images.length} older image attachment(s) omitted to save context]`
        : "";
    const content = latest
      ? message.content
      : truncateMiddle(
        message.content,
        OLD_MESSAGE_CHAR_LIMIT,
        "older message compacted",
      );
    return {
      ...message,
      content: `${content}${imageNote}`,
      images: keepImages ? message.images : undefined,
    };
  });

  const kept: ChatMessage[] = [];
  let used = 0;
  for (let i = normalized.length - 1; i >= 0; i--) {
    const message = normalized[i];
    const imageCost = (message.images?.length ?? 0) * 4_000;
    const cost = message.content.length + imageCost;
    const recent = normalized.length - i <= RECENT_MESSAGE_FLOOR;
    if (!recent && used + cost > HISTORY_CHAR_BUDGET) break;
    kept.unshift(message);
    used += cost;
  }

  const omitted = normalized.length - kept.length;
  if (omitted > 0) {
    kept.unshift({
      role: "user",
      content:
        `[Context compacted automatically: ${omitted} older message(s) were omitted to preserve ` +
        "the working context window. Re-read project files or memory when older details are needed.]",
    });
  }
  return kept;
}

function compactToolResult(text: string): string {
  return truncateMiddle(text, TOOL_RESULT_CHAR_LIMIT, "tool output compacted");
}

function compactOldOpenAIToolResults(
  messages: Record<string, unknown>[],
): void {
  let recentTools = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool" || typeof message.content !== "string")
      continue;
    recentTools++;
    if (recentTools > 4) {
      message.content = truncateMiddle(
        message.content,
        OLD_TOOL_RESULT_CHAR_LIMIT,
        "older tool output compacted",
      );
    }
  }
}

function openAICacheKey(
  active: NonNullable<Awaited<ReturnType<typeof getActiveProvider>>>,
  system: string,
  opts: SendOptions,
): string {
  return `cc2:${hashText(
    `${active.config.id}:${active.model}:${opts.cwd ?? "global"}:${system}`,
  ).slice(0, 40)}`;
}

const BASE_PROMPT = [
  "You are CrabCode Agent — the built-in AI software engineer of the CrabCode IDE.",
  'Whatever underlying model powers you, your identity is "CrabCode Agent" and you operate INSIDE',
  "the CrabCode development environment. If asked who you are, say you are the CrabCode Agent.",
  "You are not just a chatbot: you act using the IDE tools (files, terminal, git, the in-editor",
  "browser that is your EYES), verify results, and iterate until the task is genuinely complete,",
  "like Codex / Claude Code.",
  "",
  "## Passive-by-default behavior (non-negotiable)",
  "- You act ONLY in response to a concrete task in the CURRENT user message. Never begin work from",
  "  previous conversation context, an open project, a visible browser page, a remembered goal, a timer,",
  "  or the mere fact that you have access to tools.",
  "- When the user has not given a task — for example they greet you, make small talk, send an empty",
  "  message, or ask a purely conversational question — reply normally and call NO tools.",
  "- Do not proactively inspect files, list directories, run commands, open web pages, capture screenshots,",
  "  read the clipboard, list windows/processes, or take any desktop action unless the current request",
  "  explicitly requires it. Access is permission, not an instruction to explore or monitor.",
  "- Never run in the background, poll for changes, watch the screen, monitor applications, schedule work,",
  "  or continue acting after the requested task is complete. Stop after reporting the completed result.",
  "- If the current request is ambiguous but does not actually ask for an action, ask one concise question",
  "  instead of exploring the project or computer to infer a task.",
  "",
  "## Operating loop (follow every turn)",
  "1. UNDERSTAND. Restate the goal to yourself in one line. Identify success criteria — how you",
  "   will KNOW it works (a passing build, a test, an observable behavior).",
  "2. EXPLORE before touching anything. list_dir the root, then read the files involved end-to-end.",
  "   Use search to find symbols, callers, configs, and similar patterns already in the codebase.",
  "   NEVER edit a file you have not just read. NEVER invent file paths — confirm they exist.",
  "3. PLAN. For non-trivial work, lay out the concrete steps and the files each will touch. Prefer",
  "   the smallest change that fully solves the problem.",
  "4. ACT. Use edit_file for EVERY change to an existing file, including full-file rewrites.",
  "   Use write_file ONLY to create paths that do not exist. Create folders with create_dir.",
  "5. VERIFY. After editing, read the file back. For builds, tests, linters, installs, activation,",
  "   or any shell step, call propose_command so the user receives a command card with a Run button.",
  "   Use run_command only when the CURRENT user message explicitly asks you to execute it in the terminal.",
  "6. ITERATE until the success criteria are met, then give a short, factual summary of what changed.",
  "",
  "## Filesystem mastery",
  "- Treat the project as a graph: a change rarely lives in one file. After editing a symbol, search",
  "  for its other references (imports, call sites, types, tests, docs) and update them too.",
  "- Match the existing code: study neighbouring files first and mirror their style, naming, imports,",
  "  error handling and libraries. Do not introduce a new dependency or pattern when one already exists.",
  "- read_file returns 1-based line numbers — use them to reason precisely about regions.",
  "- For large files, read the relevant sections rather than guessing; confirm context around edits.",
  "- edit_file requires an old_str that appears EXACTLY ONCE. If it is not unique, include more",
  "  surrounding lines until it is. Never use write_file on an existing path, even for large changes.",
  "- When creating files, also wire them in (exports, index files, route tables, build config) so they",
  "  are actually used — a created-but-unreferenced file is an incomplete task.",
  "- Clean up after yourself: remove imports/vars/functions your change orphaned. Do NOT delete",
  "  pre-existing unrelated code; mention it instead.",
  "",
  "## Terminal mastery",
  "- Discover the toolchain before assuming it: read package.json / pyproject.toml / Cargo.toml /",
  "  go.mod / Makefile to learn the real build, test and lint commands. Use those exact commands.",
  "- DEFAULT: never execute shell commands yourself. Call propose_command for every command the user",
  "  may need, including activation, dependency installation, builds, tests, git and package managers.",
  "- propose_command renders the dedicated command card with Copy and Run buttons. Never put shell",
  "  commands in normal prose, bullets, inline code, or ordinary fenced code blocks.",
  '- The host OS matters. On Windows the shell is typically PowerShell/cmd: use ";" not "&&" to',
  "  sequence, native commands (Get-ChildItem/dir, Remove-Item/del) and Windows path separators.",
  "  On macOS/Linux use POSIX sh conventions. Detect the platform from prior output when unsure.",
  "- run_command is exceptional and available only when the CURRENT user message explicitly says to",
  "  run/execute/launch the command in the terminal. Otherwise always use propose_command.",
  "- Long-running or interactive commands always use propose_command, even when execution was requested,",
  "  so the user starts and controls them from the embedded terminal.",
  "- Quote/escape arguments that contain spaces or user-provided values. Avoid destructive commands",
  "  (recursive deletes, force pushes, resets) unless explicitly asked; state the risk first.",
  '- If a command is missing ("not recognized"/"command not found"), install or fall back rather',
  "  than giving up, and tell the user what you did.",
  "",
  "## Debugging & recovery",
  "- Reproduce first. Read the failing code and the exact error. Form a hypothesis, then confirm it",
  "  by reading or running — do not patch blindly.",
  '- For regressions ("it broke", "worked yesterday"), use git_time_travel: "search" (pickaxe) to',
  '  find the commit that introduced the symptom, "show"/"diff" to inspect it, "blame" to see who/why,',
  '  "log"/"bisect_log" to narrow the range. Then read the code and fix the root cause.',
  "- If the SAME approach fails twice, STOP repeating it. Diagnose the underlying cause, state what",
  "  is actually going wrong, and try a fundamentally different approach.",
  "- Prefer fixing the root cause over masking symptoms. No swallowed errors, no dead code to hide a bug.",
  "",
  "## Memory & continuity",
  "- Project memory (.crab/MEMORY.md) is injected at the start. When you learn something durable —",
  "  a user preference, a convention, an architecture decision, a recurring pitfall — call write_memory",
  "  so future sessions stay consistent. Keep notes short and factual.",
  "",
  "## GitHub",
  "- You can connect GitHub and commit/push from chat. If the user pastes a Personal Access Token and",
  '  asks to connect, call github_connect(token). To commit ("commit all", "commit this file with',
  '  message X"), call github_commit(message, paths?). Before committing, if github_status shows GitHub',
  "  is NOT connected, ask the user to paste a token and connect first, then commit.",
  "",
  "## Web & research",
  "- Never search, fetch, browse, or open internet pages unless the CURRENT user message explicitly",
  "  asks for online/web/internet research, asks to Google something, or provides a URL to open/read.",
  "- Do not use web tools proactively, for fact-checking, for current/version-specific information, or",
  "  because internet access might improve the answer. If web was not explicitly requested, stay local.",
  "- You also have EYES: an in-editor browser. Use browser_open(url) to view a running dev server",
  "  (e.g. http://localhost:3000), a web page, docs or a design; then browser_read to get the page",
  "  text/DOM, or browser_screenshot to inspect it visually. Use this to verify how a UI actually",
  "  looks and behaves, not just the code.",
  '- REVIEW-AND-FIX loop: when asked to check a running site (e.g. "@see, посмотри, всё ли корректно"),',
  "  open it in the browser, read it and screenshot it, judge whether it is correct (errors, broken",
  "  layout, missing/wrong content, console issues). If anything is wrong, FIND the responsible source",
  "  files, FIX them with edit_file/write_file, then re-open/reload the browser to confirm the fix.",
  "  Keep iterating until the page is correct. Report what was wrong and what you changed.",
  "",
  "## Context attachments",
  '- "@<path>" is a file or folder the user attached: read files with read_file, explore folders with',
  '  list_dir before acting. "@<path>:<line>" points at a symbol near that line — read around it first.',
  "",
  "## Command presentation — mandatory",
  "- Every shell/terminal command shown to the user MUST be emitted with propose_command.",
  "- Never print executable commands as plain paragraphs, list items, inline code, or regular code fences.",
  "- Do not call run_command unless the current user explicitly asked you to run it in the terminal.",
  "",
  "## Communication",
  "- Keep chat replies short and concrete. Narrate only meaningful steps and decisions; do not dump",
  "  full file contents back into chat. End with a brief summary of what changed and how you verified it.",
  "- You may use a Markdown blockquote (`> quoted text`) when it genuinely improves clarity: to quote",
  "  the user's exact requirement, an important error, a short source excerpt, or a critical warning.",
  "- Keep quotes short and verbatim. Never invent a quote, never put shell commands inside quotes, and",
  "  do not use blockquotes as decoration or for routine status updates.",
  "- Be honest about uncertainty. State what you checked vs. what you could not verify. Never claim a",
  "  build passed or a behavior works unless you actually confirmed it with a tool.",
  "",
  "## Hard rules",
  "- When asked to write code, create/edit real files with the tools — never paste code as the deliverable in chat.",
  "- Always read a file before editing it; edit_file needs an exact, unique old_str.",
  '- Solve the task that was asked. Do not add unrequested features, abstractions or "flexibility".',
  "- If no project folder is open, ask the user to open one before using file tools.",
  "",
  "## Slash commands (you MUST know and execute these exactly)",
  'The user can trigger built-in commands by typing "/<name>". The renderer usually expands a command',
  "into a detailed instruction, but you must ALSO recognise the raw command if it ever reaches you, and",
  "always follow the precise behavior below. Each command maps to a concrete capability — never just",
  "describe it, actually perform it with your tools.",
  "",
  "- /diff [scope] — Show the difference between the committed code and your uncommitted changes.",
  '  Run git_time_travel action "diff" against HEAD (and `git diff --staged` via run_command for staged),',
  "  include untracked files where relevant. Present the diff per file in fenced code blocks with +/- lines",
  "  and a one-line summary per file. READ-ONLY: never modify anything.",
  "- /code-review [focus] [--fix] — Review your written diff for bugs, security vulnerabilities, edge cases,",
  '  performance and code cleanliness. Inspect the change (git_time_travel "diff") and read surrounding',
  "  context. Report findings grouped by severity (Critical / Warning / Nit) with file:line + concrete fixes.",
  "  If --fix is present, after reporting you MUST apply every clear fix with edit_file/write_file, then",
  "  re-read and run the build/tests to confirm. Without --fix, only propose fixes.",
  "- /code-review ultra — A deep, multi-pass review. Map the full blast radius (touched files + their",
  "  callers/callees/tests), then review in separate labelled passes: correctness, edge cases, security,",
  "  performance, concurrency, API/compat, readability, tests. Give file:line + severity + precise fix for",
  "  each, then a prioritized action list and an approve / request-changes verdict.",
  "- /security-review [scope] — Specialized SECURITY AUDIT of the changed code, in READ-ONLY mode (you MUST",
  "  NOT modify files). Identify the diff, read affected code + trust boundaries, and hunt for injection",
  "  (SQL/command/template), XSS, auth/authorization gaps, insecure deserialization, path traversal, SSRF,",
  "  hardcoded secrets, weak crypto, unsafe defaults, missing validation and dependency risks. Report each",
  "  with severity, file:line, exploit scenario and remediation. Recommend but do not apply fixes.",
  "- /btw <note> — A quick side note / aside. Answer the tangent briefly and directly. Do NOT modify files",
  "  or run builds for it unless explicitly asked, and do not lose the main task — treat it as a short",
  "  detour, then return to the original work. Keep it out of the main thread of work.",
  "- /run [args] — Run the project/app so the user can check changes live. Discover the real start command",
  "  from package.json scripts / pyproject.toml / Cargo.toml / Makefile. Because dev servers/watchers are",
  "  long-running, use propose_command (NOT run_command) so the user launches it in the embedded terminal;",
  "  use run_command only for short scripts that terminate. If a local URL appears, offer browser_open to",
  "  verify it visually.",
  "- /verify [focus] — Build the project and run its tests/linters/type-checkers to prove the changes are",
  "  correct. Detect the toolchain, use the project's real commands via run_command, read each failure,",
  "  fix the root cause, and re-run until build + tests + lint all pass. Report exactly what you ran and the",
  "  final result.",
  "- /init [guidance] — Create or update .crab/CRAB.md, the supreme project-context file. Read it if it",
  "  exists, explore the repo to learn build/test/lint/run commands, stack, layout and code-style, then",
  "  write a concise structured CRAB.md (overview, commands, conventions, architecture, do/don't rules).",
  "  These become the top-priority rules you follow every session.",
  "- /memory [note] — Show, add or edit long-term session memory (.crab/MEMORY.md). With a note, call",
  "  write_memory to save a short factual entry; without one, call read_memory and show current notes.",
  "  Memory persists across sessions and is local-only.",
  "- /context [focus] — Report the current context-window state: which files/attachments you are currently",
  '  "seeing" (from @-mentions, prior read_file, steering, memory) and how the relevant parts fit together.',
  "- /compact [emphasis] — Compress this conversation to free context tokens. Produce a tight structured",
  "  summary preserving: the goal + constraints, key decisions, files changed and their state, done-vs-",
  "  pending TODO, and gotchas. Persist durable facts via write_memory, then tell the user they can safely",
  "  continue from the summary.",
  "- /review, /plan, /goal, /worktree, /status, /skill-creator, /mcp, /project, /clear, /delete — other",
  "  built-ins (review changes; plan-before-acting; set an autonomous goal; create a git worktree; report",
  "  project status; create/install skills; manage MCP servers; pick project; clear/delete the chat).",
  "",
  "Rules for all commands: do the real work with tools and report results truthfully; honor READ-ONLY",
  "commands (/diff, /security-review, /context, /memory show) by not mutating files; verify with the",
  "build/tests whenever you change code (especially /code-review --fix and /verify).",
].join("\n");

const MAX_STEPS = 50;

const aborters = new Map<string, AbortController>();

export function abortAgent(requestId: string): void {
  aborters.get(requestId)?.abort();
}

async function buildSystem(
  cwd: string | null,
  access: "normal" | "high",
  editMode: "auto" | "ask" | "readonly",
): Promise<string> {
  const steering = cwd
    ? await readProjectSteering(cwd)
    : { primary: "", others: "" };

  let sys = "";
  if (steering.primary.trim()) {
    sys +=
      "# ⚠⚠ SUPREME RULES — CRAB.md (READ AND ACCEPTED FIRST, ABSOLUTE TOP PRIORITY) ⚠⚠\n" +
      "BEFORE doing anything else in this session — before even greeting or answering the very first " +
      "message — you have read the file .crab/steering/CRAB.md (its full content is below) and you " +
      "ACCEPT and ADOPT every rule in it as binding for the entire session. These rules govern HOW you " +
      "respond from your very first word. They OVERRIDE your defaults and any conflicting request " +
      "(except direct safety concerns). You may NOT ignore, skip, soften or refuse any part of them. " +
      'Apply them to every message, including a simple "привет"/"hi". If a request conflicts with ' +
      "CRAB.md, CRAB.md wins.\n\n" +
      "----- BEGIN CRAB.md -----\n" +
      steering.primary.trim() +
      "\n----- END CRAB.md -----\n\n" +
      "========================================\n\n";
  }
  sys += BASE_PROMPT;
  if (cwd) sys += `\n\nProject root: ${cwd}`;
  if (access === "high") {
    sys +=
      "\n\n# Access level: HIGH (full machine access)\n" +
      "The user has granted you full control of their computer — act like a capable personal " +
      'assistant (a "Jarvis"). You can do anything, from tiny chores to large multi-step tasks:\n' +
      "- Files anywhere: read/write/move/copy/delete using absolute paths (move_path, copy_path, " +
      "write_file, edit_file, delete_path). Copy a project from one folder into another, organize folders, etc.\n" +
      "- Open things: use open_path to open URLs in the browser (e.g. Gmail, Google Calendar), launch apps, reveal folders.\n" +
      "- Terminal: show commands with propose_command by default. Use run_command only when the current user message explicitly asks you to execute a command.\n" +
      "- Email / calendar / web: use online services only when the current user message explicitly asks for them. " +
      "Never open, search, or fetch the web proactively.\n" +
      "- Desktop control: use computer_list_windows, computer_focus_window, computer_screenshot, computer_click, " +
      "computer_type, computer_keypress and computer_scroll for explicit desktop tasks. Take a fresh screenshot before " +
      "coordinate-based actions and verify important results afterward.\n" +
      "High access never authorizes autonomous work: remain passive until the current user message gives a concrete task. " +
      "Be careful with irreversible actions (deleting data, mass changes): briefly state what you will do, then proceed.";
  } else {
    sys +=
      "\n\n# Access level: NORMAL\nStay within the open project directory.";
  }
  if (editMode === "readonly") {
    sys +=
      "\n\n# Mode: PLAN (read only — strictly enforced)\n" +
      "You are a planner right now. Every tool that could change anything (write_file, edit_file, " +
      "create_dir, delete_path, move_path, copy_path, run_command, github_commit, open_path and all " +
      "desktop-control tools) has been REMOVED from your tool list and will be rejected by the runtime. " +
      "Do not claim you changed anything.\n" +
      "Work like this:\n" +
      "1. Investigate with the read-only tools (read_file, list_dir, search, grep) until you actually " +
      "understand the relevant code.\n" +
      "2. Answer with a concrete implementation plan: the exact files to touch, what changes in each one " +
      "(function/section level), the order of steps, risks and how to verify.\n" +
      "3. Show code as fenced snippets in your answer instead of applying it.\n" +
      "4. Finish by telling the user to switch to Agent mode to apply the plan.";
  } else if (editMode === "ask") {
    sys +=
      "\n\n# Mode: ASK (confirmation before every change)\n" +
      "You may use the full tool set, but each mutating call (files, commands, commits, desktop control) " +
      "opens a native approval dialog for the user. Therefore:\n" +
      "- Before the first mutating call, state in one or two sentences exactly what you are about to change.\n" +
      "- Make one change per call so the user can judge each approval.\n" +
      "- If a call comes back as rejected by the user, STOP that line of work, do not retry the same " +
      "operation, and ask what to do instead.";
  } else {
    sys +=
      "\n\n# Mode: AGENT (autonomous editing)\n" +
      "Apply changes directly with the file tools — do not ask for permission and do not just describe " +
      "the change. Read before you edit, make the edit, then verify the result. Every file you write is " +
      "immediately reloaded in the IDE editor, so keep edits complete and syntactically valid.";
  }
  if (steering.others.trim()) {
    sys +=
      "\n\n# Secondary steering rules (.crab/steering/*.md) — follow when not in conflict\n" +
      "These are additional guidance. Honor them, but CRAB.md always takes precedence over them.\n\n" +
      steering.others.trim();
  }
  const memory = cwd ? await readProjectMemory(cwd) : "";
  if (memory.trim()) {
    sys +=
      "\n\n# Project memory (.crab/MEMORY.md) — private, local notes from past sessions.\n" +
      "Use these to stay consistent with prior decisions and the user's preferences. When you learn " +
      "something durable (a preference, convention, decision, or pitfall), call write_memory to save it.\n" +
      memory.trim();
  } else if (cwd) {
    sys +=
      "\n\n# Memory: none yet. When you learn something durable about the user or project " +
      "(preferences, conventions, decisions, pitfalls), call write_memory to remember it for next time.";
  }
  if (cwd) {
    const skills = await buildSkillsCatalog(cwd);
    if (skills) sys += skills;
  }
  return sys;
}

type Emit = (channel: string, ...args: unknown[]) => void;

async function runAgent(
  send: Emit,
  requestId: string,
  messages: ChatMessage[],
  opts: SendOptions,
): Promise<void> {
  if (opts.cwd) void warmProjectIndex(opts.cwd);
  const active = await getActiveProvider();
  const compactedMessages = compactHistory(messages);
  const effectiveOpts: SendOptions = {
    ...opts,
    send,
    requestId,
    webEnabled: Boolean(
      opts.webEnabled && currentUserExplicitlyRequestsWeb(messages),
    ),
    commandExecutionRequested:
      currentUserExplicitlyRequestsCommandExecution(messages),
  };
  const isFreeProvider = active?.config.catalogId === 'opencode' || active?.config.baseUrl.includes('opencode.ai')
  if (!active || (!active.apiKey && !isFreeProvider) || !active.config.baseUrl) {
    await mockStream(send, requestId, compactedMessages);
    return;
  }

  let system = await buildSystem(
    opts.cwd,
    opts.access ?? "normal",
    opts.editMode ?? "auto",
  );
  system += effectiveOpts.webEnabled
    ? "\n\n# Web access: EXPLICIT REQUEST ONLY\nThe current user message explicitly requested internet use. Use web tools only for that stated online task."
    : "\n\n# Web access: DISABLED FOR THIS TURN\nThe current user message did not explicitly request internet use. Do not search, fetch, browse, or open online pages.";
  const controller = new AbortController();
  aborters.set(requestId, controller);
  const signal = controller.signal;

  try {
    if (active.config.api === "anthropic") {
      await loopAnthropic(
        send,
        requestId,
        active,
        system,
        compactedMessages,
        effectiveOpts,
        signal,
      );
    } else if (active.config.api === "gemini") {
      await loopGemini(
        send,
        requestId,
        active,
        system,
        compactedMessages,
        effectiveOpts,
        signal,
      );
    } else {
      await loopOpenAI(
        send,
        requestId,
        active,
        system,
        compactedMessages,
        effectiveOpts,
        signal,
      );
    }
  } catch (err) {
    if (signal.aborted) {
      send("agent:done", requestId);
    } else {
      send(
        "agent:error",
        requestId,
        err instanceof Error ? err.message : String(err),
      );
    }
  } finally {
    aborters.delete(requestId);
  }
}

interface OpenAIToolCall {
  id: string;
  name: string;
  args: string;
}

async function loopOpenAI(
  send: Emit,
  requestId: string,
  active: NonNullable<Awaited<ReturnType<typeof getActiveProvider>>>,
  system: string,
  history: ChatMessage[],
  opts: SendOptions,
  signal: AbortSignal,
): Promise<void> {
  const tools = availableToolDefs(opts).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const msgs: Record<string, unknown>[] = [
    { role: "system", content: system },
    ...history.map((m) => toOpenAIMessage(m)),
  ];

  type CacheMode = "extended" | "key" | "none";
  const officialOpenAI = /(^|\.)openai\.com$/i.test(
    new URL(active.config.baseUrl).hostname,
  );
  const cacheKey = openAICacheKey(active, system, opts);
  let cacheMode: CacheMode = officialOpenAI ? "extended" : "key";

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return;
    compactOldOpenAIToolResults(msgs);
    const isOpencode = active.config.baseUrl.includes('opencode.ai')
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (active.apiKey) {
      headers["Authorization"] = `Bearer ${active.apiKey}`
    }
    if (isOpencode) {
      headers["x-opencode-client"] = "desktop"
    }

    const doFetch = (mode: CacheMode): Promise<Response> =>
      fetch(`${active.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: active.model,
          messages: msgs,
          tools,
          stream: true,
          ...(mode !== "none" ? { prompt_cache_key: cacheKey } : {}),
          ...(mode === "extended" ? { prompt_cache_retention: "24h" } : {}),
        }),
        signal,
      });
    let res = await doFetch(cacheMode);
    if (
      !res.ok &&
      cacheMode === "extended" &&
      [400, 404, 422].includes(res.status)
    ) {
      cacheMode = "key";
      res = await doFetch(cacheMode);
    }
    if (
      !res.ok &&
      cacheMode === "key" &&
      [400, 404, 422].includes(res.status)
    ) {
      cacheMode = "none";
      res = await doFetch(cacheMode);
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      send("agent:error", requestId, `Request failed (${res.status}): ${text}`);
      return;
    }

    let textContent = "";
    const toolCalls: OpenAIToolCall[] = [];
    let finishReason = "";

    await pumpSSE(res.body, (data) => {
      if (data === "[DONE]") return "done";
      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          textContent += delta.content;
          send("agent:chunk", requestId, delta.content as string);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx])
              toolCalls[idx] = { id: "", name: "", args: "" };
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].name += tc.function.name;
            if (tc.function?.arguments)
              toolCalls[idx].args += tc.function.arguments;
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch { }
      return "cont";
    });

    const calls = toolCalls.filter((c) => c && c.name);
    if (calls.length === 0 || finishReason === "stop") {
      send("agent:done", requestId);
      return;
    }

    msgs.push({
      role: "assistant",
      content: textContent || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.args || "{}" },
      })),
    });

    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = c.args ? JSON.parse(c.args) : {};
      } catch {
        args = {};
      }
      send("agent:tool", requestId, {
        id: c.id,
        name: c.name,
        input: args,
        status: "running",
      });
      const result = await runToolForRequest(opts, c.name, args);
      send("agent:tool", requestId, {
        id: c.id,
        name: c.name,
        input: args,
        status: "done",
        result: result.text.slice(0, 4000),
        meta: result.meta,
        command: result.command,
        mutated: result.mutated,
      });
      msgs.push({
        role: "tool",
        tool_call_id: c.id,
        content: compactToolResult(result.text),
      });
      if (result.image) {
        msgs.push({
          role: "user",
          content: [
            { type: "text", text: `Image from ${c.name}:` },
            { type: "image_url", image_url: { url: result.image.dataUrl } },
          ],
        });
      }
    }
  }

  send("agent:chunk", requestId, "\n\n_(Достигнут лимит шагов агента.)_");
  send("agent:done", requestId);
}

async function loopAnthropic(
  send: Emit,
  requestId: string,
  active: NonNullable<Awaited<ReturnType<typeof getActiveProvider>>>,
  system: string,
  history: ChatMessage[],
  opts: SendOptions,
  signal: AbortSignal,
): Promise<void> {
  const toolDefs = availableToolDefs(opts);
  const plainTools = toolDefs.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
  const cachedTools = plainTools.map((tool, index) => ({
    ...tool,
    ...(index === plainTools.length - 1
      ? { cache_control: { type: "ephemeral" } }
      : {}),
  }));

  const msgs: Record<string, unknown>[] = history.map((m) =>
    toAnthropicMessage(m),
  );
  let usePromptCache = true;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return;
    const doFetch = (withCache: boolean): Promise<Response> =>
      fetch(`${active.config.baseUrl.replace(/\/$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": active.apiKey,
          "anthropic-version": "2023-06-01",
          ...(withCache
            ? { "anthropic-beta": "prompt-caching-2024-07-31" }
            : {}),
        },
        body: JSON.stringify({
          model: active.model,
          system: withCache
            ? [
              {
                type: "text",
                text: system,
                cache_control: { type: "ephemeral" },
              },
            ]
            : [{ type: "text", text: system }],
          messages: withCache ? withAnthropicCacheMarkers(msgs) : msgs,
          tools: withCache ? cachedTools : plainTools,
          max_tokens: 8192,
          stream: true,
        }),
        signal,
      });
    let res = await doFetch(usePromptCache);
    if (!res.ok && usePromptCache && [400, 404, 422].includes(res.status)) {
      usePromptCache = false;
      res = await doFetch(false);
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      send("agent:error", requestId, `Request failed (${res.status}): ${text}`);
      return;
    }

    const blocks: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: string }
    > = [];
    let stopReason = "";

    await pumpSSE(res.body, (data) => {
      try {
        const json = JSON.parse(data);
        if (json.type === "content_block_start") {
          const cb = json.content_block;
          if (cb.type === "text")
            blocks[json.index] = { type: "text", text: "" };
          else if (cb.type === "tool_use")
            blocks[json.index] = {
              type: "tool_use",
              id: cb.id,
              name: cb.name,
              input: "",
            };
        } else if (json.type === "content_block_delta") {
          const b = blocks[json.index];
          if (json.delta?.type === "text_delta" && b?.type === "text") {
            b.text += json.delta.text;
            send("agent:chunk", requestId, json.delta.text as string);
          } else if (
            json.delta?.type === "input_json_delta" &&
            b?.type === "tool_use"
          ) {
            b.input += json.delta.partial_json;
          }
        } else if (json.type === "message_delta" && json.delta?.stop_reason) {
          stopReason = json.delta.stop_reason;
        } else if (json.type === "message_stop") {
          return "done";
        }
      } catch { }
      return "cont";
    });

    const toolUses = blocks.filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: string } =>
        b?.type === "tool_use",
    );

    if (stopReason !== "tool_use" || toolUses.length === 0) {
      send("agent:done", requestId);
      return;
    }

    msgs.push({
      role: "assistant",
      content: blocks.map((b) =>
        b.type === "text"
          ? { type: "text", text: b.text }
          : {
            type: "tool_use",
            id: b.id,
            name: b.name,
            input: safeJson(b.input),
          },
      ),
    });

    const toolResults: Record<string, unknown>[] = [];
    for (const tu of toolUses) {
      const args = safeJson(tu.input);
      send("agent:tool", requestId, {
        id: tu.id,
        name: tu.name,
        input: args,
        status: "running",
      });
      const result = await runToolForRequest(opts, tu.name, args);
      send("agent:tool", requestId, {
        id: tu.id,
        name: tu.name,
        input: args,
        status: "done",
        result: result.text.slice(0, 4000),
        meta: result.meta,
        command: result.command,
        mutated: result.mutated,
      });
      if (result.image) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: [
            { type: "text", text: compactToolResult(result.text) },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: result.image.mimeType,
                data: result.image.dataUrl.replace(/^data:[^,]+,/, ""),
              },
            },
          ],
        });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: compactToolResult(result.text),
        });
      }
    }
    msgs.push({ role: "user", content: toolResults });
  }

  send("agent:chunk", requestId, "\n\n_(Достигнут лимит шагов агента.)_");
  send("agent:done", requestId);
}

function withAnthropicCacheMarkers(
  msgs: Record<string, unknown>[],
): Record<string, unknown>[] {
  const markerIndexes = new Set<number>();
  if (msgs.length > 0) markerIndexes.add(msgs.length - 1);
  if (msgs.length >= 6) markerIndexes.add(Math.floor((msgs.length - 1) / 2));
  return msgs.map((m, i) => {
    if (!markerIndexes.has(i)) return m;
    const content = m.content;
    if (typeof content === "string" && content.trim()) {
      return {
        ...m,
        content: [
          { type: "text", text: content, cache_control: { type: "ephemeral" } },
        ],
      };
    }
    if (Array.isArray(content) && content.length > 0) {
      return {
        ...m,
        content: content.map((b, j) =>
          j === content.length - 1
            ? {
              ...(b as Record<string, unknown>),
              cache_control: { type: "ephemeral" },
            }
            : b,
        ),
      };
    }
    return m;
  });
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function toOpenAIMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === "user" && m.images && m.images.length > 0) {
    return {
      role: "user",
      content: [
        ...(m.content ? [{ type: "text", text: m.content }] : []),
        ...m.images.map((img) => ({
          type: "image_url",
          image_url: { url: img.dataUrl },
        })),
      ],
    };
  }
  return { role: m.role, content: m.content };
}

function toAnthropicMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === "user" && m.images && m.images.length > 0) {
    return {
      role: "user",
      content: [
        ...m.images.map((img) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimeType,
            data: img.dataUrl.replace(/^data:[^,]+,/, ""),
          },
        })),
        ...(m.content ? [{ type: "text", text: m.content }] : []),
      ],
    };
  }
  return { role: m.role, content: m.content };
}

function toGeminiParts(m: ChatMessage): Record<string, unknown>[] {
  const parts: Record<string, unknown>[] = [];
  if (m.content) parts.push({ text: m.content });
  if (m.role === "user" && m.images) {
    for (const img of m.images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.dataUrl.replace(/^data:[^,]+,/, ""),
        },
      });
    }
  }
  if (parts.length === 0) parts.push({ text: "" });
  return parts;
}

// ponytail: cloudcode-pa private endpoint used by Gemini Code Assist IDE plugins.
// Requires loadCodeAssist to get project ID first, then streamGenerateContent wraps
// request in { project, model, request: { contents, systemInstruction } }.
const _antigravityProjectCache = new Map<string, string>();

function sanitizeGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeGeminiSchema);
  }
  if (schema && typeof schema === "object") {
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "enum" && Array.isArray(val)) {
        res[key] = val.map((v) => String(v));
      } else {
        res[key] = sanitizeGeminiSchema(val);
      }
    }
    return res;
  }
  return schema;
}

async function loopGemini(
  send: Emit,
  requestId: string,
  active: NonNullable<Awaited<ReturnType<typeof getActiveProvider>>>,
  system: string,
  history: ChatMessage[],
  opts: SendOptions,
  signal: AbortSignal,
): Promise<void> {
  const isAntigravity =
    active.config.catalogId === "google-antigravity" ||
    active.apiKey.startsWith("ya29.") ||
    active.apiKey.startsWith("Bearer ");

  const toolDefs = availableToolDefs(opts);
  const geminiTools =
    toolDefs.length > 0
      ? [
          {
            functionDeclarations: toolDefs.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: sanitizeGeminiSchema(t.parameters) as Record<string, unknown>,
            })),
          },
        ]
      : undefined;

  const geminiContents: Record<string, unknown>[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toGeminiParts(m),
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return;

    console.log(`[AG Debug] Step ${step} starting. Antigravity: ${isAntigravity}, Model: ${active.model}`);
    let res: Response;
    if (isAntigravity) {
      const CC_BASE = "https://cloudcode-pa.googleapis.com";
      const token = active.apiKey.replace(/^Bearer\s+/i, "").trim();
      const clientMetadata = JSON.stringify({ ideType: 9, platform: 2, pluginType: 2 });

      const tokenKey = token.slice(-12);
      let project = _antigravityProjectCache.get(tokenKey);
      if (!project) {
        try {
          const lcaBody = JSON.stringify({
            cloudaicompanionProject: "",
            metadata: { ideType: 9, platform: 2, pluginType: 2 },
          });
          const lca = await fetch(`${CC_BASE}/v1internal:loadCodeAssist`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "google-api-nodejs-client/9.15.1",
              "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
              "Client-Metadata": clientMetadata,
            },
            body: lcaBody,
            signal,
          });
          const lcaText = await lca.text();
          if (lca.ok) {
            const lcaJson = JSON.parse(lcaText) as { cloudaicompanionProject?: string };
            project = lcaJson.cloudaicompanionProject ?? "";
            if (project) _antigravityProjectCache.set(tokenKey, project);
          }
        } catch { }
      }

      const streamHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
        "Accept": "text/event-stream",
      };

      const streamBody = JSON.stringify({
        ...(project ? { project } : {}),
        model: active.model,
        request: {
          systemInstruction: { parts: [{ text: system }] },
          contents: geminiContents,
          ...(geminiTools ? { tools: geminiTools } : {}),
        },
      });

      console.log("[AG Debug] Antigravity Request Body:", streamBody.slice(0, 500));

      res = await fetch(`${CC_BASE}/v1internal:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: streamHeaders,
        body: streamBody,
        signal,
      });
    } else {
      const base = active.config.baseUrl.replace(/\/$/, "");
      const url =
        `${base}/v1beta/models/${active.model}:streamGenerateContent` +
        `?alt=sse&key=${encodeURIComponent(active.apiKey)}`;

      const streamBody = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: geminiContents,
        ...(geminiTools ? { tools: geminiTools } : {}),
      });

      console.log("[AG Debug] Gemini Request Body:", streamBody.slice(0, 500));

      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: streamBody,
        signal,
      });
    }

    console.log(`[AG Debug] Response status: ${res.status} ${res.statusText}`);

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      console.error(`[AG Debug] Request failed (${res.status}): ${text}`);
      send("agent:error", requestId, `Request failed (${res.status}): ${text}`);
      return;
    }

    let stepText = "";
    interface GeminiToolCall {
      id: string;
      rawName: string;
      name: string;
      args: Record<string, unknown>;
      thoughtSignature?: string;
    }
    const stepToolCalls: GeminiToolCall[] = [];

    let lastThoughtSignature = "";
    await pumpSSE(res.body, (data) => {
      console.log("[AG Debug] SSE raw chunk:", data.slice(0, 300));
      try {
        const json = JSON.parse(data);
        const cand = json.response?.candidates?.[0] ?? json.candidates?.[0];
        if (cand?.content?.parts) {
          for (const p of cand.content.parts as Record<string, unknown>[]) {
            if (typeof p.thoughtSignature === "string" && p.thoughtSignature) {
              lastThoughtSignature = p.thoughtSignature;
            }
            if (typeof p.text === "string" && p.text.length > 0) {
              stepText += p.text;
              send("agent:chunk", requestId, p.text);
            }
            if (p.functionCall && typeof p.functionCall === "object") {
              const fc = p.functionCall as { name?: string; args?: unknown; id?: string; thoughtSignature?: string };
              const rawName = fc.name || "";
              const cleanName = rawName.replace(/^(?:crabcode|mcp):/, "");
              let args: Record<string, unknown> = {};
              if (typeof fc.args === "object" && fc.args !== null) {
                args = fc.args as Record<string, unknown>;
              } else if (typeof fc.args === "string") {
                try {
                  args = JSON.parse(fc.args);
                } catch { }
              }
              const thoughtSig = (p.thoughtSignature as string) || fc.thoughtSignature || lastThoughtSignature;
              const callId = fc.id || (p.id as string) || `tc_${randomUUID().slice(0, 8)}`;
              const exists = stepToolCalls.some(
                (tc) => tc.id === callId || (tc.rawName === rawName && JSON.stringify(tc.args) === JSON.stringify(args)),
              );
              if (!exists) {
                stepToolCalls.push({
                  id: callId,
                  rawName,
                  name: cleanName,
                  args,
                  thoughtSignature: thoughtSig,
                });
              }
            }
          }
        }
      } catch { }
      return "cont";
    });

    console.log(`[AG Debug] Step ${step} done. Text len: ${stepText.length}, Tool calls: ${stepToolCalls.length}`);

    if (stepToolCalls.length === 0) {
      send("agent:done", requestId);
      return;
    }

    const modelParts: Record<string, unknown>[] = [];
    if (stepText) {
      modelParts.push({ text: stepText });
    }
    for (const tc of stepToolCalls) {
      const part: Record<string, unknown> = {
        functionCall: {
          name: tc.rawName,
          args: tc.args,
        },
      };
      if (tc.thoughtSignature) {
        part.thoughtSignature = tc.thoughtSignature;
      }
      modelParts.push(part);
    }
    geminiContents.push({
      role: "model",
      parts: modelParts,
    });

    const funcParts: Record<string, unknown>[] = [];
    for (const tc of stepToolCalls) {
      send("agent:tool", requestId, {
        id: tc.id,
        name: tc.name,
        input: tc.args,
        status: "running",
      });

      const result = await runToolForRequest(opts, tc.name, tc.args);

      send("agent:tool", requestId, {
        id: tc.id,
        name: tc.name,
        input: tc.args,
        status: "done",
        result: result.text.slice(0, 4000),
        meta: result.meta,
        command: result.command,
        mutated: result.mutated,
      });

      funcParts.push({
        functionResponse: {
          name: tc.rawName,
          response: {
            output: compactToolResult(result.text),
          },
        },
      });
    }

    geminiContents.push({
      role: "user",
      parts: funcParts,
    });
  }

  send("agent:done", requestId);
}

const geminiSystemCaches = new Map<string, { name: string; expires: number }>();

function invalidateGeminiSystemCache(name: string): void {
  for (const [key, value] of geminiSystemCaches) {
    if (value.name === name) geminiSystemCaches.delete(key);
  }
}

function hashText(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

async function getGeminiSystemCache(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  signal: AbortSignal,
): Promise<string | null> {
  const key = `${baseUrl}:${hashText(apiKey).slice(0, 12)}:${model}:${hashText(system)}`;
  const now = Date.now();
  const hit = geminiSystemCaches.get(key);
  if (hit && hit.expires > now) return hit.name;
  try {
    const res = await fetch(
      `${baseUrl}/v1beta/cachedContents?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          systemInstruction: { parts: [{ text: system }] },
          ttl: "14400s",
        }),
        signal,
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string };
    if (!json.name) return null;
    geminiSystemCaches.set(key, {
      name: json.name,
      expires: now + 230 * 60 * 1000,
    });
    return json.name;
  } catch {
    return null;
  }
}

async function pumpSSE(
  body: ReadableStream<Uint8Array>,
  consume: (data: string) => "cont" | "done",
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (consume(data) === "done") return;
    }
  }
}

async function mockStream(
  send: Emit,
  requestId: string,
  messages: ChatMessage[],
): Promise<void> {
  const last = messages[messages.length - 1]?.content ?? "";
  const reply =
    `Я CrabCode — AI-агент. Вы написали: "${last.slice(0, 120)}". ` +
    `Чтобы я мог создавать и редактировать файлы и выполнять команды, ` +
    `откройте Settings → Providers и подключите модель.`;
  for (const token of reply.split(/(\s+)/)) {
    send("agent:chunk", requestId, token);
    await new Promise((r) => setTimeout(r, 16));
  }
  send("agent:done", requestId);
}

export function registerAgent(ipcMain: IpcMain): void {
  ipcMain.on(
    "agent:send",
    (event, requestId: string, messages: ChatMessage[], opts?: SendOptions) => {
      void runAgent(
        (channel, ...args) => event.sender.send(channel, ...args),
        requestId,
        messages,
        opts ?? { cwd: null },
      );
    },
  );

  ipcMain.on("agent:abort", (_event, requestId: string) => {
    abortAgent(requestId);
  });

  // Forward confirm-response from renderer to the webContents IPC listener
  ipcMain.on("agent:confirm-response", (event, confirmId: string, allowed: boolean) => {
    event.sender.emit(`agent:confirm-response:${confirmId}`, null, confirmId, allowed);
  });
}
