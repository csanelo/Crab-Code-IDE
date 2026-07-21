import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Folder,
  ChevronDown,
  Sparkles,
  Plus,
  ArrowUp,
  Pencil,
  Check,
  Github,
  TerminalSquare,
  FolderLock,
  MonitorCog,
  Square,
  Code2,
  SquarePen,
  Hash,
  GitBranch,
  Diff,
  Terminal,
  Globe,
  Boxes,
  Paperclip,
  X,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import type { TKey } from "../../i18n/translations";
import { providersService } from "../../services/providersService";
import { SLASH_COMMANDS } from "../chat/slashCommands";
import {
  getAccessLevel,
  setAccessLevel,
  type AccessLevel,
} from "../../lib/agentAccess";
import {
  getEditMode,
  setEditMode,
  type EditMode,
} from "../../lib/agentEditMode";
import { on as onAppEvent, emit as emitAppEvent } from "../../lib/appEvents";
import { toastInfo } from "../../lib/toast";
import { fileIcon } from "../files/iconMap";
import { GithubPanel } from "./GithubPanel";
import { SshPanel } from "./SshPanel";
import { ContextMenu } from "../sidebar/ContextMenu";
import "./NewSession.css";

const EDIT_MODES: { id: string; key: TKey }[] = [
  { id: "auto", key: "chat.edit.auto" },
  { id: "ask", key: "chat.edit.ask" },
  { id: "readonly", key: "chat.edit.readonly" },
];

const ACCESS_LEVELS: {
  id: AccessLevel;
  key: TKey;
  descKey: TKey;
  icon: LucideIcon;
}[] = [
  {
    id: "normal",
    key: "access.normal",
    descKey: "access.normalDesc",
    icon: FolderLock,
  },
  {
    id: "high",
    key: "access.high",
    descKey: "access.highDesc",
    icon: MonitorCog,
  },
];

interface ModelOption {
  providerId: string;
  providerName: string;
  modelId: string;
  label: string;
}

type RepoSource = "folder" | "github" | "ssh";

const REPO_SOURCES: { id: RepoSource; key: TKey; icon: typeof Folder }[] = [
  { id: "folder", key: "chat.source.folder", icon: Folder },
  { id: "github", key: "chat.source.github", icon: Github },
  { id: "ssh", key: "chat.source.ssh", icon: TerminalSquare },
];

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "mdx",
  "json",
  "jsonc",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "xml",
  "svg",
  "yml",
  "yaml",
  "toml",
  "ini",
  "env",
  "py",
  "rb",
  "php",
  "java",
  "kt",
  "kts",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "go",
  "rs",
  "swift",
  "sql",
  "sh",
  "bat",
  "ps1",
  "log",
  "csv",
]);

function isTextAttachment(
  attachment: import("../../domain/types").Attachment,
): boolean {
  if (attachment.mimeType.startsWith("text/")) return true;
  if (/json|javascript|typescript|xml|yaml|toml/.test(attachment.mimeType))
    return true;
  const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_FILE_EXTENSIONS.has(extension);
}

async function readAttachmentText(
  attachment: import("../../domain/types").Attachment,
): Promise<string> {
  const response = await fetch(attachment.dataUrl);
  return response.text();
}

function parentPath(p: string): string {
  const norm = p.replace(/[\\/]+$/, "");
  const idx = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return idx > 0 ? norm.slice(0, idx) : norm;
}

