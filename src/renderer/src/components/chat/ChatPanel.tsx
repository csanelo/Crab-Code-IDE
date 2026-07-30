import { useEffect, useRef, useState } from "react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import { on as onAppEvent } from "../../lib/appEvents";
import { asset } from "../../lib/asset";
import { MessageItem } from "./MessageItem";
import { NewSession } from "../center/NewSession";
import { SessionTabs } from "./SessionTabs";
import { McpModal } from "../mcp/McpModal";
import "./ChatPanel.css";

export function ChatPanel({
  centerEmpty = false,
  hideTabs = false,
}: { centerEmpty?: boolean; hideTabs?: boolean } = {}): JSX.Element {
  const { state, activeConversation, sendMessage, stopMessage } = useApp();
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mcpOpen, setMcpOpen] = useState(false);

  useEffect(() => {
    return onAppEvent("mcp:open", () => setMcpOpen(true));
  }, []);

  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  useEffect(() => {
    const seen = new Set<string>();
    return onAppEvent("terminal:result", (res) => {
      if (seen.has(res.runId)) return;
      seen.add(res.runId);
      const code = res.exitCode === null ? "unknown" : String(res.exitCode);
      const output = res.output.trim() || "(no output)";
      const shown = `RUN \`${res.command}\``;
      const detail =
        `The user pressed Run on a command card. The command has finished in the ` +
        `integrated terminal. Do NOT run it again yourself.\n\n` +
        `Command: ${res.command}\n` +
        `Working directory: ${res.cwd ?? "(unknown)"}\n` +
        `Exit code: ${code}\n\n` +
        `Terminal output:\n\`\`\`\n${output}\n\`\`\`\n\n` +
        (res.ok
          ? `The command SUCCEEDED. Reply with one short sentence confirming it worked ` +
            `(mention the key fact from the output if useful). Change NOTHING, call no ` +
            `tools, and do not propose follow-up commands unless the user asks.`
          : `The command FAILED. Do this now, in order:\n` +
            `1. Read the output and name the real root cause in one short sentence.\n` +
            `2. If the cause is wrong directory, missing dependency or a typo in the ` +
            `command itself, do not edit code — give the corrected command as a command ` +
            `block instead.\n` +
            `3. If the cause is in the project, open the exact files from the trace, fix ` +
            `them properly, then propose the same command again so the user can re-run it.\n` +
            `Report briefly: what broke, why, what you changed.`);
      sendRef.current(shown, undefined, detail, false);
    });
  }, []);

  const messages = activeConversation?.messages ?? [];
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
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastLen, lastContent]);

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
            agentMode={hideTabs}
          />
        </div>
        {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
      </section>
    );
  }

  return (
    <section className={`chat${hideTabs ? " chat--agent" : ""}`}>
      {!hideTabs && <SessionTabs />}
      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__messages">
          {messages.map((m) => (
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
          agentMode={hideTabs}
        />
      </div>
      {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
    </section>
  );
}
