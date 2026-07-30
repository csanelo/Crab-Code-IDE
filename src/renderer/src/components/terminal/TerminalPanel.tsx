import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Plus, Columns2 } from "lucide-react";
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

interface TabGroup {
  id: string;
  title: string;
  panes: string[];
}

export function TerminalPanel({
  onClose,
}: {
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [groups, setGroups] = useState<TabGroup[]>(() => {
    const paneId = createId("term_");
    return [{ id: createId("grp_"), title: t("terminal.title"), panes: [paneId] }];
  });
  const [activeGroupId, setActiveGroupId] = useState<string>(() => groups[0].id);
  const [activePaneId, setActivePaneId] = useState<string>(() => groups[0].panes[0]);
  const [closingGroupIds, setClosingGroupIds] = useState<string[]>([]);
  const sendToAIRef = useRef<(() => void) | null>(null);

  function addTab(): void {
    const paneId = createId("term_");
    const groupId = createId("grp_");
    setGroups((prev) => [
      ...prev,
      { id: groupId, title: `${t("terminal.title")} ${prev.length + 1}`, panes: [paneId] },
    ]);
    setActiveGroupId(groupId);
    setActivePaneId(paneId);
  }

  function splitActiveTerminal(): void {
    const newPaneId = createId("term_");
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroupId) return g;
        return { ...g, panes: [...g.panes, newPaneId] };
      }),
    );
    setActivePaneId(newPaneId);
  }

  function closePane(groupId: string, paneId: string): void {
    void window.api.terminal.kill(paneId);

    setGroups((prev) => {
      const next = prev
        .map((g) => {
          if (g.id !== groupId) return g;
          return { ...g, panes: g.panes.filter((id) => id !== paneId) };
        })
        .filter((g) => g.panes.length > 0);

      if (next.length === 0) {
        onClose();
        return [];
      }

      if (paneId === activePaneId || groupId === activeGroupId) {
        const currentGroup = next.find((g) => g.id === groupId) ?? next[0];
        setActiveGroupId(currentGroup.id);
        const fallbackPane = currentGroup.panes[currentGroup.panes.length - 1];
        setActivePaneId(fallbackPane);
      }

      return next;
    });
  }

  function closeGroup(groupId: string): void {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    group.panes.forEach((id) => void window.api.terminal.kill(id));

    const rest = groups.filter((g) => g.id !== groupId);
    if (rest.length === 0) {
      onClose();
      return;
    }
    if (groupId === activeGroupId) {
      const fallbackGroup = rest[rest.length - 1];
      setActiveGroupId(fallbackGroup.id);
      setActivePaneId(fallbackGroup.panes[0]);
    }
    setClosingGroupIds((prev) => [...prev, groupId]);
    window.setTimeout(() => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setClosingGroupIds((prev) => prev.filter((id) => id !== groupId));
    }, 200);
  }

  return (
    <section className="terminal">
      <header className="terminal__header">
        <div className="terminal__tabs">
          {groups.map((group) => (
            <div
              key={group.id}
              className={`terminal__tab${group.id === activeGroupId ? " terminal__tab--active" : ""}${closingGroupIds.includes(group.id) ? " terminal__tab--closing" : ""}`}
              onClick={() => {
                if (!closingGroupIds.includes(group.id)) {
                  setActiveGroupId(group.id);
                  if (!group.panes.includes(activePaneId)) {
                    setActivePaneId(group.panes[0]);
                  }
                }
              }}
              onAuxClick={(e) => {
                if (e.button !== 1 || closingGroupIds.includes(group.id)) return;
                e.preventDefault();
                closeGroup(group.id);
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
              <span className="terminal__tab-title">
                {group.title}
                {group.panes.length > 1 ? ` (${group.panes.length})` : ""}
              </span>
              <span
                className="terminal__tab-close"
                role="button"
                tabIndex={0}
                aria-label={t("editor.close")}
                onClick={(e) => {
                  e.stopPropagation();
                  closeGroup(group.id);
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
            data-tip={t("terminal.newTab")}
            onClick={addTab}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="terminal__spacer" />
        <button
          className="terminal__action"
          type="button"
          aria-label="Разделить терминал"
          title="Разделить терминал"
          onClick={splitActiveTerminal}
        >
          <Columns2 size={15} />
        </button>
        <button
          className="terminal__action"
          type="button"
          aria-label={t("terminal.sendToAI")}
          data-tip={t("terminal.sendToAI")}
          onClick={() => sendToAIRef.current?.()}
        >
          <Sparkles size={15} />
        </button>
        <button
          className="terminal__close"
          type="button"
          aria-label={t("terminal.close")}
          onClick={() => closeGroup(activeGroupId)}
        >
          <X size={17} />
        </button>
      </header>
      <div className="terminal__bodies">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`terminal__group${group.id === activeGroupId ? "" : " terminal__group--hidden"}`}
          >
            {group.panes.map((paneId, idx) => (
              <div
                key={paneId}
                className={`terminal__pane${paneId === activePaneId ? " terminal__pane--focused" : ""}`}
                onClick={() => setActivePaneId(paneId)}
              >
                {group.panes.length > 1 && (
                  <div className="terminal__pane-header">
                    <span className="terminal__pane-title">{`Terminal ${idx + 1}`}</span>
                    <button
                      type="button"
                      className="terminal__pane-close"
                      title="Закрыть этот терминал"
                      onClick={(e) => {
                        e.stopPropagation();
                        closePane(group.id, paneId);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <TerminalTab
                  id={paneId}
                  visible={group.id === activeGroupId}
                  focused={group.id === activeGroupId && paneId === activePaneId}
                  onExit={() => closePane(group.id, paneId)}
                  registerSendToAI={(fn) => {
                    if (group.id === activeGroupId && paneId === activePaneId) sendToAIRef.current = fn;
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TerminalTab({
  id,
  visible,
  focused,
  onExit,
  registerSendToAI,
}: {
  id: string;
  visible: boolean;
  focused: boolean;
  onExit: () => void;
  registerSendToAI: (fn: () => void) => void;
}): JSX.Element {
  const { state } = useApp();
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

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
    if (focused) registerSendToAI(sendToAI);
  }, [focused]);

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
    if (focused) {
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          termRef.current?.refresh(0, (termRef.current?.rows || 1) - 1);
        } catch {}
        termRef.current?.focus();
      });
    }
  }, [focused]);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          termRef.current?.refresh(0, (termRef.current?.rows || 1) - 1);
        } catch {}
      });
    }
  }, [visible]);

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
      if (spawned || disposed || !host) return;
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

    let shellPref: string = "auto";
    void window.api.settings
      .getGeneral()
      .then((g) => {
        shellPref = g.defaultShell ?? "auto";
      })
      .catch(() => {});

    function markerSuffix(): string {
      const isWin = window.api.window.platform === "win32";
      if (shellPref === "powershell" || shellPref === "pwsh")
        return ' ; echo "###CCEND:$LASTEXITCODE###"';
      if (shellPref === "bash" || shellPref === "gitbash")
        return ' ; echo "###CCEND:$?###"';
      if (shellPref === "cmd" || (isWin && shellPref === "auto"))
        return " & echo ###CCEND:%ERRORLEVEL%###";
      return ' ; echo "###CCEND:$?###"';
    }

    let watch: {
      runId: string;
      command: string;
      buffer: string;
      timer: number;
    } | null = null;

    function cleanOutput(raw: string): string {
      const stripped = raw
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b[()][0-9A-B]/g, "")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
        .replace(/\r/g, "\n");
      const lines = stripped
        .split("\n")
        .filter((line) => !line.includes("###CCEND:"))
        .map((line) => line.replace(/\s+$/, ""));
      while (lines.length && !lines[0].trim()) lines.shift();
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      const text = lines.join("\n");
      // Preserve enough context for the agent to diagnose real build/test failures.
      return text.length > 32_000
        ? `…(earlier output truncated)\n${text.slice(text.length - 32_000)}`
        : text;
    }

    function finishWatch(exitCode: number | null): void {
      if (!watch) return;
      const done = watch;
      watch = null;
      window.clearTimeout(done.timer);
      emitAppEvent("terminal:result", {
        runId: done.runId,
        command: done.command,
        ok: exitCode === 0,
        exitCode,
        output: cleanOutput(done.buffer),
        cwd: activeRepo?.path ?? null,
      });
    }

    function startWatch(runId: string, command: string): void {
      finishWatch(null);
      watch = {
        runId,
        command,
        buffer: "",
        // Long builds, installs and test suites must be watched through completion.
        timer: window.setTimeout(() => finishWatch(null), 60 * 60 * 1000),
      };
    }

    function feedWatch(chunk: string): void {
      if (!watch) return;
      // Keep a large rolling transcript while the command is running.
      watch.buffer = (watch.buffer + chunk).slice(-1_000_000);
      const match = /###CCEND:(-?\d+)###/.exec(watch.buffer);
      if (match) finishWatch(Number(match[1]));
    }

    const offData = window.api.terminal.onData((eid, chunk) => {
      if (eid !== id) return;
      term.write(chunk);
      feedWatch(chunk);
    });
    const offExit = window.api.terminal.onExit((eid) => {
      if (eid !== id || disposed) return;
      finishWatch(null);
      onExitRef.current();
    });

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

    const offRun = onAppEvent("terminal:run", ({ command, watch: w, runId }) => {
      if (!focusedRef.current) return;
      if (spawned) {
        term.focus();
        const traced = Boolean(w && runId);
        if (traced && runId) startWatch(runId, command);
        void window.api.terminal.write(
          id,
          command + (traced ? markerSuffix() : "") + "\r",
        );
      } else {
        queueTerminalCommand(command);
      }
    });

    return () => {
      disposed = true;
      if (watch) {
        window.clearTimeout(watch.timer);
        watch = null;
      }
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
    <div className={`terminal__tab-body${visible ? "" : " terminal__tab-body--hidden"}`}>
      <div className="terminal__xterm" ref={containerRef} />
    </div>
  );
}