function expandBuiltinCommand(cmd: string, rest: string): string | null {
  switch (cmd) {
    case "diff":
      return (
        "Show the DIFF of the current changes" +
        (rest ? ` for: ${rest}` : "") +
        '.\nSteps: 1) Run git_time_travel with action "diff" (base HEAD) — or run_command `git diff` ' +
        "(and `git diff --staged`) — to capture exactly what changed since the last commit, including " +
        "untracked files where relevant. 2) Present the diff grouped by file, with hunk headers and " +
        "+/- lines preserved in fenced code blocks. 3) Add a one-line summary per file describing what " +
        "changed and why. Do NOT modify anything — this is a read-only view of the changes."
      );
    case "code-review": {
      const ultra = /^ultra\b/i.test(rest);
      const fix = /--fix\b/.test(rest);
      const focus = rest
        .replace(/^ultra\b/i, "")
        .replace(/--fix\b/, "")
        .trim();
      if (ultra) {
        return (
          "Run a DEEP, MULTI-PASS CODE REVIEW (ultra mode)" +
          (focus ? ` focused on: ${focus}` : " of the uncommitted changes") +
          ".\nThis is the most thorough review you can do — spend real effort:\n" +
          '1) Map the change set: git_time_travel "diff" against HEAD, then read_file each touched file ' +
          "AND its key callers/callees/tests so you understand the full blast radius.\n" +
          "2) Review in separate passes, each reported under its own heading: (a) Correctness & logic " +
          "bugs, (b) Edge cases & error handling, (c) Security & input validation, (d) Performance & " +
          "complexity, (e) Concurrency/race conditions, (f) API/contract & backward compatibility, " +
          "(g) Readability, naming & consistency with existing style, (h) Tests & coverage gaps.\n" +
          "3) For every finding give file:line, severity (Critical/High/Medium/Nit), the concrete risk, " +
          "and a precise fix.\n4) End with a prioritized action list and an overall verdict " +
          "(approve / request changes)."
        );
      }
      return (
        "Perform a CODE REVIEW of the written changes (the diff)" +
        (focus ? `, focused on: ${focus}` : "") +
        '.\nSteps: 1) Use git_time_travel "diff" against HEAD and read_file to see the change and its ' +
        "surrounding context. 2) Analyze for bugs, security vulnerabilities, edge cases, performance, " +
        "and code cleanliness/consistency. 3) Report findings grouped by severity (Critical / Warning / " +
        "Nit) with file:line references and concrete suggestions.\n" +
        (fix
          ? "4) --fix is set: after reporting, FIX every clear issue directly with edit_file/write_file, " +
            "then re-read the files and run the build/tests (run_command) to confirm nothing broke. " +
            "Summarize what you changed."
          : "4) Do not edit yet — offer to fix the issues, or re-run with `--fix` to apply fixes automatically.")
      );
    }
    case "security-review":
      return (
        "Perform a focused SECURITY AUDIT of the changed code in READ-ONLY mode" +
        (rest ? ` (scope: ${rest})` : "") +
        '.\nYou MUST NOT modify any files. Steps: 1) Identify what changed (git_time_travel "diff" ' +
        "against HEAD) and read the affected code plus the trust boundaries it touches. 2) Hunt for " +
        "security issues: injection (SQL/command/template), XSS, auth/authorization gaps, insecure " +
        "deserialization, path traversal, SSRF, secrets/credentials in code, weak crypto, unsafe " +
        "defaults, missing input validation/escaping, and dependency risks. 3) Report each issue with " +
        "severity (Critical/High/Medium/Low), file:line, an explanation of how it could be exploited, " +
        "and the recommended remediation. 4) Recommend, but do not apply, fixes. If nothing is found, " +
        "say so explicitly and note what you checked."
      );
    case "run":
      return (
        "RUN the project so the user can see the changes live" +
        (rest ? ` (${rest})` : "") +
        ".\nSteps: 1) Discover the correct start command by reading package.json scripts / " +
        "pyproject.toml / Cargo.toml / Makefile etc. 2) Because dev servers and watchers are " +
        "long-running, use propose_command (NOT run_command) so the user can launch it in the " +
        'embedded terminal with one click — e.g. propose_command("npm run dev"). 3) If a local URL ' +
        "is produced (e.g. http://localhost:3000), offer to open it in the in-editor browser with " +
        "browser_open to verify visually. Use run_command only for short one-shot start scripts that " +
        "terminate on their own."
      );
    case "verify":
      return (
        "VERIFY the current changes are correct" +
        (rest ? ` (focus: ${rest})` : "") +
        ".\nSteps: 1) Detect the toolchain from the project files (package.json / pyproject.toml / " +
        "Cargo.toml / go.mod / Makefile). 2) Build the project and run the test suite and linter/type " +
        "checker with run_command, using the project's real commands. 3) Read each failure carefully, " +
        "fix the root cause with edit_file/write_file, and re-run until the build, tests and linters " +
        "all pass. 4) Report exactly what you ran and the final pass/fail result. If something cannot " +
        "be run, say why."
      );
    case "init":
      return (
        "Create or update the project rules file .crab/CRAB.md (global project context).\n" +
        "Steps: 1) Read .crab/CRAB.md if it exists; otherwise plan to create it. 2) Explore the repo " +
        "(list_dir, read_file package.json / configs / README) to learn the build, test, lint and run " +
        "commands, the language/framework, directory layout, and any code-style conventions. 3) Write a " +
        "concise, well-structured .crab/CRAB.md with sections like: Project overview, Build/Run/Test " +
        "commands, Code style & conventions, Architecture notes, and Do/Don't rules for the agent. " +
        "4) Keep it factual and short — these become the supreme rules the agent follows every session. " +
        (rest ? `Incorporate this guidance: ${rest}. ` : "") +
        "Confirm the path written when done."
      );
    case "memory":
      return (
        "Manage the project's long-term MEMORY (.crab/MEMORY.md).\n" +
        (rest
          ? `The user wants to add/update this memory: "${rest}". Use write_memory to save it as a ` +
            "short, factual note, then read_memory and show the updated memory."
          : "Call read_memory and show the current durable notes. If the user then asks to add or change " +
            "something, use write_memory (concise, factual). Memory persists across sessions and is " +
            "stored locally only.")
      );
    case "context":
      return (
        "Report the current CONTEXT WINDOW state" +
        (rest ? ` relevant to: ${rest}` : "") +
        '.\nList which files and attachments you are currently "seeing" in this conversation (from ' +
        "@-mentions, prior read_file calls, steering and memory), and summarize how the relevant parts " +
        "fit together. If useful, explore with list_dir / read_file to ground the summary. Keep it " +
        "focused so the user understands what is and isn't in context."
      );
    case "compact":
      return (
        "COMPACT this conversation to free up context tokens.\n" +
        "Produce a tight, structured summary that preserves everything needed to continue the work: " +
        "1) The user's goal and any constraints/preferences stated. 2) Key decisions and why. 3) Files " +
        "changed so far and their current state. 4) What is done vs. still pending (a short TODO). " +
        "5) Any important gotchas discovered. Write durable facts to memory with write_memory so they " +
        "survive. Then tell the user they can safely start a fresh chat from this summary." +
        (rest ? `\n\nEmphasize: ${rest}` : "")
      );
    case "btw":
      return (
        "QUICK ASIDE (does not change the main task): " +
        (rest || "(the user will type the aside)") +
        ".\nAnswer this side question briefly and directly. Do NOT modify files or run the build for " +
        "this unless explicitly asked, and do not lose track of the main task — treat it as a short " +
        "tangent, then we return to what we were doing."
      );
    case "review":
      return (
        "Perform a thorough CODE REVIEW" +
        (rest
          ? ` focused on: ${rest}`
          : " of the uncommitted changes (git diff against HEAD)") +
        ".\n" +
        'Steps: 1) Use git_time_travel ("diff" against HEAD, or "log") and read_file to see what ' +
        "changed and its surrounding context. 2) Evaluate correctness, bugs, edge cases, security, " +
        "performance, readability and consistency with the existing code style. 3) Report findings " +
        "grouped by severity (Critical / Warning / Nit) with file:line references and concrete " +
        "suggestions. 4) If you find clear bugs, offer to fix them (or fix directly if asked)."
      );
    case "plan":
      return (
        "Enter PLANNING mode" +
        (rest ? ` for: ${rest}` : "") +
        ".\nFirst explore the relevant code (list_dir, read_file, search). Then produce a concise, " +
        "numbered implementation plan: the files you will touch, the change in each, and how you " +
        "will verify it. Do NOT make changes yet — present the plan and wait for confirmation."
      );
    case "goal":
      return (
        "Set this as the GOAL and work toward it autonomously until done: " +
        (rest || "(the user will specify the goal)") +
        ".\nDefine clear success criteria (a build passing, a test, an observable behavior), then " +
        "loop: act → verify → iterate until the criteria are met. Report progress succinctly."
      );
    case "status":
      return (
        "Report STATUS: summarize the current project state — git branch and uncommitted changes " +
        '(use git_time_travel "log"/"diff" and the changes list), what was recently worked on, and ' +
        "any obvious next steps. Keep it concise."
      );
    case "worktree":
      return (
        "Set up a new git WORKTREE" +
        (rest ? ` for: ${rest}` : "") +
        '.\nFirst check this is a git repo (git_time_travel "log"). Then propose a branch name and ' +
        "the worktree path, and run the commands via run_command: `git worktree add <path> -b <branch>`. " +
        "Explain what a worktree is if helpful, and report the new path when done. Ask before creating " +
        "if the branch/path is ambiguous."
      );
    case "skill-creator":
      return (
        "Act as SKILL CREATOR for CrabCode.\n" +
        (rest
          ? `The user wants: ${rest}\n\n`
          : "The user has not described the skill yet — ask what skill to build, or offer to install " +
            "one from https://github.com/anthropics/skills.\n\n") +
        'A "skill" is a reusable capability stored as SKILL.md (frontmatter name + description, then ' +
        'Markdown instructions). It installs under .crab/skills/<name>/ and becomes a "/<name>" command. ' +
        "You have dedicated tools — use them, do not just paste files into chat:\n" +
        "1) CREATE a new skill: call create_skill { name, description, body } with clear, practical, " +
        "numbered instructions in body. It installs instantly.\n" +
        '2) INSTALL specific skills from a repo: call add_skill { url, skills: ["<name>", ...] }. ' +
        'This is what "npx skills add <repo> --skill <name>" means (each --skill → one array entry, ' +
        "fetched from skills/<name>/SKILL.md). Example: " +
        'add_skill { url: "https://github.com/anthropics/skills", skills: ["frontend-design"] }.\n' +
        "3) INSTALL a single SKILL.md by direct link: call add_skill { url }.\n" +
        "4) DISCOVER what a repo offers: call list_skills { repo } (or add_skill { url } on a bare repo).\n" +
        "If the user gives a topic but no link, either build the skill with create_skill or propose a " +
        "matching skill from anthropics/skills and install it. Keep every SKILL.md focused and practical."
      );
    default:
      return null;
  }
}

