import { useCallback, useEffect, useState } from "react";
import { usePersistentState } from "./lib/uiPersist";
import { useApp } from "./state/AppContext";
import { TitleBar } from "./components/titlebar/TitleBar";
import { SessionsPanel } from "./components/sessions/SessionsPanel";
import { ChatPanel } from "./components/chat/ChatPanel";
import { SettingsView } from "./components/settings/SettingsView";
import { TerminalPanel } from "./components/terminal/TerminalPanel";
import { GlobalPalette } from "./components/palette/GlobalPalette";
import { on as onAppEvent, queueTerminalCommand } from "./lib/appEvents";
import "./App.css";

const LEFT_DEFAULT = 320;

export function AgentWindow(): JSX.Element {
  const { state, setView, createConversation, openProject } = useApp();
  const [leftOpen, setLeftOpen] = usePersistentState("agent.leftOpen", true);
  const [leftWidth] = usePersistentState("agent.leftWidth", LEFT_DEFAULT);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const settingsOpen = state.view === "settings";

  const toggleTerminal = useCallback((): void => {
    setTerminalOpen((open) => {
      if (!open) setTerminalMounted(true);
      return !open;
    });
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setView("chat");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, setView]);

  useEffect(() => {
    let awaitingOpenFolder = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      const code = event.code;
      if (awaitingOpenFolder) {
        awaitingOpenFolder = false;
        if (chordTimer) clearTimeout(chordTimer);
        if (mod && code === "KeyO") {
          event.preventDefault();
          void openProject();
          return;
        }
      }
      if (!mod) return;
      if (code === "KeyP" && event.shiftKey) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (code === "KeyK") {
        event.preventDefault();
        awaitingOpenFolder = true;
        chordTimer = setTimeout(() => (awaitingOpenFolder = false), 1200);
      } else if (code === "KeyN") {
        event.preventDefault();
        createConversation(state.activeRepositoryId);
      } else if (code === "KeyB") {
        event.preventDefault();
        setLeftOpen((open) => !open);
      } else if (code === "Backquote") {
        event.preventDefault();
        toggleTerminal();
      } else if (code === "Comma") {
        event.preventDefault();
        setView("settings");
      } else if (code === "Equal" || code === "NumpadAdd") {
        event.preventDefault();
        void window.api.window.zoom(1);
      } else if (code === "Minus" || code === "NumpadSubtract") {
        event.preventDefault();
        void window.api.window.zoom(-1);
      } else if (code === "Digit0" || code === "Numpad0") {
        event.preventDefault();
        void window.api.window.zoom(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer) clearTimeout(chordTimer);
    };
  }, [
    createConversation,
    openProject,
    setLeftOpen,
    setView,
    state.activeRepositoryId,
    toggleTerminal,
  ]);

  useEffect(() => {
    const onWheel = (event: WheelEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      void window.api.window.zoom(event.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => onAppEvent("palette:open", () => setPaletteOpen(true)), []);

  useEffect(() => {
    return onAppEvent("terminal:run", ({ command }) => {
      queueTerminalCommand(command);
      setTerminalMounted(true);
      setTerminalOpen(true);
    });
  }, []);

  return (
    <div className="app app--agent">
      <TitleBar
        agentWindow
        leftOpen={leftOpen}
        terminalOpen={terminalOpen}
        onToggleSidebar={() => setLeftOpen((value) => !value)}
        onToggleTerminal={toggleTerminal}
      />
      <div
        className="app__main"
        style={{ "--left-w": `${leftWidth}px` } as React.CSSProperties}
      >
        <div className="app__row">
          <div
            className={`app__panel app__panel--left${leftOpen ? "" : " app__panel--collapsed"}`}
          >
            <div className="app__panel-inner app__panel-inner--left">
              <SessionsPanel />
            </div>
          </div>

          <div className="app__rightside">
            <div className="app__row app__row--inner">
              <div className="app__agent-center">
                <ChatPanel />
              </div>
            </div>
            {terminalMounted && (
              <div
                className={`app__terminal${terminalOpen ? " app__terminal--open" : ""}`}
              >
                <TerminalPanel
                  onClose={() => {
                    setTerminalOpen(false);
                    window.setTimeout(() => setTerminalMounted(false), 220);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {settingsOpen && (
        <div className="app__settings-overlay app__settings-overlay--open">
          <SettingsView />
        </div>
      )}
      {paletteOpen && (
        <GlobalPalette
          onClose={() => setPaletteOpen(false)}
          toggleLeft={() => setLeftOpen((open) => !open)}
          toggleRight={() => undefined}
          toggleTerminal={toggleTerminal}
        />
      )}
    </div>
  );
}
