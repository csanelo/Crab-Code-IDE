import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import { on as onAppEvent } from "../../lib/appEvents";
import { asset } from "../../lib/asset";
import { MessageItem } from "./MessageItem";
import { NewSession } from "../center/NewSession";
import { SessionTabs } from "./SessionTabs";
import { McpModal } from "../mcp/McpModal";
import "./ChatPanel.css";
import { rememberTerminalExecution, terminalKnowledgeContext } from "../../lib/terminalKnowledge";

export function ChatPanel({
  centerEmpty = false,
  hideTabs = false,
  suspended = false,
}: { centerEmpty?: boolean; hideTabs?: boolean; suspended?: boolean } = {}): JSX.Element {
  const { activeConversation, sendMessage, continueAgent, stopMessage } = useApp();
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [messageWindow, setMessageWindow] = useState({
    conversationId: activeConversation?.id ?? null,
    count: 60,
  });
  const pinnedToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return onAppEvent("mcp:open", () => setMcpOpen(true));
  }, []);

  const continueAgentRef = useRef(continueAgent);
  continueAgentRef.current = continueAgent;

  useEffect(() => {
    const seen = new Set<string>();
    return onAppEvent("terminal:result", (res) => {
      if (seen.has(res.runId)) return;
      seen.add(res.runId);
      if (res.timedOut) return;
      rememberTerminalExecution({ ...res, finishedAt: Date.now() });
      const code = res.exitCode === null ? "unknown" : String(res.exitCode);
      const output = res.output.trim() || "(no output)";
      const detail =
        `An integrated-terminal command started from the Run button has finished. ` +
        `This is an internal execution event, not a new user message. Inspect the ` +
        `debug trace below and continue the existing task without asking the user to ` +
        `paste or explain the output. Do NOT run the same command again yourself.\n\n` +
        `Command: ${res.command}\n` +
        `Working directory: ${res.cwd ?? "(unknown)"}\n` +
        `Exit code: ${code}\n\n` +
        `Terminal output:\n\`\`\`\n${output}\n\`\`\`\n\n` +
        (res.ok
          ? `The command SUCCEEDED. Briefly tell the user what the trace confirms, then ` +
            `continue the original task from the exact point where you paused. If another ` +
            `terminal command is needed, provide it with propose_command and pause for Run. ` +
            `If verification is complete, give one short final verdict.`
          : `The command FAILED. Do this now, in order:\n` +
            `1. Read the output and name the real root cause in one short sentence.\n` +
            `2. If the cause is wrong directory, missing dependency or a typo in the ` +
            `command itself, do not edit code — give the corrected command as a command ` +
            `block instead.\n` +
            `3. If the cause is in the project, open the exact files from the trace, fix ` +
            `them properly, then propose the same command again so the user can re-run it.\n` +
            `Report briefly: what broke, why, what you changed.`) +
        `\n\n${terminalKnowledgeContext(res.projectRoot)}`;
      continueAgentRef.current(detail);
    });
  }, []);

  const messages = activeConversation?.messages ?? [];
  const activeConversationId = activeConversation?.id ?? null;
  const visibleMessageCount =
    messageWindow.conversationId === activeConversationId
      ? messageWindow.count
      : 60;
  const hiddenMessageCount = Math.max(0, messages.length - visibleMessageCount);
  const visibleMessages = useMemo(
    () => messages.slice(hiddenMessageCount),
    [messages, hiddenMessageCount],
  );
  const showHero = !activeConversation || messages.length === 0;
  const lastLen = messages.length;
  const last = messages[messages.length - 1];
  const lastContent = last?.content.length ?? 0;
  const streaming = Boolean(
    last && last.role === "assistant" && last.streaming,
  );
  const thinking =
    streaming &&
    !last?.content &&
    (!last?.toolCalls || last.toolCalls.length === 0);

  useEffect(() => {
    setMessageWindow({ conversationId: activeConversationId, count: 60 });
    pinnedToBottomRef.current = true;
  }, [activeConversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedToBottomRef.current) return;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      el.scrollTop = el.scrollHeight;
    });
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [lastLen, lastContent, visibleMessageCount]);

  if (suspended) {
    return <div className="chat chat--suspended" aria-hidden="true" />;
  }

  if (showHero) {
    return (
      <section
        className={`chat chat--empty${centerEmpty ? " chat--empty-center" : ""}${hideTabs ? " chat--agent" : ""}`}
      >
        {!hideTabs && <SessionTabs />}
        {hideTabs && <div className="chat__greeting">Hi, go build)</div>}
        <div className="chat__composer-wrap chat__composer-wrap--empty">
          <NewSession
            onSend={sendMessage}
            showHeader={false}
            menusDown
            streaming={streaming}
            onStop={stopMessage}
          />
        </div>
        {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
      </section>
    );
  }

  return (
    <section className={`chat${hideTabs ? " chat--agent" : ""}`}>
      {!hideTabs && <SessionTabs />}
      <div
        className="chat__scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinnedToBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
      >
        <div className="chat__messages">
          {hiddenMessageCount > 0 && (
            <button
              type="button"
              className="chat__load-older"
              onClick={() =>
                setMessageWindow({
                  conversationId: activeConversationId,
                  count: visibleMessageCount + 60,
                })
              }
            >
              Показать предыдущие сообщения ({hiddenMessageCount})
            </button>
          )}
          {visibleMessages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
          {thinking && (
            <div className="chat__thinking" aria-live="polite">
              <img
                src={asset("clop.png")}
                alt=""
                aria-hidden="true"
                className="chat__thinking-icon"
              />
              <span className="chat__thinking-text">{t("chat.thinking")}</span>
            </div>
          )}
        </div>
      </div>
      <div className="chat__composer-wrap">
        <NewSession
          onSend={sendMessage}
          showHeader={false}
          streaming={streaming}
          onStop={stopMessage}
        />
      </div>
      {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
    </section>
  );
}
