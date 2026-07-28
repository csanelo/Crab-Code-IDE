import { memo, useState } from "react";
import {
  AlertCircle,
  Sparkles,
  Clock,
  Play,
  Copy,
  Check as CheckIcon,
  ChevronRight,
  Pencil,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Trash2,
  Search as SearchIcon,
  Terminal as TerminalIcon,
  Globe,
  Link2,
  ArrowRightLeft,
  CopyPlus,
  BookOpen,
  History,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ChatMessage, ToolCall, FileChange } from "../../domain/types";
import { useT } from "../../i18n";
import type { TKey } from "../../i18n/translations";
import { Markdown } from "./Markdown";
import { highlightLine } from "../../lib/highlight";
import { fileIcon } from "../files/iconMap";
import { emit as emitAppEvent } from "../../lib/appEvents";
import { copyText } from "../../lib/clipboard";
import { useApp } from "../../state/AppContext";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function renderUserContent(content: string): JSX.Element {
  const slash = /^(\/[a-z0-9_-]+)(\b[\s\S]*)?$/i.exec(content);
  if (slash) {
    return (
      <>
        <span className="message__slash">{slash[1]}</span>
        {slash[2] ? highlightMentions(slash[2]) : null}
      </>
    );
  }
  return <>{highlightMentions(content)}</>;
}

function highlightMentions(text: string): React.ReactNode[] {
  const re = /(^|\s)([\w./\\-]+\.[A-Za-z0-9]{1,8})(?=$|\s|[.,;:!?])/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={key++} className="message__mention">
        {m[2]}
      </span>,
    );
    last = start + m[2].length;
  }
  parts.push(text.slice(last));
  return parts;
}

const TOOL_LABEL: Record<string, TKey> = {
  read_file: "tool.read_file",
  write_file: "tool.write_file",
  edit_file: "tool.edit_file",
  list_dir: "tool.list_dir",
  create_dir: "tool.create_dir",
  delete_path: "tool.delete_path",
  search: "tool.search",
  run_command: "tool.run_command",
  web_search: "tool.web_search",
  fetch_url: "tool.fetch_url",
  open_path: "tool.open_path",
  move_path: "tool.move_path",
  copy_path: "tool.copy_path",
  read_memory: "tool.read_memory",
  write_memory: "tool.write_memory",
  git_time_travel: "tool.git_time_travel",
};

const TOOL_VERB: Record<string, string> = {
  read_file: "Read",
  write_file: "Created",
  edit_file: "Edited",
  list_dir: "Listed",
  create_dir: "Created",
  delete_path: "Deleted",
  search: "Searched",
  run_command: "Ran",
  web_search: "Searched web",
  fetch_url: "Fetched",
  open_path: "Opened",
  move_path: "Moved",
  copy_path: "Copied",
  read_memory: "Read memory",
  write_memory: "Saved memory",
  git_time_travel: "Git history",
  browser_open: "Opened",
  browser_read: "Read page",
  browser_screenshot: "Looked at",
  add_skill: "Added skill",
  add_mcp_server: "Added MCP",
  list_mcp_servers: "Listed MCP",
  github_connect: "GitHub",
  github_status: "GitHub",
  github_commit: "Committed",
};

const TOOL_ICON: Record<string, LucideIcon> = {
  read_file: FileText,
  write_file: FilePlus2,
  edit_file: Pencil,
  list_dir: FolderOpen,
  create_dir: FolderPlus,
  delete_path: Trash2,
  search: SearchIcon,
  run_command: TerminalIcon,
  web_search: Globe,
  fetch_url: Link2,
  open_path: FolderOpen,
  move_path: ArrowRightLeft,
  copy_path: CopyPlus,
  read_memory: BookOpen,
  write_memory: BookOpen,
  git_time_travel: History,
  browser_open: Globe,
  browser_read: Globe,
  browser_screenshot: Globe,
};

const FILE_TOOLS = new Set(["read_file", "write_file", "edit_file"]);

function EditGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20h4L18.5 9.5l-4-4L4 16v4Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M13.5 6.5l4 4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
  );
}
function CreateGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 3.5h-3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9l-6-5.5Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M14 3.5V9h6"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M4 11v6M1 14h6"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
  );
}
function ReadGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M14 3v5h5"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M8.5 13h7M8.5 16.5h4.5"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
  );
}
function ListGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4h13a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V4Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path d="M4 9h15" stroke="currentColor" stroke-width="1.7" />
    </svg>
  );
}
function DeleteGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
function SearchGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path
        d="m20 20-3.6-3.6"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
  );
}
function RunGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4.5"
        width="18"
        height="15"
        rx="2.5"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path
        d="M7 9.5l3 2.5-3 2.5M12.5 15h4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
function GlobeGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path
        d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"
        stroke="currentColor"
        stroke-width="1.7"
      />
    </svg>
  );
}
function GitGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="6.5"
        cy="6"
        r="2.2"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <circle
        cx="6.5"
        cy="18"
        r="2.2"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <circle
        cx="17.5"
        cy="9"
        r="2.2"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path
        d="M6.5 8.2v7.6M17.5 11.2c0 3-2.5 3.8-5 3.8"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
  );
}
function FolderGlyph(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
    </svg>
  );
}

const LEAD_GLYPH: Record<string, () => JSX.Element> = {
  edit_file: EditGlyph,
  write_file: CreateGlyph,
  create_dir: FolderGlyph,
  read_file: ReadGlyph,
  read_memory: ReadGlyph,
  write_memory: EditGlyph,
  list_dir: ListGlyph,
  delete_path: DeleteGlyph,
  search: SearchGlyph,
  web_search: SearchGlyph,
  run_command: RunGlyph,
  fetch_url: GlobeGlyph,
  browser_open: GlobeGlyph,
  browser_read: GlobeGlyph,
  browser_screenshot: GlobeGlyph,
  open_path: FolderGlyph,
  move_path: FolderGlyph,
  copy_path: FolderGlyph,
  git_time_travel: GitGlyph,
};

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

function toolTarget(tool: ToolCall): string {
  const i = tool.input ?? {};
  if (typeof i.path === "string") return i.path;
  if (typeof i.target === "string") return i.target;
  if (typeof i.from === "string" && typeof i.to === "string")
    return `${i.from} → ${i.to}`;
  if (typeof i.command === "string") return i.command;
  if (typeof i.query === "string") return i.query;
  if (typeof i.url === "string") return i.url;
  return "";
}

function ToolRow({
  tool,
}: {
  tool: ToolCall;
  repoPath: string | null;
}): JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (tool.command) {
    return <CommandCard command={tool.command} />;
  }

  const label = TOOL_LABEL[tool.name] ? t(TOOL_LABEL[tool.name]) : tool.name;
  const verb = TOOL_VERB[tool.name] ?? label;
  const target = toolTarget(tool);
  const isFile =
    FILE_TOOLS.has(tool.name) && target && /\.[A-Za-z0-9]{1,8}$/.test(target);
  const VerbIcon = TOOL_ICON[tool.name] ?? FileText;
  const LeadGlyph = LEAD_GLYPH[tool.name];
  const meta = tool.meta;
  const expandable = Boolean(meta?.diff || tool.result);

  return (
    <div className={`tool${open ? " tool--open" : ""}`}>
      <button
        type="button"
        className="tool__head"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tool__verb">{verb}</span>
        {target && (
          <span className="tool__file">
            <span className="tool__name">
              {isFile ? baseName(target) : target}
            </span>
            {meta && (
              <span className="tool__counts">
                <span className="tool__added">+{meta.added}</span>
                <span className="tool__removed">−{meta.removed}</span>
              </span>
            )}
          </span>
        )}
        {expandable && (
          <ChevronRight
            size={13}
            className={`tool__chevron${open ? " tool__chevron--open" : ""}`}
          />
        )}
      </button>
      {open && meta?.diff ? (
        <DiffView diff={meta.diff} />
      ) : open && tool.result ? (
        <pre className="tool__result">{tool.result}</pre>
      ) : null}
    </div>
  );
}

