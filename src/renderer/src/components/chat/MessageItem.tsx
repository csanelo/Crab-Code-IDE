import { memo, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Sparkles,
  Clock,
  Copy,
  Check as CheckIcon,
  ChevronRight,
  Pencil,
  CircleAlert,
  Loader2,
} from "lucide-react";
import type { ChatMessage, MessageSegment, ToolCall } from "../../domain/types";
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

const FILE_TOOLS = new Set(["read_file", "write_file", "edit_file"]);

type GlyphProps = { size?: number; className?: string };

function ToolGlyph({ name, size = 17, className }: GlyphProps & { name: string }): JSX.Element {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const glyph = (() => {
    switch (name) {
      case "read_file":
      case "read_memory":
        return <><path d="M3.5 15.8V6.7a2 2 0 0 1 2-2h4l2 2h6.8a2 2 0 0 1 2 2v3.1"/><path d="M11.5 16.2s2-3.2 5.2-3.2 5.2 3.2 5.2 3.2-2 3.2-5.2 3.2-5.2-3.2-5.2-3.2Z"/><circle cx="16.7" cy="16.2" r="1.45"/></>;
      case "write_file":
        return <><path d="M6 3.5h7l4 4v4.8M13 3.5v4h4M12 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><circle cx="17" cy="17" r="4.5"/><path d="M17 14.8v4.4M14.8 17h4.4"/></>;
      case "edit_file":
      case "write_memory":
        return <><path d="M3.5 15.8V6.7a2 2 0 0 1 2-2h4l2 2h6.8a2 2 0 0 1 2 2v2.5"/><path d="m11.5 20 .8-3.4 6.4-6.4a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4-3.4.8Z"/><path d="m17.7 11.2 2.1 2.1"/></>;
      case "list_dir":
      case "create_dir":
        return <><path d="M3.5 18.3V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1.5"/><path d="M4 19h14.5a2 2 0 0 0 1.9-1.4l1.5-5a1.6 1.6 0 0 0-1.5-2.1H8a2 2 0 0 0-1.9 1.3L4 19Z"/></>;
      case "delete_path":
        return <><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12"/><path d="M10 11v5.5M14 11v5.5"/></>;
      case "search":
        return <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 4.7 4.7M8 10.5h5"/></>;
      case "web_search":
        return <><circle cx="11" cy="11" r="7.5"/><path d="M3.5 11h15M11 3.5c2.2 2.4 2.2 12.6 0 15M11 3.5c-2.2 2.4-2.2 12.6 0 15M16.7 16.7 21 21"/></>;
      case "run_command":
        return <><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m7 9 3 3-3 3M13 15h4"/></>;
      case "fetch_url":
        return <><path d="M9.5 14.5 14.5 9M7 16.8l-1.2 1.2a3.4 3.4 0 0 1-4.8-4.8l4-4A3.4 3.4 0 0 1 9.8 9M17 7.2 18.2 6A3.4 3.4 0 1 1 23 10.8l-4 4a3.4 3.4 0 0 1-4.8 0"/></>;
      case "browser_screenshot":
        return <><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="12" r="3"/><path d="M7 5 8.2 3.5h3"/></>;
      case "browser_read":
        return <><path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h5v17H6a2.5 2.5 0 0 0-2.5 2V5.5ZM20.5 5.5A2.5 2.5 0 0 0 18 3h-5v17h5a2.5 2.5 0 0 1 2.5 2V5.5Z"/></>;
      case "browser_open":
        return <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"/></>;
      case "open_path":
        return <><path d="M3.5 18.3V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1.5"/><path d="M4 19h14.5a2 2 0 0 0 1.9-1.4l1.5-5a1.6 1.6 0 0 0-1.5-2.1H8a2 2 0 0 0-1.9 1.3L4 19Z"/></>;
      case "move_path":
        return <><path d="M8 5h11M16 2l3 3-3 3M16 19H5M8 16l-3 3 3 3"/></>;
      case "copy_path":
        return <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>;
      case "git_time_travel":
        return <><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 3-2.5 4-6 4"/></>;
      case "add_skill":
        return <><path d="m12 2 1.4 5.1L18 5l-2.1 4.6L21 11l-5.1 1.4L18 17l-4.6-2.1L12 20l-1.4-5.1L6 17l2.1-4.6L3 11l5.1-1.4L6 5l4.6 2.1L12 2Z"/><circle cx="12" cy="11" r="2"/></>;
      case "add_mcp_server":
      case "list_mcp_servers":
        return <><rect x="4" y="3" width="16" height="6" rx="2"/><rect x="4" y="15" width="16" height="6" rx="2"/><path d="M8 9v6M16 9v6M8 6h.01M8 18h.01"/></>;
      case "github_connect":
      case "github_status":
      case "github_commit":
        return <><path d="M8 18c-4.5 1.4-4.5-2.3-6-2.8M14 21v-3.5c0-1 .1-1.7-.5-2.4 3.1-.4 6.5-1.5 6.5-7A5.5 5.5 0 0 0 18.5 4 5 5 0 0 0 18.4.5S17.2.1 14 2a14 14 0 0 0-6 0C4.8.1 3.6.5 3.6.5A5 5 0 0 0 3.5 4 5.5 5.5 0 0 0 2 8.1c0 5.5 3.4 6.6 6.5 7-.6.7-.6 1.3-.5 2.4V21"/></>;
      default:
        return <><path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M14 3.5v4h4"/></>;
    }
  })();
  return <svg viewBox="0 0 24 24" width={size} height={size} className={className} shapeRendering="geometricPrecision" focusable="false" aria-hidden="true" {...common}>{glyph}</svg>;
}

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

  const displayName =
    tool.name === "write_file" && tool.meta?.existed ? "edit_file" : tool.name;
  const label = TOOL_LABEL[displayName] ? t(TOOL_LABEL[displayName]) : displayName;
  const verb = TOOL_VERB[displayName] ?? label;
  const target = toolTarget(tool);
  const isFile =
    FILE_TOOLS.has(tool.name) && target && /\.[A-Za-z0-9]{1,8}$/.test(target);
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
        <span className="tool__verbicon" aria-hidden="true">
          <ToolGlyph name={displayName} size={17} />
        </span>
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
        {tool.status === "running" ? (
          <Loader2 size={14} className="tool__spin" aria-label="Running" />
        ) : tool.result?.startsWith("Error:") ? (
          <CircleAlert size={14} className="tool__error" aria-label="Error" />
        ) : null}
      </button>
      <div className="tool__details" aria-hidden={!open}>
        <div className="tool__details-inner">
          {meta?.diff ? (
            <DiffView diff={meta.diff} />
          ) : tool.result ? (
            <pre className="tool__result">{tool.result}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TaskGroup({ tools }: { tools: ToolCall[] }): JSX.Element {
  const running = tools.some((tool) => tool.status === "running");
  const hasError = tools.some((tool) => tool.result?.startsWith("Error:"));
  const [open, setOpen] = useState(running || hasError);
  const userToggled = useRef(false);

  useEffect(() => {
    if (running || hasError) setOpen(true);
    else if (!userToggled.current) setOpen(false);
  }, [running, hasError]);

  const title = hasError
    ? "Agent task needs attention"
    : tools.some((tool) => tool.mutated)
      ? "Updated project"
      : "Reviewed project";

  return (
    <section
      className={`task-group${open ? " task-group--open" : ""}${running ? " task-group--running" : ""}`}
    >
      <button
        type="button"
        className="task-group__head"
        aria-expanded={open}
        onClick={() => {
          userToggled.current = true;
          setOpen((value) => !value);
        }}
      >
        <ChevronRight
          size={16}
          className={`task-group__chevron${open ? " task-group__chevron--open" : ""}`}
        />
        <span className="task-group__title">{title}</span>
        {running ? (
          <Loader2
            size={14}
            className="task-group__spinner"
            aria-label="Running"
          />
        ) : null}
        {hasError ? (
          <CircleAlert
            size={14}
            className="task-group__error"
            aria-label="Error"
          />
        ) : null}
      </button>
      <div className="task-group__collapse" aria-hidden={!open}>
        <div className="task-group__body">
          {tools.map((tool) => (
            <div className="task-group__action" key={tool.id}>
              <span className="task-group__node" aria-hidden="true" />
              <ToolRow tool={tool} repoPath={null} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MessageSegments({
  segments,
}: {
  segments: MessageSegment[];
}): JSX.Element {
  const result: JSX.Element[] = [];
  let tools: ToolCall[] = [];
  const flush = (): void => {
    if (!tools.length) return;
    const actionTools = tools.filter((tool) => !tool.command);
    const commandTools = tools.filter((tool) => Boolean(tool.command));
    if (actionTools.length)
      result.push(
        <TaskGroup key={`task-${actionTools[0].id}`} tools={actionTools} />,
      );
    commandTools.forEach((tool) => {
      result.push(
        <CommandCard key={`cmd-${tool.id}`} command={tool.command as string} />,
      );
    });
    tools = [];
  };
  segments.forEach((segment, index) => {
    if (segment.kind === "tool") {
      tools.push(segment.tool);
      return;
    }
    flush();
    if (segment.text.trim())
      result.push(
        <div className="message__text" key={`text-${index}`}>
          <Markdown text={segment.text} />
        </div>,
      );
  });
  flush();
  return <>{result}</>;
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
            data-tip={t("tool.copy")}
          >
            {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            className="cmd-card__btn cmd-card__btn--run"
            onClick={run}
            aria-label={t("tool.run")}
            data-tip={t("tool.run")}
          >
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
                    data-tip={attachment.name}
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
            <MessageSegments segments={message.segments} />
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
