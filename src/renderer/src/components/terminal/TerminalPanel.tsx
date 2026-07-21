import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Plus } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import {
  on as onAppEvent,
  emit as emitAppEvent,
  takePendingCommand,
  queueTerminalCommand,
} from "../../lib/appEvents";
import { createId } from "../../domain/ids";
import { getThemeId } from "../../lib/theme";
import { xtermThemeFor } from "../../theme/themes";
import "./TerminalPanel.css";

interface Tab {
  id: string;
  title: string;
}

export function TerminalPanel({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [tabs, setTabs] = useState<Tab[]>(() => [
    { id: createId("term_"), title: t("terminal.title") },
  ]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [closingIds, setClosingIds] = useState<string[]>([]);
  const sendToAIRef = useRef<(() => void) | null>(null);

  function addTab(): void {
    const id = createId("term_");
    setTabs((prev) => [
      ...prev,
      { id, title: `${t("terminal.title")} ${prev.length + 1}` },
    ]);
    setActiveId(id);
  }

  function closeTab(id: string): void {
    if (closingIds.includes(id)) return;
    void window.api.terminal.kill(id);
    const rest = tabs.filter((x) => x.id !== id);
    if (rest.length === 0) {
      onClose();
      return;
    }
    if (id === activeId) {
      const idx = tabs.findIndex((x) => x.id === id);
      const fallback = rest[idx] ?? rest[idx - 1] ?? rest[0];
      setActiveId(fallback.id);
    }
    setClosingIds((prev) => [...prev, id]);
    window.setTimeout(() => {
      setTabs((prev) => prev.filter((x) => x.id !== id));
      setClosingIds((prev) => prev.filter((x) => x !== id));
    }, 220);
  }

  return (
    <section className="terminal">
      <header className="terminal__header">
        <div className="terminal__tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`terminal__tab${tab.id === activeId ? " terminal__tab--active" : ""}${closingIds.includes(tab.id) ? " terminal__tab--closing" : ""}`}
              onClick={() => {
                if (!closingIds.includes(tab.id)) setActiveId(tab.id);
              }}
              role="tab"
              tabIndex={0}
            >
              <span
                className="terminal__tab-icon terminal__tab-prompt"
                aria-hidden="true"
              >
                {">_"}
              </span>
              <span className="terminal__tab-title">{tab.title}</span>
              <span
                className="terminal__tab-close"
                role="button"
                tabIndex={0}
                aria-label={t("editor.close")}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X size={15} />
              </span>
            </div>
          ))}
          <button
            type="button"
            className="terminal__new"
            aria-label={t("terminal.newTab")}
            title={t("terminal.newTab")}
            onClick={addTab}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="terminal__spacer" />
        <button
          className="terminal__action"
          type="button"
          aria-label={t("terminal.sendToAI")}
          title={t("terminal.sendToAI")}
          onClick={() => sendToAIRef.current?.()}
        >
          <Sparkles size={16} />
        </button>
        <button
          className="terminal__close"
          type="button"
          aria-label={t("terminal.close")}
          onClick={() => closeTab(activeId)}
        >
          <X size={18} />
        </button>
      </header>
      <div className="terminal__bodies">
        {tabs.map((tab) => (
          <TerminalTab
            key={tab.id}
            id={tab.id}
            active={tab.id === activeId}
            registerSendToAI={(fn) => {
              if (tab.id === activeId) sendToAIRef.current = fn;
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TerminalTab({
  id,
  active,
  registerSendToAI,
}: {
  id: string;
  active: boolean;
  registerSendToAI: (fn: () => void) => void;
}): JSX.Element {
  const { state } = useApp();
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  function sendToAI(): void {
    const term = termRef.current;
    if (!term) return;
    const selected = term.getSelection().trim();
    let output = selected;
    if (!output) {
      const buf = term.buffer.active;
      const lines: string[] = [];
      const start = Math.max(0, buf.length - 200);
      for (let y = start; y < buf.length; y++) {
        const line = buf.getLine(y);
        if (line) lines.push(line.translateToString(true));
      }
      output = lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    if (!output) return;
    emitAppEvent("composer:insert", {
      text:
        "Here is my terminal output. If there is an error, explain the cause and fix it:\n\n" +
        "```\n" +
        output.slice(-6000) +
        "\n```",
    });
  }

  useEffect(() => {
    if (active) registerSendToAI(sendToAI);
  }, [active]);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      const term = termRef.current;
      if (term) term.options.theme = xtermThemeFor(getThemeId());
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {}
        termRef.current?.focus();
      });
    }
  }, [active]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        "'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      scrollback: 5000,
      allowProposedApi: true,
      theme: xtermThemeFor(getThemeId()),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    let copySelectionTimer = 0;
    const selectionDisposable = term.onSelectionChange(() => {
      window.clearTimeout(copySelectionTimer);
      copySelectionTimer = window.setTimeout(() => {
        const selected = term.getSelection();
        if (selected) void window.api.app.copy(selected);
      }, 80);
    });

    term.attachCustomKeyEventHandler((e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return true;
      const key = e.key.toLowerCase();
      if (key === "c" && term.hasSelection()) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "keydown") void window.api.app.copy(term.getSelection());
        return false;
      }
      if (key === "v") {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "keydown") {
          void window.api.app.paste().then((text) => {
            if (text) void window.api.terminal.write(id, text);
          });
        }
        return false;
      }
      return true;
    });

    let disposed = false;
    let spawned = false;

    function safeFit(): void {
      try {
        fit.fit();
      } catch {}
    }

    function resizePty(): void {
      void window.api.terminal.resize(id, term.cols || 80, term.rows || 24);
    }

    function trySpawn(): void {
      if (spawned || disposed) return;
      if (host.clientWidth < 20 || host.clientHeight < 20) {
        requestAnimationFrame(trySpawn);
        return;
      }
      spawned = true;
      safeFit();
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      const repoPath = activeRepo?.path ?? null;
      const remote = repoPath?.startsWith("ssh://")
        ? (() => {
            const rest = repoPath.slice("ssh://".length);
            const slash = rest.indexOf("/");
            return slash < 0
              ? { connId: rest, cwd: "/" }
              : { connId: rest.slice(0, slash), cwd: rest.slice(slash) };
          })()
        : null;
      const spawnPromise = remote
        ? window.api.terminal.spawnRemote(
            id,
            remote.connId,
            remote.cwd,
            cols,
            rows,
          )
        : window.api.terminal.spawn(id, repoPath, cols, rows);
      void spawnPromise.then(() => {
        if (disposed) return;
        const pending = takePendingCommand();
        if (pending) {
          setTimeout(() => {
            term.focus();
            void window.api.terminal.write(id, pending + "\r");
          }, 120);
        }
        setTimeout(() => term.focus(), 0);
      });
    }

    const offData = window.api.terminal.onData((eid, chunk) => {
      if (eid === id) term.write(chunk);
    });
    const offExit = window.api.terminal.onExit(() => {});

    term.onData((data) => {
      void window.api.terminal.write(id, data);
    });

    let rafId = 0;
    const ro = new ResizeObserver(() => {
      if (disposed) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        safeFit();
        if (spawned) resizePty();
        else trySpawn();
      });
    });
    ro.observe(host);

    function onWinResize(): void {
      safeFit();
      if (spawned) resizePty();
    }
    window.addEventListener("resize", onWinResize);

    trySpawn();

    const offRun = onAppEvent("terminal:run", ({ command }) => {
      if (!active) return;
      if (spawned) {
        term.focus();
        void window.api.terminal.write(id, command + "\r");
      } else {
        queueTerminalCommand(command);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      offData();
      offExit();
      offRun();
      window.clearTimeout(copySelectionTimer);
      selectionDisposable.dispose();
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeRepo?.path]);

  return (
    <div
      className={`terminal__xterm${active ? "" : " terminal__xterm--hidden"}`}
      ref={containerRef}
    />
  );
}
