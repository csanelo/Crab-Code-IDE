import { useCallback, useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { TitleBar } from "./components/titlebar/TitleBar";
import { FilesPanel } from "./components/files/FilesPanel";
import { SearchPanel } from "./components/search/SearchPanel";
import { CodeEditor } from "./components/editor/CodeEditor";
import { BrowserPanel } from "./components/browser/BrowserPanel";
import { ChatPanel } from "./components/chat/ChatPanel";
import { TerminalPanel } from "./components/terminal/TerminalPanel";
import { SettingsView } from "./components/settings/SettingsView";
import { StatusBar } from "./components/statusbar/StatusBar";
import { Toaster } from "./components/toast/Toaster";
import { GlobalPalette } from "./components/palette/GlobalPalette";
import { fileService } from "./services/fileService";
import { newRepository } from "./state";
import { on as onAppEvent, emit, queueTerminalCommand } from "./lib/appEvents";
import { usePersistentState } from "./lib/uiPersist";
import "./components/statusbar/StatusBar.css";
import "./App.css";

const LEFT_MIN = 240;
const LEFT_MAX = 560;
const LEFT_DEFAULT = 320;
const RIGHT_MIN = 420;
const RIGHT_MAX = 760;
const RIGHT_DEFAULT = 420;
const TERM_MIN = 120;
const TERM_DEFAULT = 240;

function Workspace(): JSX.Element {
  const {
    state,
    createConversation,
    openProjectFromFolder,
    selectProject,
    setView,
  } = useApp();
  const [leftOpen, setLeftOpen] = usePersistentState("leftOpen", true);
  const [rightOpen, setRightOpen] = usePersistentState("rightOpen", true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [leftWidth, setLeftWidth] = usePersistentState(
    "leftWidth",
    LEFT_DEFAULT,
  );
  const [rightWidth, setRightWidth] = usePersistentState(
    "rightWidth",
    RIGHT_DEFAULT,
  );
  const [terminalHeight, setTerminalHeight] = usePersistentState(
    "terminalHeight",
    TERM_DEFAULT,
  );
  const [resizing, setResizing] = useState<
    "left" | "right" | "terminal" | null
  >(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [editorFileCount, setEditorFileCount] = useState(0);
  const [leftMode, setLeftMode] = useState<"files" | "search">("files");
  const [searchSeed, setSearchSeed] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRightWidth((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w)));
    setLeftWidth((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;

  useEffect(() => {
    return window.api.app.onOpenPath(({ path, isDir }) => {
      const norm = (p: string): string => p.replace(/[\\/]+$/, "");
      if (isDir) {
        const existing = state.repositories.find(
          (r) => r.path && norm(r.path) === norm(path),
        );
        if (existing) selectProject(existing.id);
        else {
          const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
          openProjectFromFolder(newRepository(name, path));
        }
      } else {
        const dir = path.replace(/[\\/][^\\/]+$/, "");
        const existing = state.repositories.find(
          (r) => r.path && norm(r.path) === norm(dir),
        );
        if (existing) selectProject(existing.id);
        else {
          const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
          openProjectFromFolder(newRepository(name, dir));
        }
        emit("editor:open", { path });
      }
    });
  }, [state.repositories, openProjectFromFolder, selectProject]);

  function toggleTerminal(): void {
    setTerminalOpen((v) => {
      if (!v) setTerminalMounted(true);
      return !v;
    });
  }

  useEffect(() => {
    let awaitingChord = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    async function openFolder(): Promise<void> {
      const picked = await fileService.openFolder();
      if (picked)
        openProjectFromFolder(newRepository(picked.name, picked.path));
    }

    function onKey(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey;
      const code = e.code;

      if (awaitingChord) {
        if (
          e.key === "Control" ||
          e.key === "Shift" ||
          e.key === "Alt" ||
          e.key === "Meta"
        ) {
          return;
        }
        awaitingChord = false;
        if (chordTimer) clearTimeout(chordTimer);
        if (mod && code === "KeyO") {
          e.preventDefault();
          void openFolder();
          return;
        }
      }
      if (!mod) return;

      if (code === "KeyP" && e.shiftKey) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (code === "KeyF" && e.shiftKey) {
        e.preventDefault();
        setLeftMode("search");
        setLeftOpen(true);
        return;
      }
      if (code === "KeyK") {
        e.preventDefault();
        awaitingChord = true;
        if (chordTimer) clearTimeout(chordTimer);
        chordTimer = setTimeout(() => (awaitingChord = false), 1200);
        return;
      }
      if (code === "KeyN") {
        e.preventDefault();
        createConversation(state.activeRepositoryId);
      } else if (code === "KeyB") {
        e.preventDefault();
        setLeftOpen((v) => !v);
      } else if (code === "KeyJ") {
        e.preventDefault();
        setRightOpen((v) => !v);
      } else if (code === "KeyO") {
        e.preventDefault();
        void fileService.openFile();
      } else if (code === "KeyS" && e.shiftKey) {
        e.preventDefault();
        void fileService.saveAs({ content: "" });
      } else if (code === "KeyS") {
        e.preventDefault();
        void fileService.save({ path: null, content: "" });
      } else if (code === "Backquote") {
        e.preventDefault();
        toggleTerminal();
      } else if (code === "Comma") {
        e.preventDefault();
        setView("settings");
      } else if (code === "Equal" || code === "NumpadAdd") {
        e.preventDefault();
        void window.api.window.zoom(1);
      } else if (code === "Minus" || code === "NumpadSubtract") {
        e.preventDefault();
        void window.api.window.zoom(-1);
      } else if (code === "Digit0" || code === "Numpad0") {
        e.preventDefault();
        void window.api.window.zoom(0);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer) clearTimeout(chordTimer);
    };
  }, [
    createConversation,
    openProjectFromFolder,
    setView,
    state.activeRepositoryId,
    activeRepo,
  ]);

  useEffect(() => {
    function onWheel(e: WheelEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      void window.api.window.zoom(e.deltaY < 0 ? 1 : -1);
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    return onAppEvent("terminal:run", (payload) => {
      let alreadyOpen = true;
      setTerminalMounted((m) => {
        if (!m) alreadyOpen = false;
        return true;
      });
      setTerminalOpen((o) => {
        if (!o) alreadyOpen = false;
        return true;
      });
      if (!alreadyOpen) queueTerminalCommand(payload.command);
    });
  }, []);

  useEffect(() => {
    return onAppEvent("palette:open", () => setPaletteOpen(true));
  }, []);

  useEffect(() => {
    return onAppEvent("search:open", ({ query }) => {
      setSearchSeed(query ?? "");
      setLeftMode("search");
      setLeftOpen(true);
    });
  }, [setLeftOpen]);

  useEffect(() => {
    return onAppEvent("browser:toggle", ({ on, url }) => {
      setBrowserOpen((v) => (on === undefined ? !v : on));
      if (url) emit("browser:navigate", { url });
    });
  }, []);

  useEffect(() => {
    return window.api.browser.onCommand((cmd) => {
      if (cmd.kind === "navigate" && cmd.url) {
        setBrowserOpen(true);
        setTimeout(() => emit("browser:navigate", { url: cmd.url! }), 50);
      } else if (cmd.kind === "capture" && cmd.requestId && cmd.captureKind) {
        if (!browserOpen) {
          window.api.browser.captureResult({
            requestId: cmd.requestId,
            ok: false,
            error: "Browser is not open. Open it first (browser_open).",
          });
          return;
        }
        emit("browser:capture", {
          kind: cmd.captureKind,
          requestId: cmd.requestId,
        });
      }
    });
  }, [browserOpen]);

  useEffect(() => {
    return onAppEvent("browser:captured", (payload) => {
      window.api.browser.captureResult(payload);
    });
  }, []);

  useEffect(() => {
    return onAppEvent("editor:fileCount", ({ count }) =>
      setEditorFileCount(count),
    );
  }, []);

  const startResizeLeft = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setResizing("left");
      const main = mainRef.current;
      if (!main) return;
      const left = main.getBoundingClientRect().left;
      function onMove(ev: PointerEvent): void {
        const next = Math.min(LEFT_MAX, Math.max(LEFT_MIN, ev.clientX - left));
        setLeftWidth(next);
      }
      function onUp(): void {
        setResizing(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  const startResizeRight = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setResizing("right");
      const main = mainRef.current;
      if (!main) return;
      const right = main.getBoundingClientRect().right;
      function onMove(ev: PointerEvent): void {
        const next = Math.min(
          RIGHT_MAX,
          Math.max(RIGHT_MIN, right - ev.clientX),
        );
        setRightWidth(next);
      }
      function onUp(): void {
        setResizing(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  const startResizeTerminal = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setResizing("terminal");
      const content = contentRef.current;
      if (!content) return;
      const container = content.parentElement ?? content;
      const rect = container.getBoundingClientRect();
      const bottom = rect.bottom;
      const max = Math.max(TERM_MIN, rect.height - 160);
      function onMove(ev: PointerEvent): void {
        const next = Math.min(max, Math.max(TERM_MIN, bottom - ev.clientY));
        setTerminalHeight(next);
      }
      function onUp(): void {
        setResizing(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  const settingsOpen = state.view === "settings";
  const [settingsMounted, setSettingsMounted] = useState(false);

  useEffect(() => {
    if (settingsOpen) setSettingsMounted(true);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setView("chat");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, setView]);

  return (
    <div className="app">
      <TitleBar
        onToggleSidebar={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onToggleTerminal={toggleTerminal}
        onToggleBrowser={() => setBrowserOpen((v) => !v)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        terminalOpen={terminalOpen}
        browserOpen={browserOpen}
      />
      <div
        ref={mainRef}
        className={`app__main${resizing ? " app__main--resizing" : ""}`}
        style={
          {
            "--left-w": `${leftWidth}px`,
            "--right-w": `${rightWidth}px`,
            "--term-h": `${terminalHeight}px`,
          } as React.CSSProperties
        }
      >
        <div className="app__row">
          <div
            className={`app__panel app__panel--left${leftOpen ? "" : " app__panel--collapsed"}`}
          >
            <div className="app__panel-inner app__panel-inner--left">
              {leftMode === "search" ? (
                <SearchPanel
                  key={searchSeed}
                  initialQuery={searchSeed}
                  onClose={() => setLeftMode("files")}
                />
              ) : (
                <FilesPanel />
              )}
            </div>
          </div>

          {leftOpen && (
            <div
              className="app__resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Изменить ширину панели файлов"
              onPointerDown={startResizeLeft}
            >
              <span className="app__resizer-line" />
            </div>
          )}

          <div className="app__rightside">
            <div className="app__row app__row--inner" ref={contentRef}>
              {(() => {
                const browserFull = browserOpen && editorFileCount === 0;
                return (
                  <>
                    <div
                      className={`app__content${browserOpen ? " app__content--with-browser" : ""}${browserFull ? " app__content--hidden" : ""}`}
                    >
                      <CodeEditor />
                    </div>
                    {browserOpen && (
                      <div
                        className={`app__browser${browserFull ? " app__browser--full" : ""}`}
                      >
                        <BrowserPanel onClose={() => setBrowserOpen(false)} />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {terminalMounted && (
              <>
                {terminalOpen && (
                  <div
                    className="app__hresizer"
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Изменить высоту терминала"
                    onPointerDown={startResizeTerminal}
                  >
                    <span className="app__hresizer-line" />
                  </div>
                )}
                <div
                  className={`app__terminal${terminalOpen ? " app__terminal--open" : ""}`}
                >
                  <TerminalPanel
                    onClose={() => {
                      setTerminalOpen(false);
                      setTimeout(() => setTerminalMounted(false), 200);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {rightOpen && (
            <div
              className="app__resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Изменить ширину панели чата"
              onPointerDown={startResizeRight}
            >
              <span className="app__resizer-line" />
            </div>
          )}

          <div
            className={`app__panel app__panel--right${rightOpen ? "" : " app__panel--collapsed"}`}
          >
            <div className="app__panel-inner app__panel-inner--right">
              <ChatPanel />
            </div>
          </div>
        </div>
      </div>

      <StatusBar />

      {settingsMounted && (
        <div
          className={`app__settings-overlay${settingsOpen ? " app__settings-overlay--open" : ""}`}
          aria-hidden={!settingsOpen}
        >
          <SettingsView />
        </div>
      )}

      {paletteOpen && (
        <GlobalPalette
          onClose={() => setPaletteOpen(false)}
          toggleLeft={() => setLeftOpen((v) => !v)}
          toggleRight={() => setRightOpen((v) => !v)}
          toggleTerminal={toggleTerminal}
        />
      )}

      <Toaster />
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <AppProvider>
      <Workspace />
    </AppProvider>
  );
}