export function NewSession({
  onSend,
  showHeader = true,
  streaming = false,
  onStop,
}: {
  onSend: (
    text: string,
    attachments?: import("../../domain/types").Attachment[],
    agentContent?: string,
    webEnabled?: boolean,
  ) => void;
  showHeader?: boolean;
  streaming?: boolean;
  onStop?: () => void;
}): JSX.Element {
  const {
    state,
    selectProject,
    openProject,
    deleteProject,
    createConversation,
    selectConversation,
    deleteConversation,
    clearConversation,
    renameConversation,
  } = useApp();
  const t = useT();
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const sessionList = (activeRepo?.conversationIds ?? [])
    .map((id) => state.conversations[id])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const [value, setValue] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [activeModel, setActiveModel] = useState<ModelOption | null>(null);
  const activeConv = state.activeConversationId
    ? (state.conversations[state.activeConversationId] ?? null)
    : null;
  const ctxUsed = (activeConv?.messages ?? []).reduce(
    (sum, m) =>
      sum + (m.tokens ?? Math.max(1, Math.round(m.content.length / 4))),
    0,
  );
  const ctxModelId = (activeModel?.modelId ?? "").toLowerCase();
  const ctxLimit = /gemini|gpt-4\.1/.test(ctxModelId)
    ? 1000000
    : /claude|gpt-5|o[134]/.test(ctxModelId)
      ? 200000
      : 128000;
  const ctxPct = Math.min(100, Math.round((ctxUsed / ctxLimit) * 100));
  const [editMode, setEditModeState] = useState<EditMode>(getEditMode());
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoSource, setRepoSource] = useState<RepoSource>("folder");
  const [modelOpen, setModelOpen] = useState(false);
  const [modelToolOpen, setModelToolOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [access, setAccess] = useState<AccessLevel>(getAccessLevel());
  const [accessOpen, setAccessOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [webEnabled, setWebEnabled] = useState(
    () => window.localStorage.getItem("crabcode.composer.web") === "1",
  );
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionRenameId, setSessionRenameId] = useState<string | null>(null);
  const [sessionMenu, setSessionMenu] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  const sessionRef = useRef<HTMLDivElement>(null);
  const [skills, setSkills] = useState<
    { name: string; description: string; path: string }[]
  >([]);
  const repoRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const modelToolRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const accessRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<
    import("../../domain/types").Attachment[]
  >([]);

  function addFiles(files: FileList | null): void {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toastInfo(`${file.name}: maximum file size is 20 MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (): void => {
        const dataUrl = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeAttachment(id: string): void {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  useEffect(() => {
    window.localStorage.setItem(
      "crabcode.composer.web",
      webEnabled ? "1" : "0",
    );
  }, [webEnabled]);

  useEffect(() => {
    if (!plusOpen) return;
    function onPointerDown(event: PointerEvent): void {
      if (plusRef.current && !plusRef.current.contains(event.target as Node))
        setPlusOpen(false);
    }
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") setPlusOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [plusOpen]);

  interface FileRef {
    name: string;
    path: string;
    kind: "file" | "dir" | "symbol";
    line?: number;
  }
  const [mentions, setMentions] = useState<FileRef[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionHits, setMentionHits] = useState<FileRef[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [browseDir, setBrowseDir] = useState<string | null>(null);

  interface AtSource {
    id: string;
    label: string;
    hint: string;
    icon: typeof GitBranch;
  }
  const AT_SOURCES: AtSource[] = [
    { id: "see", label: "@see", hint: t("chat.at.see"), icon: Globe },
    {
      id: "changes",
      label: "@changes",
      hint: t("chat.at.changes"),
      icon: Diff,
    },
    { id: "git", label: "@git", hint: t("chat.at.git"), icon: GitBranch },
    {
      id: "terminal",
      label: "@terminal",
      hint: t("chat.at.terminal"),
      icon: Terminal,
    },
    { id: "web", label: "@web", hint: t("chat.at.web"), icon: Globe },
    {
      id: "codebase",
      label: "@codebase",
      hint: t("chat.at.codebase"),
      icon: Boxes,
    },
  ];
  const [atSources, setAtSources] = useState<string[]>([]);
  const [atIndex, setAtIndex] = useState(0);

  const atQuery = /(?:^|\s)@(\w*)$/.exec(value)?.[1] ?? null;
  const atHits =
    atQuery === null
      ? []
      : AT_SOURCES.filter((s) => s.id.startsWith(atQuery.toLowerCase()));
  const atOpen = atQuery !== null && atHits.length > 0;

  const mentionQuery = /(?:^|\s)#(\S*)$/.exec(value)?.[1] ?? null;

  useEffect(() => {
    if (mentionQuery === null || !activeRepo?.path) {
      setMentionOpen(false);
      if (mentionQuery === null && browseDir !== null) setBrowseDir(null);
      return;
    }
    setMentionOpen(true);
    setMentionIndex(0);
    const root = activeRepo.path;
    const q = mentionQuery;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (!q) {
        const dir = browseDir ?? root;
        void window.api.fs.readDir(dir).then((entries) => {
          if (cancelled) return;
          const items: FileRef[] = entries.map((e) => ({
            name: e.name,
            path: e.path,
            kind: e.isDir ? "dir" : "file",
          }));
          const dirs = items.filter((f) => f.kind === "dir");
          const plain = items.filter((f) => f.kind === "file");
          const up: FileRef[] =
            browseDir && browseDir !== root
              ? [{ name: "..", path: parentPath(browseDir), kind: "dir" }]
              : [];
          setMentionHits([...up, ...dirs, ...plain]);
        });
        return;
      }

      void Promise.all([
        window.api.fs.search(root, q, 30),
        window.api.fs.searchSymbols(root, q, 12),
      ]).then(([fsHits, symHits]) => {
        if (cancelled) return;
        const files: FileRef[] = fsHits.map((r) => ({
          name: r.name,
          path: r.path,
          kind: r.isDir ? "dir" : "file",
        }));
        const symbols: FileRef[] = symHits.map((s) => ({
          name: s.name,
          path: s.path,
          kind: "symbol",
          line: s.line,
        }));
        const dirs = files.filter((f) => f.kind === "dir");
        const plain = files.filter((f) => f.kind === "file");
        setMentionHits([...dirs, ...plain, ...symbols]);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [mentionQuery, activeRepo?.path, browseDir]);

  function applyMention(ref: FileRef): void {
    setValue((v) => v.replace(/(^|\s)#(\S*)$/, `$1${ref.name} `));
    setMentions((prev) =>
      prev.some((p) => p.path === ref.path && p.name === ref.name)
        ? prev
        : [...prev, ref],
    );
    setMentionOpen(false);
    textareaRef.current?.focus();
  }

  function applyAt(src: { id: string; label: string }): void {
    setValue((v) => v.replace(/(^|\s)@(\w*)$/, `$1${src.label} `));
    setAtSources((prev) => (prev.includes(src.id) ? prev : [...prev, src.id]));
    setAtIndex(0);
    textareaRef.current?.focus();
  }

  function addMentionByPath(path: string, name: string, isDir = false): void {
    setMentions((prev) =>
      prev.some((p) => p.path === path)
        ? prev
        : [...prev, { name, path, kind: isDir ? "dir" : "file" }],
    );
    setValue((v) => {
      const base =
        v === "" || v.endsWith(" ") || v.endsWith("\n") ? v : `${v} `;
      return `${base}${name} `;
    });
  }

  function renderHighlight(text: string): React.ReactNode {
    const head: React.ReactNode[] = [];
    let headKey = 0;
    let working = text;

    const cmdMatch = /^\/(\S+)(?=\s|$)/.exec(text);
    if (cmdMatch) {
      const cmdName = cmdMatch[1].toLowerCase();
      const known =
        SLASH_COMMANDS.some((c) => c.name === cmdName) ||
        skills.some((s) => s.name === cmdName);
      if (known) {
        head.push(
          <span key={`cmd-${headKey++}`} className="ns__cmd">
            {"/" + cmdMatch[1]}
          </span>,
        );
        working = text.slice(cmdMatch[1].length + 1);
      }
    }

    const names = [...new Set(mentions.map((m) => m.name))];
    const atLabels = atSources
      .map((id) => AT_SOURCES.find((s) => s.id === id)?.label)
      .filter((l): l is string => Boolean(l));
    const allTokens = [...names, ...atLabels].sort(
      (a, b) => b.length - a.length,
    );
    if (allTokens.length === 0) return [...head, working + "\n"];
    const escaped = allTokens.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const re = new RegExp(`(?:${escaped.join("|")})`, "g");
    const parts: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(working)) !== null) {
      if (m.index > last) parts.push(working.slice(last, m.index));
      const isAt = m[0].startsWith("@");
      parts.push(
        <span key={key++} className={isAt ? "ns__tag ns__tag--at" : "ns__tag"}>
          {m[0]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    parts.push(working.slice(last) + "\n");
    return [...head, ...parts];
  }

  useEffect(() => {
    return onAppEvent("composer:insert", ({ text }) => {
      setValue((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      textareaRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    return onAppEvent("composer:mention", ({ path, name, isDir }) => {
      addMentionByPath(path, name, isDir);
      textareaRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    setMentions((prev) => {
      const next = prev.filter((m) => value.includes(m.name));
      return next.length === prev.length ? prev : next;
    });
    setAtSources((prev) => {
      const next = prev.filter((id) => {
        const label = AT_SOURCES.find((s) => s.id === id)?.label;
        return label ? value.includes(label) : false;
      });
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    return onAppEvent("composer:image", ({ dataUrl, name }) => {
      setAttachments((prev) => [
        ...prev,
        {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          mimeType: "image/png",
          dataUrl,
        },
      ]);
      textareaRef.current?.focus();
    });
  }, []);

  const slashQuery = /^\/(\S*)$/.exec(value)?.[1] ?? null;
  const builtinMatches =
    slashQuery !== null
      ? SLASH_COMMANDS.filter((c) =>
          c.name.startsWith(slashQuery.toLowerCase()),
        ).map((c) => ({
          name: c.name,
          title: t(c.titleKey),
          icon: c.icon,
          skill: false,
        }))
      : [];
  const skillMatches =
    slashQuery !== null
      ? skills
          .filter((s) => s.name.startsWith(slashQuery.toLowerCase()))
          .map((s) => ({
            name: s.name,
            title: s.description,
            icon: Sparkles,
            skill: true,
          }))
      : [];
  const slashMatches = [...skillMatches, ...builtinMatches];
  const showSlash = slashOpen && slashMatches.length > 0;

  useEffect(() => {
    let cancelled = false;
    const applyProviders = (
      s: Awaited<ReturnType<typeof providersService.get>>,
    ): void => {
      if (cancelled) return;
      const opts: ModelOption[] = s.providers.flatMap((p) =>
        p.models.map((m) => ({
          providerId: p.id,
          providerName: p.name,
          modelId: m.id,
          label: m.label || m.id,
        })),
      );
      setModels(opts);
      const current =
        opts.find(
          (o) => o.providerId === s.activeId && o.modelId === s.activeModel,
        ) ??
        opts.find((o) => o.providerId === s.activeId) ??
        opts[0] ??
        null;
      setActiveModel(current);
    };
    void providersService.get().then(applyProviders);
    const unsubscribe = providersService.subscribe(applyProviders);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const root = activeRepo?.path ?? "";
    let cancelled = false;
    const load = (): void => {
      void window.api.skills.list(root).then((s) => {
        if (!cancelled) setSkills(s);
      });
    };
    load();
    const off = onAppEvent("fs:changed", load);
    return () => {
      cancelled = true;
      off();
    };
  }, [activeRepo?.path]);

  async function pickModel(opt: ModelOption): Promise<void> {
    setActiveModel(opt);
    await providersService.setActive({
      id: opt.providerId,
      model: opt.modelId,
    });
  }

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (repoRef.current && !repoRef.current.contains(e.target as Node))
        setRepoOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node))
        setModelOpen(false);
      if (
        modelToolRef.current &&
        !modelToolRef.current.contains(e.target as Node)
      )
        setModelToolOpen(false);
      if (editRef.current && !editRef.current.contains(e.target as Node))
        setEditOpen(false);
      if (accessRef.current && !accessRef.current.contains(e.target as Node))
        setAccessOpen(false);
      if (sessionRef.current && !sessionRef.current.contains(e.target as Node))
        setSessionOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent): void {
      if (e.key === "Escape") {
        setRepoOpen(false);
        setModelOpen(false);
        setModelToolOpen(false);
        setEditOpen(false);
        setAccessOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setSlashOpen(slashQuery !== null);
    setSlashIndex(0);
  }, [slashQuery]);

  function applySlash(name: string): void {
    const isSkill = skills.some((s) => s.name === name);
    if (!isSkill && ["clear", "delete", "mcp", "project"].includes(name)) {
      setSlashOpen(false);
      setValue("");
      runUiCommand(name, "");
      return;
    }
    setValue(`/${name} `);
    setSlashOpen(false);
    textareaRef.current?.focus();
  }

  function runUiCommand(cmd: string, _rest: string): boolean {
    switch (cmd) {
      case "clear": {
        if (state.activeConversationId) {
          clearConversation(state.activeConversationId);
          toastInfo(t("slash.cleared"));
        }
        return true;
      }
      case "delete": {
        if (state.activeConversationId) {
          deleteConversation(state.activeConversationId);
          toastInfo(t("slash.deleted"));
        }
        return true;
      }
      case "project": {
        setRepoOpen(true);
        return true;
      }
      case "mcp": {
        emitAppEvent("mcp:open", undefined);
        return true;
      }
      default:
        return false;
    }
  }

  function autoGrow(el: HTMLTextAreaElement): void {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    if (textareaRef.current) autoGrow(textareaRef.current);
  }, [value]);

  async function submit(): Promise<void> {
    const text = value.trim();

    const uiCmd = /^\/(\S+)\s*([\s\S]*)$/.exec(text);
    if (uiCmd && !skills.some((s) => s.name === uiCmd[1].toLowerCase())) {
      if (runUiCommand(uiCmd[1].toLowerCase(), uiCmd[2].trim())) {
        setValue("");
        setSlashOpen(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        return;
      }
    }

    const active = mentions.filter((m) => value.includes(m.name));
    const hasAt = atSources.some((id) => {
      const src = AT_SOURCES.find((s) => s.id === id);
      return src && value.includes(src.label);
    });
    if (!text && attachments.length === 0 && active.length === 0 && !hasAt)
      return;

    let display = text;
    let agent = text;
    if (active.length > 0) {
      const refs = active
        .map((m) =>
          m.kind === "symbol" && m.line ? `@${m.path}:${m.line}` : `@${m.path}`,
        )
        .join(" ");
      agent = text ? `${text}\n\n${refs}` : refs;
    }

    const usedAt = atSources.filter((id) => {
      const src = AT_SOURCES.find((s) => s.id === id);
      return src && value.includes(src.label);
    });
    if (usedAt.length > 0) {
      const blocks: string[] = [];
      for (const id of usedAt) {
        if (id === "see") {
          const urlMatch =
            /\bhttps?:\/\/[^\s]+/i.exec(text)?.[0] ??
            /\b(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i.exec(text)?.[0] ??
            /\blocalhost:\d+(?:\/[^\s]*)?/i.exec(text)?.[0];
          blocks.push(
            "# Context: @see (use your eyes — the in-editor browser)\n" +
              (urlMatch
                ? `Open the browser at ${urlMatch} with browser_open, then `
                : "Open the relevant site/localhost in the browser with browser_open, then ") +
              "use browser_read and browser_screenshot to inspect the page. Judge whether it is " +
              "correct — errors, broken or ugly layout, wrong/missing content. If anything is wrong, " +
              "locate the responsible source files, FIX them, then reload the browser to verify. " +
              "Keep iterating until the page is correct, then report what was wrong and what you changed.",
          );
        } else if (id === "changes") {
          const changes = activeRepo
            ? (state.changes[activeRepo.id] ?? [])
            : [];
          if (changes.length) {
            const summary = changes
              .map((c) => `- ${c.path} (+${c.added} −${c.removed})`)
              .join("\n");
            blocks.push(`# Context: uncommitted changes\n${summary}`);
          } else {
            blocks.push(
              "# Context: uncommitted changes\n(no recorded changes)",
            );
          }
        } else if (id === "git") {
          blocks.push(
            "# Context: @git\nInspect recent git history with git_time_travel " +
              '("log" for recent commits, "diff" against HEAD) before answering.',
          );
        } else if (id === "terminal") {
          blocks.push(
            "# Context: @terminal\nIf relevant, run the failing/last command with run_command " +
              "and use its output. Read any error carefully.",
          );
        } else if (id === "web") {
          blocks.push(
            "# Context: @web\nUse web_search and fetch_url to gather current, authoritative " +
              "information before answering.",
          );
        } else if (id === "codebase") {
          blocks.push(
            "# Context: @codebase\nExplore the project (list_dir, read_file, search) to ground " +
              "your answer in the actual code.",
          );
        }
      }
      if (blocks.length) agent = `${agent}\n\n${blocks.join("\n\n")}`;
    }

    const skillMatch = /^\/(\S+)\s*([\s\S]*)$/.exec(text);
    if (skillMatch) {
      const cmd = skillMatch[1].toLowerCase();
      const rest = skillMatch[2].trim();
      const skill = skills.find((s) => s.name === cmd);
      if (skill) {
        agent =
          `Use the "${skill.name}" skill. First read its instructions at ${skill.path} ` +
          `with read_file, then follow them exactly to complete the task.` +
          (rest ? `\n\nTask: ${rest}` : "");
      } else {
        const builtin = expandBuiltinCommand(cmd, rest);
        if (builtin) agent = builtin;
      }
    }

    if (attachments.length > 0) {
      const fileBlocks: string[] = [];
      for (const attachment of attachments) {
        if (!isTextAttachment(attachment)) continue;
        try {
          const raw = await readAttachmentText(attachment);
          const text = raw.slice(0, 80000);
          const truncated =
            raw.length > text.length
              ? "\n[File truncated to 80,000 characters]"
              : "";
          fileBlocks.push(
            `<attached_file name="${attachment.name.replace(/"/g, "&quot;")}">\n${text}${truncated}\n</attached_file>`,
          );
        } catch {}
      }
      if (fileBlocks.length > 0) {
        agent = `${agent}\n\n# Uploaded files\n${fileBlocks.join("\n\n")}`;
      }
    }

    if (webEnabled) {
      agent =
        `${agent}\n\n# Web enabled\n` +
        "Use web_search for up-to-date information and fetch_url to read authoritative sources before answering. " +
        "Prefer official sources and cite links when they help.";
    }

    onSend(
      display,
      attachments.length ? attachments : undefined,
      agent !== display ? agent : undefined,
      webEnabled,
    );
    setValue("");
    setAttachments([]);
    setMentions([]);
    setAtSources([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (atOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtIndex((i) => (i + 1) % atHits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtIndex((i) => (i - 1 + atHits.length) % atHits.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applyAt(atHits[atIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAtSources((s) => s);
        return;
      }
    }
    if (showSlash) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + slashMatches.length) % slashMatches.length,
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applySlash(slashMatches[slashIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (mentionOpen && mentionHits.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionHits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionHits.length) % mentionHits.length,
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const h = mentionHits[mentionIndex];
        if (mentionQuery === "" && h.kind === "dir") {
          setBrowseDir(h.name === ".." ? h.path || null : h.path);
          setMentionIndex(0);
        } else {
          applyMention(h);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="ns">
      {showHeader && (
        <div className="ns__header">
          <span className="ns__label">{t("chat.newSessionIn")}</span>

          <div className="ns__chip-wrap" ref={repoRef}>
            <button
              className="ns__chip"
              type="button"
              onClick={() => setRepoOpen((v) => !v)}
            >
              <Folder size={14} />
              <span>{activeRepo?.name ?? t("chat.noProject")}</span>
              <ChevronDown size={13} />
            </button>
            {repoOpen && (
              <div className="ns__menu" role="menu">
                <div className="ns__menu-tabs" role="tablist">
                  {REPO_SOURCES.map((s) => {
                    const TabIcon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={repoSource === s.id}
                        className={`ns__menu-tab${repoSource === s.id ? " ns__menu-tab--on" : ""}`}
                        onClick={() => setRepoSource(s.id)}
                      >
                        <TabIcon size={13} />
                        <span>{t(s.key)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ns__menu-sep" />

                {repoSource === "folder" && (
                  <>
                    {state.repositories
                      .filter((repo) => (repo.source ?? "folder") === "folder")
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id);
                              setRepoOpen(false);
                            }}
                          >
                            <Folder size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && (
                              <Check size={13} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t("chat.removeProject", {
                              name: repo.name,
                            })}
                            title={t("chat.removeFromList")}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(repo.id);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    <div className="ns__menu-sep" />
                    <button
                      type="button"
                      role="menuitem"
                      className="ns__menu-item"
                      onClick={() => {
                        setRepoOpen(false);
                        void openProject();
                      }}
                    >
                      <Plus size={13} />
                      <span className="ns__menu-label">
                        {t("chat.openFolder")}
                      </span>
                    </button>
                  </>
                )}

                {repoSource === "github" && (
                  <>
                    {state.repositories
                      .filter((repo) => repo.source === "github")
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id);
                              setRepoOpen(false);
                            }}
                          >
                            <Github size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && (
                              <Check size={13} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t("chat.removeProject", {
                              name: repo.name,
                            })}
                            title={t("chat.removeFromList")}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(repo.id);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    <GithubPanel onOpened={() => setRepoOpen(false)} />
                  </>
                )}

                {repoSource === "ssh" && (
                  <>
                    {state.repositories
                      .filter((repo) => repo.source === "ssh")
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id);
                              setRepoOpen(false);
                            }}
                          >
                            <TerminalSquare size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && (
                              <Check size={13} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t("chat.removeProject", {
                              name: repo.name,
                            })}
                            title={t("chat.removeFromList")}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(repo.id);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    <SshPanel onOpened={() => setRepoOpen(false)} />
                  </>
                )}
              </div>
            )}
          </div>

          <span className="ns__label ns__label--build">Let&apos;s Build</span>
        </div>
      )}

      <div
        className="ns__box"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-sreda-file")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData("application/x-sreda-file");
          if (raw) {
            e.preventDefault();
            try {
              const f = JSON.parse(raw) as {
                path: string;
                name: string;
                isDir?: boolean;
              };
              addMentionByPath(f.path, f.name, Boolean(f.isDir));
            } catch {}
          }
        }}
      >
        {attachments.length > 0 && (
          <div className="ns__attachments">
            {attachments.map((a) => (
              <div key={a.id} className="ns__attachment">
                {a.mimeType.startsWith("image/") ? (
                  <img
                    src={a.dataUrl}
                    alt={a.name}
                    className="ns__attachment-img"
                  />
                ) : (
                  <div className="ns__attachment-file" title={a.name}>
                    <img src={fileIcon(a.name)} alt="" />
                    <span>{a.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="ns__attachment-remove"
                  aria-label={t("chat.removeImage")}
                  onClick={() => removeAttachment(a.id)}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showSlash && (
          <div className="ns__slash" role="listbox">
            {slashMatches.map((c, i) => {
              const Icon = c.icon;
              return (
                <button
                  key={`${c.skill ? "skill" : "cmd"}:${c.name}`}
                  type="button"
                  role="option"
                  aria-selected={i === slashIndex}
                  className={`ns__slash-item${i === slashIndex ? " ns__slash-item--active" : ""}`}
                  onMouseEnter={() => setSlashIndex(i)}
                  onClick={() => applySlash(c.name)}
                >
                  <Icon size={14} className="ns__slash-icon" />
                  <span className="ns__slash-name">/{c.name}</span>
                  {c.skill && <span className="ns__slash-badge">skill</span>}
                  <span className="ns__slash-title">{c.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {mentionOpen && mentionHits.length > 0 && (
          <div className="ns__slash" role="listbox">
            {mentionHits.map((h, i) => (
              <button
                key={`${h.kind}:${h.path}:${h.line ?? ""}:${h.name}`}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                className={`ns__slash-item${i === mentionIndex ? " ns__slash-item--active" : ""}`}
                onMouseEnter={() => setMentionIndex(i)}
                onClick={() => {
                  if (mentionQuery === "" && h.kind === "dir") {
                    setBrowseDir(h.name === ".." ? h.path || null : h.path);
                    setMentionIndex(0);
                  } else {
                    applyMention(h);
                  }
                }}
              >
                {h.kind === "dir" ? (
                  <Folder size={14} className="ns__slash-icon" />
                ) : h.kind === "symbol" ? (
                  <Code2 size={14} className="ns__slash-icon" />
                ) : (
                  <img
                    src={fileIcon(h.name)}
                    alt=""
                    className="ns__mention-icon"
                  />
                )}
                <span className="ns__slash-name">{h.name}</span>
                <span className="ns__slash-title">
                  {h.kind === "symbol" && h.line
                    ? `${h.path}:${h.line}`
                    : mentionQuery === "" && h.kind === "dir" && h.name !== ".."
                      ? "открыть папку"
                      : h.path}
                </span>
              </button>
            ))}
          </div>
        )}

        {atOpen && (
          <div className="ns__slash" role="listbox">
            {atHits.map((s, i) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === atIndex}
                  className={`ns__slash-item${i === atIndex ? " ns__slash-item--active" : ""}`}
                  onMouseEnter={() => setAtIndex(i)}
                  onClick={() => applyAt(s)}
                >
                  <Icon size={14} className="ns__slash-icon" />
                  <span className="ns__slash-name">{s.label}</span>
                  <span className="ns__slash-title">{s.hint}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="ns__input-wrap">
          <div className="ns__highlight" aria-hidden="true">
            {renderHighlight(value)}
          </div>
          <textarea
            ref={textareaRef}
            className="ns__input"
            placeholder={t("chat.describe")}
            rows={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={onKeyDown}
            onScroll={(e) => {
              const hl = e.currentTarget
                .previousElementSibling as HTMLElement | null;
              if (hl) hl.scrollTop = e.currentTarget.scrollTop;
            }}
            onPaste={(e) => {
              if (e.clipboardData.files.length > 0) {
                addFiles(e.clipboardData.files);
              }
            }}
            aria-label={t("chat.describeAria")}
          />
        </div>

        <div className="ns__row">
          <div className="ns__plus-wrap" ref={plusRef}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              className={`ns__plus${plusOpen ? " ns__plus--open" : ""}`}
              type="button"
              aria-label="More options"
              title="More options"
              aria-expanded={plusOpen}
              onClick={() => setPlusOpen((open) => !open)}
            >
              <Plus size={16} />
            </button>
            {plusOpen && (
              <div className="ns__menu ns__menu--up ns__plus-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="ns__access-option ns__plus-menu-item"
                  onClick={() => setWebEnabled((enabled) => !enabled)}
                >
                  <Globe size={14} />
                  <span>Web</span>
                  <span
                    className={`ns__web-switch${webEnabled ? " ns__web-switch--on" : ""}`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="ns__access-option ns__plus-menu-item"
                  onClick={() => {
                    setPlusOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <Paperclip size={14} />
                  <span>Upload Files</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="ns__plus"
            type="button"
            aria-label={t("chat.mentionFile")}
            title={t("chat.mentionFile")}
            onClick={() => {
              setValue((v) => {
                const base =
                  v === "" || v.endsWith(" ") || v.endsWith("\n") ? v : `${v} `;
                return `${base}#`;
              });
              textareaRef.current?.focus();
            }}
          >
            <Hash size={15} />
          </button>

          <div className="ns__chip-wrap" ref={modelToolRef}>
            <button
              className="ns__chip ns__chip--ghost"
              type="button"
              onClick={() => setModelToolOpen((v) => !v)}
              disabled={models.length === 0}
            >
              <span>
                {activeModel
                  ? activeModel.label.length > 6
                    ? `${activeModel.label.slice(0, 6)}…`
                    : activeModel.label
                  : t("chat.noModels")}
              </span>
            </button>
            <span
              className="ns__ctxring"
              title={`${t("chat.context")} ${ctxPct}%`}
            >
              <svg viewBox="0 0 16 16" width="15" height="15">
                <circle className="ns__ctxring-track" cx="8" cy="8" r="6.5" />
                <circle
                  className="ns__ctxring-fill"
                  cx="8"
                  cy="8"
                  r="6.5"
                  strokeDasharray={`${((ctxPct / 100) * 40.8).toFixed(1)} 40.8`}
                />
              </svg>
            </span>
            {modelToolOpen && models.length > 0 && (
              <div className="ns__menu ns__menu--up ns__model-menu" role="menu">
                {models.map((m) => (
                  <button
                    key={`${m.providerId}:${m.modelId}`}
                    type="button"
                    role="menuitem"
                    className="ns__menu-item"
                    onClick={() => {
                      void pickModel(m);
                      setModelToolOpen(false);
                    }}
                  >
                    <span className="ns__menu-label">{m.label}</span>
                    {activeModel?.providerId === m.providerId &&
                      activeModel?.modelId === m.modelId && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ns__spacer" />

          <div className="ns__chip-wrap" ref={accessRef}>
            <button
              className={`ns__access${access === "high" ? " ns__access--high" : ""}`}
              type="button"
              onClick={() => setAccessOpen((v) => !v)}
              title={t("access.title")}
            >
              {access === "high" ? (
                <MonitorCog size={13} />
              ) : (
                <FolderLock size={13} />
              )}
              <span>
                {t(access === "high" ? "access.high" : "access.normal")}
              </span>
              <ChevronDown
                size={12}
                className={`ns__chevron${accessOpen ? " ns__chevron--open" : ""}`}
              />
            </button>
            {accessOpen && (
              <div
                className="ns__menu ns__menu--up ns__access-menu"
                role="menu"
              >
                {ACCESS_LEVELS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="menuitem"
                      className="ns__access-option"
                      onClick={() => {
                        setAccess(a.id);
                        setAccessLevel(a.id);
                        setAccessOpen(false);
                      }}
                    >
                      <Icon size={15} className="ns__access-icon" />
                      <span className="ns__access-text">
                        <span className="ns__access-name">
                          {t(a.key)}
                          {a.id === access && <Check size={13} />}
                        </span>
                        <span className="ns__access-desc">{t(a.descKey)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {streaming ? (
            <button
              className="ns__send ns__send--stop"
              type="button"
              aria-label={t("chat.stop")}
              title={t("chat.stop")}
              onClick={() => onStop?.()}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              className="ns__send"
              type="button"
              aria-label={t("chat.send")}
              disabled={!(value.trim() || attachments.length > 0)}
              onClick={() => void submit()}
            >
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="ns__bottom-row">
        <div className="ns__chip-wrap ns__edit-wrap" ref={editRef}>
          <button
            className="ns__edit"
            type="button"
            onClick={() => setEditOpen((v) => !v)}
          >
            <Pencil size={13} />
            <span>
              {t(
                EDIT_MODES.find((m) => m.id === editMode)?.key ??
                  "chat.edit.auto",
              )}
            </span>
            <ChevronDown
              size={13}
              className={`ns__chevron${editOpen ? " ns__chevron--open" : ""}`}
            />
          </button>
          {editOpen && (
            <div
              className={`ns__menu${showHeader ? "" : " ns__menu--up"}`}
              role="menu"
            >
              {EDIT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitem"
                  className="ns__menu-item"
                  onClick={() => {
                    setEditModeState(mode.id as EditMode);
                    setEditMode(mode.id as EditMode);
                    setEditOpen(false);
                  }}
                >
                  <span className="ns__menu-label">{t(mode.key)}</span>
                  {mode.id === editMode && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ns__chip-wrap" ref={sessionRef}>
          <button
            className="ns__session-btn"
            type="button"
            aria-label={t("sessions.title")}
            title={t("sessions.title")}
            onClick={() => setSessionOpen((v) => !v)}
          >
            <SquarePen size={15} />
          </button>
          {sessionOpen && (
            <div
              className="ns__menu ns__menu--up ns__menu--right ns__session-menu"
              role="menu"
            >
              <button
                type="button"
                className="ns__menu-item ns__session-new"
                onClick={() => {
                  createConversation(state.activeRepositoryId);
                  setSessionOpen(false);
                }}
              >
                <Plus size={13} />
                <span className="ns__menu-label">{t("sessions.new")}</span>
              </button>
              <div className="ns__menu-sep" />
              {sessionList.length === 0 ? (
                <div className="ns__session-empty">
                  {t("sessions.emptyNoSessions")}
                </div>
              ) : (
                sessionList.map((conv) =>
                  sessionRenameId === conv.id ? (
                    <input
                      key={conv.id}
                      className="ns__session-rename"
                      defaultValue={conv.title}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) renameConversation(conv.id, v);
                        setSessionRenameId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) renameConversation(conv.id, v);
                          setSessionRenameId(null);
                        }
                        if (e.key === "Escape") setSessionRenameId(null);
                      }}
                    />
                  ) : (
                    <button
                      key={conv.id}
                      type="button"
                      role="menuitem"
                      className="ns__menu-item ns__session-item"
                      onClick={() => {
                        selectConversation(conv.id);
                        setSessionOpen(false);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSessionMenu({
                          x: e.clientX,
                          y: e.clientY,
                          id: conv.id,
                        });
                      }}
                    >
                      <span className="ns__menu-label">{conv.title}</span>
                      {conv.id === state.activeConversationId && (
                        <Check size={13} />
                      )}
                    </button>
                  ),
                )
              )}
            </div>
          )}
        </div>
      </div>

      {sessionMenu && (
        <ContextMenu
          x={sessionMenu.x}
          y={sessionMenu.y}
          variant="plain"
          className="ctx-menu--narrow"
          items={[
            {
              label: t("sessions.rename"),
              onClick: () => {
                setSessionRenameId(sessionMenu.id);
              },
            },
            { separator: true },
            {
              label: t("sessions.delete"),
              danger: true,
              onClick: () => {
                deleteConversation(sessionMenu.id);
              },
            },
          ]}
          onClose={() => setSessionMenu(null)}
        />
      )}
    </div>
  );
}