function CommandCard({ command }: { command: string }): JSX.Element {
  const t = useT();
  const [copied, setCopied] = useState(false);

  function copy(): void {
    copyText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function run(): void {
    emitAppEvent("terminal:run", { command });
  }

  return (
    <div className="cmd-card">
      <div className="cmd-card__head">
        <svg
          className="cmd-card__icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3" />
          <line x1="13" y1="15" x2="17" y2="15" />
        </svg>
        <span className="cmd-card__label">{t("tool.command_label")}</span>
        <div className="cmd-card__actions">
          <button
            type="button"
            className="cmd-card__btn"
            onClick={copy}
            aria-label={t("tool.copy")}
            title={t("tool.copy")}
          >
            {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            className="cmd-card__btn cmd-card__btn--run"
            onClick={run}
            aria-label={t("tool.run")}
            title={t("tool.run")}
          >
            <Play size={13} />
            <span>{t("tool.run")}</span>
          </button>
        </div>
      </div>
      <pre className="cmd-card__code">{command}</pre>
    </div>
  );
}

function DiffView({ diff }: { diff: string }): JSX.Element {
  const lines = diff.split("\n");
  let oldNo = 0;
  let newNo = 0;
  return (
    <div className="diff">
      {lines.map((line, i) => {
        const kind = line[0] === "+" ? "add" : line[0] === "-" ? "del" : "ctx";
        let no = "";
        if (kind === "add") {
          newNo++;
          no = String(newNo);
        } else if (kind === "del") {
          oldNo++;
          no = String(oldNo);
        } else {
          oldNo++;
          newNo++;
          no = String(newNo);
        }
        return (
          <div key={i} className={`diff__line diff__line--${kind}`}>
            <span className="diff__lineno">{no}</span>
            <span className="diff__sign">
              {kind === "add" ? "+" : kind === "del" ? "−" : " "}
            </span>
            <span className="diff__text">
              {highlightLine(line.slice(1), `d${i}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TaskChangesCard({
  message,
}: {
  message: ChatMessage;
}): JSX.Element | null {
  const t = useT();
  const { state, setTaskChangesState, removeChange } = useApp();
  const [open, setOpen] = useState(false);
  const [localTaskState, setLocalTaskState] = useState<
    "pending" | "accepted" | "rejected"
  >(message.taskChangesState ?? "pending");

  const conversationId = state.activeConversationId;
  const activeRepo = state.repositories.find(
    (r) => r.id === state.activeRepositoryId,
  );
  const repoPath = activeRepo?.path ?? null;
  const repoId = activeRepo?.id ?? null;

  const fileChangesMap = new Map<string, FileChange>();
  if (message.toolCalls) {
    for (const tool of message.toolCalls) {
      if (tool.status === "done" && tool.mutated && tool.meta?.path) {
        const meta = tool.meta;
        const existing = fileChangesMap.get(meta.path);
        if (existing) {
          fileChangesMap.set(meta.path, {
            ...existing,
            added: existing.added + meta.added,
            removed: existing.removed + meta.removed,
            diff: meta.diff || existing.diff,
          });
        } else {
          fileChangesMap.set(meta.path, {
            path: meta.path,
            added: meta.added,
            removed: meta.removed,
            diff: meta.diff,
            updatedAt: Date.now(),
            before: meta.before ?? "",
            existed: meta.existed ?? false,
          });
        }
      }
    }
  }

  const changesList = Array.from(fileChangesMap.values());
  if (changesList.length === 0) return null;

  const totalAdded = changesList.reduce((s, c) => s + c.added, 0);
  const totalRemoved = changesList.reduce((s, c) => s + c.removed, 0);
  const taskState = localTaskState;

  function getAbsPath(p: string): string {
    if (!repoPath) return p;
    if (/^([a-zA-Z]:[\\/]|\/)/.test(p)) return p;
    const sep = repoPath.includes("\\") ? "\\" : "/";
    return `${repoPath}${sep}${p.replace(/[\\/]/g, sep)}`;
  }

  const handleAccept = () => {
    setLocalTaskState("accepted");
    if (conversationId) {
      setTaskChangesState(conversationId, message.id, "accepted");
    }
  };

  const handleReject = async () => {
    setLocalTaskState("rejected");
    if (conversationId) {
      setTaskChangesState(conversationId, message.id, "rejected");
    }
    for (const c of changesList) {
      const absPath = getAbsPath(c.path);
      await window.api.fs.revert({
        path: absPath,
        before: c.before,
        existed: c.existed,
      });
      emitAppEvent("editor:reload", { path: absPath });
      if (repoId) {
        removeChange(repoId, c.path);
      }
    }
    emitAppEvent("fs:changed", undefined);
  };

  return (
    <div className={`task-changes task-changes--${taskState}`}>
      <div className="task-changes__head">
        <div
          className="task-changes__main"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="task-changes__title">
            {t("task.changesTitle", { n: changesList.length })}
          </span>
          <span className="task-changes__counts">
            {totalAdded > 0 && <span className="changes__added">+{totalAdded}</span>}
            {totalRemoved > 0 && <span className="changes__removed">−{totalRemoved}</span>}
          </span>
          <ChevronRight
            size={13}
            className={`task-changes__chevron${open ? " task-changes__chevron--open" : ""}`}
          />
        </div>

        <div className="task-changes__actions">
          {taskState === "pending" ? (
            <>
              <button
                type="button"
                className="task-changes__btn task-changes__btn--accept"
                onClick={handleAccept}
                title={t("task.accept")}
              >
                <CheckIcon size={13} />
                <span>{t("task.accept")}</span>
              </button>
              <button
                type="button"
                className="task-changes__btn task-changes__btn--reject"
                onClick={handleReject}
                title={t("task.reject")}
              >
                <Undo2 size={13} />
                <span>{t("task.reject")}</span>
              </button>
            </>
          ) : taskState === "accepted" ? (
            <span className="task-changes__badge task-changes__badge--accepted">
              <CheckIcon size={12} />
              <span>{t("task.accepted")}</span>
            </span>
          ) : (
            <span className="task-changes__badge task-changes__badge--rejected">
              <Undo2 size={12} />
              <span>{t("task.rejected")}</span>
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="task-changes__list">
          {changesList.map((c) => {
            const name = c.path.split(/[\\/]/).pop() ?? c.path;
            const absPath = getAbsPath(c.path);
            return (
              <div
                key={c.path}
                className="task-changes__file"
                onClick={() =>
                  emitAppEvent("editor:openDiff", {
                    path: absPath,
                    before: c.before,
                  })
                }
                title="Открыть diff в редакторе"
              >
                <img
                  className="task-changes__fileicon"
                  src={fileIcon(name)}
                  alt=""
                  aria-hidden="true"
                />
                <span className="task-changes__filepath" title={c.path}>
                  {c.path}
                </span>
                <span className="task-changes__filecounts">
                  {c.added > 0 && <span className="changes__added">+{c.added}</span>}
                  {c.removed > 0 && <span className="changes__removed">−{c.removed}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageItemBase({ message }: { message: ChatMessage }): JSX.Element {
  const t = useT();
  const { state } = useApp();
  const repoPath =
    state.repositories.find((r) => r.id === state.activeRepositoryId)?.path ??
    null;
  const isUser = message.role === "user";
  const hasTools = !isUser && message.toolCalls && message.toolCalls.length > 0;
  const showMeta =
    !isUser &&
    !message.streaming &&
    !message.error &&
    (message.tokens !== undefined || message.durationMs !== undefined);

  return (
    <div className={`message message--${message.role}`}>
      {isUser ? (
        <div className="message__user">
          {message.attachments && message.attachments.length > 0 && (
            <div className="message__images">
              {message.attachments.map((attachment) =>
                attachment.mimeType.startsWith("image/") ? (
                  <img
                    key={attachment.id}
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="message__image"
                  />
                ) : (
                  <div
                    key={attachment.id}
                    className="message__file"
                    title={attachment.name}
                  >
                    <img src={fileIcon(attachment.name)} alt="" />
                    <span>{attachment.name}</span>
                  </div>
                ),
              )}
            </div>
          )}
          {message.content && (
            <div className="message__user-bubble">
              {renderUserContent(message.content)}
            </div>
          )}
        </div>
      ) : (
        <div className="message__assistant">
          {message.error ? (
            <div className="message__error" role="alert">
              <AlertCircle size={15} />
              <span>{message.error}</span>
            </div>
          ) : message.segments && message.segments.length > 0 ? (
            message.segments.map((seg, i) =>
              seg.kind === "text" ? (
                seg.text.trim() ? (
                  <div className="message__text" key={i}>
                    <Markdown text={seg.text} />
                  </div>
                ) : null
              ) : (
                <div className="message__tools" key={i}>
                  <ToolRow tool={seg.tool} repoPath={repoPath} />
                </div>
              ),
            )
          ) : (
            <>
              {message.content && (
                <div
                  className={`message__text${message.streaming ? " message__text--reveal" : ""}`}
                  key={
                    message.streaming
                      ? `stream-${message.content.length}`
                      : "static"
                  }
                >
                  <Markdown text={message.content} />
                </div>
              )}
              {hasTools && (
                <div className="message__tools">
                  {message.toolCalls!.map((tc, i) => (
                    <ToolRow key={i} tool={tc} repoPath={repoPath} />
                  ))}
                </div>
              )}
            </>
          )}

          <TaskChangesCard message={message} />

          {showMeta && (
            <div className="message__meta" aria-hidden="true">
              {message.durationMs !== undefined && (
                <span className="message__meta-item">
                  <Clock size={11} />
                  {formatDuration(message.durationMs)}
                </span>
              )}
              {message.tokens !== undefined && (
                <span className="message__meta-item">
                  <Sparkles size={11} />
                  {t("chat.tokens", { n: message.tokens.toLocaleString() })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemBase);
