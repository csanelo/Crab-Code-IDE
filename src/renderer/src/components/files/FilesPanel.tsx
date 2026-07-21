import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Undo2, RefreshCw } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { fileService } from "../../services/fileService";
import { newRepository } from "../../state";
import { useT } from "../../i18n";
import type { FileChange } from "../../domain/types";
import { on as onAppEvent, emit as emitAppEvent } from "../../lib/appEvents";
import { copyText } from "../../lib/clipboard";
import { usePersistentState } from "../../lib/uiPersist";
import { getThemeId } from "../../lib/theme";
import {
  setupMonaco,
  languageForFile,
  monacoThemeFor,
} from "../../lib/monacoSetup";
import { DiffEditor } from "@monaco-editor/react";
import { ContextMenu, type MenuItem } from "../sidebar/ContextMenu";
import { CommandPalette, type PaletteItem } from "../palette/CommandPalette";
import { FileTree } from "./FileTree";
import { fileIcon, folderIcon } from "./iconMap";
import "./FilesPanel.css";

setupMonaco();

function NewFileIcon({ size = 15 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M14 3v5h5" />
      <circle cx="18" cy="18" r="4" />
      <path d="M18 16.5v3M16.5 18h3" />
    </svg>
  );
}

function NewFolderIcon({ size = 15 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 19H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
      <circle cx="18" cy="18" r="4" />
      <path d="M18 16.5v3M16.5 18h3" />
    </svg>
  );
}

function CollapseAllIcon({ size = 15 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

type Tab = "changes" | "files";

interface MenuState {
  x: number;
  y: number;
  path: string;
  name: string;
  isDir: boolean;
  emptyArea?: boolean;
}

interface SearchHit {
  name: string;
  path: string;
  isDir: boolean;
}

export function FilesPanel(): JSX.Element {
  const { state, clearChanges, removeChange, openProjectFromFolder } = useApp();
  const t = useT();
  const [tab, setTab] = useState<Tab>("files");
  const [rootDragOver, setRootDragOver] = useState(false);
  const [treeKey, setTreeKey] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const changes = activeRepo ? (state.changes[activeRepo.id] ?? []) : [];

  const [openDirsByRepo, setOpenDirsByRepo] = usePersistentState<
    Record<string, string[]>
  >("fileTreeOpen", {});
  const repoKey = activeRepo?.path ?? "";
  const openDirs = useMemo(
    () => new Set(openDirsByRepo[repoKey] ?? []),
    [openDirsByRepo, repoKey],
  );

  const toggleDir = useCallback(
    (path: string, open?: boolean): void => {
      setOpenDirsByRepo((prev) => {
        const cur = new Set(prev[repoKey] ?? []);
        const willOpen = open ?? !cur.has(path);
        if (willOpen) cur.add(path);
        else cur.delete(path);
        return { ...prev, [repoKey]: [...cur] };
      });
    },
    [repoKey, setOpenDirsByRepo],
  );

  useEffect(() => {
    setSearchOpen(false);
    setQuery("");
    setHits([]);
  }, [activeRepo?.path]);

  const refresh = (): void => setTreeKey((k) => k + 1);

  const createAtRoot = useCallback(
    (kind: "file" | "dir"): void => {
      if (!activeRepo?.path) return;
      const dir = activeRepo.path;
      const call =
        kind === "file"
          ? window.api.fs.createFile({ dir })
          : window.api.fs.createDir({ dir });
      void call.then((r) => {
        if (r && !("error" in r)) {
          refresh();
          setTimeout(() => setRenamingPath(r.path), 60);
        }
      });
    },
    [activeRepo?.path],
  );

  const collapseAll = useCallback((): void => {
    setOpenDirsByRepo((prev) => ({ ...prev, [repoKey]: [] }));
  }, [repoKey, setOpenDirsByRepo]);

  async function importDropped(
    dt: DataTransfer,
    destDir: string,
  ): Promise<void> {
    const files = Array.from(dt.files);
    if (files.length === 0) return;
    const withPath: string[] = [];
    const noPath: File[] = [];
    for (const f of files) {
      let p = "";
      try {
        p = window.api.fs.pathForFile(f);
      } catch {
        p = "";
      }
      if (p) withPath.push(p);
      else noPath.push(f);
    }
    let changed = false;
    if (withPath.length > 0) {
      const r = await window.api.fs.import({ sources: withPath, destDir });
      if (r.imported.length > 0) changed = true;
    }
    if (noPath.length > 0) {
      const payload = await Promise.all(
        noPath.map(
          (f) =>
            new Promise<{ name: string; base64: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = reader.result as string;
                resolve({ name: f.name, base64: res.split(",")[1] ?? "" });
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(f);
            }),
        ),
      );
      const r = await window.api.fs.importData({ destDir, files: payload });
      if (r.imported.length > 0) changed = true;
    }
    if (changed) refresh();
  }

  function openFile(path: string): void {
    emitAppEvent("editor:open", { path });
  }

  useEffect(() => {
    return onAppEvent("fs:changed", () => setTreeKey((k) => k + 1));
  }, []);

  useEffect(() => {
    if (!searchOpen || !activeRepo?.path) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const root = activeRepo.path;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void window.api.fs.search(root, trimmed, 200).then((rs) => {
        if (cancelled) return;
        setHits(rs);
        setSearching(false);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, searchOpen, activeRepo?.path]);

  function revealEntry(entry: SearchHit): void {
    if (!activeRepo?.path) return;
    const root = activeRepo.path;
    if (!entry.path.startsWith(root)) return;
    const dirs: string[] = [];
    let cur = entry.path;
    while (cur.length > root.length) {
      const idx = Math.max(cur.lastIndexOf("/"), cur.lastIndexOf("\\"));
      if (idx <= 0) break;
      cur = cur.slice(0, idx);
      if (cur.length < root.length) break;
      dirs.push(cur);
    }
    if (entry.isDir) dirs.push(entry.path);
    setOpenDirsByRepo((prev) => {
      const set = new Set(prev[repoKey] ?? []);
      dirs.forEach((d) => set.add(d));
      return { ...prev, [repoKey]: [...set] };
    });
  }

  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    const parentDir = menu.isDir
      ? menu.path
      : menu.path.slice(
          0,
          Math.max(menu.path.lastIndexOf("/"), menu.path.lastIndexOf("\\")),
        );
    const newFile: MenuItem = {
      label: t("files.menu.newFile"),
      onClick: () => {
        void window.api.fs.createFile({ dir: parentDir }).then((r) => {
          if (r && !("error" in r)) {
            if (menu.isDir) toggleDir(menu.path, true);
            refresh();
            setTimeout(() => setRenamingPath(r.path), 60);
          }
        });
      },
    };
    const newFolder: MenuItem = {
      label: t("files.menu.newFolder"),
      onClick: () => {
        void window.api.fs.createDir({ dir: parentDir }).then((r) => {
          if (r && !("error" in r)) {
            if (menu.isDir) toggleDir(menu.path, true);
            refresh();
            setTimeout(() => setRenamingPath(r.path), 60);
          }
        });
      },
    };
    if (menu.emptyArea) return [newFile, newFolder];

    const items: MenuItem[] = [
      newFile,
      newFolder,
      { separator: true },
      {
        label: t("files.menu.open"),
        onClick: () => {
          if (!menu.isDir) openFile(menu.path);
        },
      },
      {
        label: t("files.menu.openInFolder"),
        onClick: () => void window.api.fs.showInFolder(menu.path),
      },
      {
        label: t("files.menu.addToChat"),
        onClick: () =>
          emitAppEvent("composer:mention", {
            path: menu.path,
            name: menu.name,
            isDir: menu.isDir,
          }),
      },
      { separator: true },
      { label: t("files.menu.copy"), onClick: () => copyText(menu.name) },
      { label: t("files.menu.copyPath"), onClick: () => copyText(menu.path) },
      { label: t("files.menu.cut"), onClick: () => copyText(menu.path) },
      { separator: true },
      {
        label: t("files.menu.rename"),
        shortcut: "F2",
        onClick: () => setRenamingPath(menu.path),
      },
      {
        label: t("files.menu.delete"),
        danger: true,
        onClick: () => {
          void window.api.fs.deletePath(menu.path).then((ok) => {
            if (ok) refresh();
          });
        },
      },
    ];
    return items;
  }, [menu, t, toggleDir]);

  function commitRename(path: string, value: string): void {
    const trimmed = value.trim();
    setRenamingPath(null);
    if (!trimmed) return;
    const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const oldName = lastSep >= 0 ? path.slice(lastSep + 1) : path;
    if (trimmed === oldName) return;
    void window.api.fs.rename({ path, newName: trimmed }).then(() => refresh());
  }

  const paletteItems: PaletteItem<SearchHit>[] = hits.map((h) => ({
    id: h.path,
    title: h.name,
    subtitle: activeRepo?.path
      ? h.path.slice(activeRepo.path.length).replace(/^[\\/]/, "")
      : h.path,
    icon: (
      <img
        className="palette__img"
        src={h.isDir ? folderIcon(h.name, false) : fileIcon(h.name)}
        alt=""
        aria-hidden="true"
      />
    ),
    data: h,
  }));

  return (
    <aside className="files">
      <header className="files__header">
        <div className="files__tabs" role="tablist">
          <button
            role="tab"
            type="button"
            aria-selected={tab === "changes"}
            className={`files__tab${tab === "changes" ? " files__tab--active" : ""}`}
            onClick={() => setTab("changes")}
          >
            {t("files.changes")}
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tab === "files"}
            className={`files__tab${tab === "files" ? " files__tab--active" : ""}`}
            onClick={() => setTab("files")}
          >
            {t("files.files")}
          </button>
        </div>
        <div className="files__actions">
          <button
            className="files__icon"
            type="button"
            aria-label={t("files.search")}
            title={t("files.search")}
            onClick={() => {
              if (!activeRepo?.path) return;
              setSearchOpen(true);
              setQuery("");
              setHits([]);
            }}
          >
            <Search size={14} />
          </button>
        </div>
      </header>

      <div
        className={`files__body${rootDragOver ? " files__body--dragover" : ""}`}
        onContextMenu={(e) => {
          if (
            tab === "files" &&
            activeRepo?.path &&
            !(e.target as HTMLElement).closest(".ftree__row")
          ) {
            e.preventDefault();
            setMenu({
              x: e.clientX,
              y: e.clientY,
              path: activeRepo.path,
              name: activeRepo.name,
              isDir: true,
              emptyArea: true,
            });
          }
        }}
        onDragOver={(e) => {
          if (
            tab === "files" &&
            activeRepo?.path &&
            e.dataTransfer.types.includes("Files")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!rootDragOver) setRootDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setRootDragOver(false);
        }}
        onDrop={(e) => {
          if (tab !== "files" || !activeRepo?.path) return;
          if (e.dataTransfer.files.length === 0) return;
          e.preventDefault();
          setRootDragOver(false);
          void importDropped(e.dataTransfer, activeRepo.path);
        }}
      >
        <div key={tab} className={`files__view files__view--${tab}`}>
          {tab === "changes" ? (
            <ChangesView
              changes={changes}
              repoPath={activeRepo?.path ?? null}
              onClear={() => activeRepo && clearChanges(activeRepo.id)}
              onReverted={(path) => {
                if (activeRepo && path) removeChange(activeRepo.id, path);
                setTreeKey((k) => k + 1);
              }}
            />
          ) : !activeRepo || !activeRepo.path ? (
            <div className="files__no-folder">
              <p className="files__no-folder-text">{t("files.noFolder")}</p>
              <button
                type="button"
                className="files__open-project"
                onClick={() => {
                  void fileService.openFolder().then((picked) => {
                    if (picked)
                      openProjectFromFolder(
                        newRepository(picked.name, picked.path),
                      );
                  });
                }}
              >
                {t("files.openProject")}
              </button>
            </div>
          ) : (
            <>
              <div
                className="ftree__root-title"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    path: activeRepo.path!,
                    name: activeRepo.name,
                    isDir: true,
                  });
                }}
                onDragOver={(e) => {
                  const types = e.dataTransfer.types;
                  if (
                    types.includes("application/x-sreda-move") ||
                    types.includes("Files")
                  ) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = types.includes("Files")
                      ? "copy"
                      : "move";
                    if (!rootDragOver) setRootDragOver(true);
                  }
                }}
                onDragLeave={() => setRootDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRootDragOver(false);
                  if (!activeRepo.path) return;
                  if (e.dataTransfer.files.length > 0) {
                    void importDropped(e.dataTransfer, activeRepo.path);
                    return;
                  }
                  const source = e.dataTransfer.getData(
                    "application/x-sreda-move",
                  );
                  if (source) {
                    void window.api.fs
                      .move({ source, destDir: activeRepo.path })
                      .then((r) => {
                        if (r && !("error" in r)) refresh();
                      });
                  }
                }}
              >
                <span
                  className={`ftree__root-name${rootDragOver ? " ftree__root-name--dragover" : ""}`}
                >
                  {activeRepo.name}
                </span>
                <div
                  className="ftree__root-actions"
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.stopPropagation()}
                >
                  <button
                    className="files__icon"
                    type="button"
                    aria-label={t("files.menu.newFile")}
                    title={t("files.menu.newFile")}
                    onClick={() => createAtRoot("file")}
                  >
                    <NewFileIcon size={15} />
                  </button>
                  <button
                    className="files__icon"
                    type="button"
                    aria-label={t("files.menu.newFolder")}
                    title={t("files.menu.newFolder")}
                    onClick={() => createAtRoot("dir")}
                  >
                    <NewFolderIcon size={15} />
                  </button>
                  <button
                    className="files__icon"
                    type="button"
                    aria-label={t("files.refresh")}
                    title={t("files.refresh")}
                    onClick={refresh}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="files__icon"
                    type="button"
                    aria-label={t("files.collapseAll")}
                    title={t("files.collapseAll")}
                    onClick={collapseAll}
                  >
                    <CollapseAllIcon size={15} />
                  </button>
                </div>
              </div>
              <FileTree
                key={treeKey}
                dir={activeRepo.path}
                depth={0}
                openDirs={openDirs}
                onToggleDir={toggleDir}
                renamingPath={renamingPath}
                onCommitRename={commitRename}
                onCancelRename={() => setRenamingPath(null)}
                onMoved={refresh}
                onOpenFile={openFile}
                onContextMenu={(e, entry) => {
                  e.preventDefault();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    path: entry.path,
                    name: entry.name,
                    isDir: entry.isDir,
                  });
                }}
              />
            </>
          )}
        </div>
      </div>

      {searchOpen && (
        <CommandPalette<SearchHit>
          placeholder={t("files.searchPlaceholder")}
          query={query}
          onQueryChange={setQuery}
          items={paletteItems}
          loading={searching && hits.length === 0}
          empty={
            query.trim() ? t("files.nothingFound") : t("files.enterFileName")
          }
          onSelect={(item) => {
            if (item.data) revealEntry(item.data);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          variant="plain"
          className="ctx-menu--narrow"
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}

function ChangeDiff({
  change,
  repoPath,
}: {
  change: FileChange;
  repoPath: string | null;
}): JSX.Element {
  const [modified, setModified] = useState<string | null>(null);
  const [themeId, setThemeId] = useState(getThemeId());

  function abs(p: string): string {
    if (!repoPath) return p;
    if (/^([a-zA-Z]:[\\/]|\/)/.test(p)) return p;
    const sep = repoPath.includes("\\") ? "\\" : "/";
    return `${repoPath}${sep}${p.replace(/[\\/]/g, sep)}`;
  }

  useEffect(() => {
    let cancelled = false;
    void window.api.fs.readFile(abs(change.path)).then((res) => {
      if (!cancelled) setModified(res?.content ?? "");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change.path, change.updatedAt]);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setThemeId(getThemeId());
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => obs.disconnect();
  }, []);

  if (modified === null) return <div className="changes__diff-loading">…</div>;

  const lineCount =
    change.before.split("\n").length + modified.split("\n").length + 2;
  const height = Math.min(Math.max(lineCount * 18 + 16, 80), 600);

  return (
    <div className="changes__diff" style={{ height }}>
      <DiffEditor
        key={`${change.path}:${change.updatedAt}`}
        height={height}
        theme={monacoThemeFor(themeId)}
        language={languageForFile(change.path)}
        original={change.before}
        modified={modified}
        options={{
          fontFamily:
            "'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
          fontSize: 12,
          lineHeight: 18,
          renderSideBySide: false,
          readOnly: true,
          renderOverviewRuler: false,
          renderMarginRevertIcon: false,
          hideUnchangedRegions: { enabled: false },
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbersMinChars: 3,
          folding: false,
          scrollbar: { alwaysConsumeMouseWheel: false },
        }}
      />
    </div>
  );
}

function ChangesView({
  changes,
  repoPath,
  onClear,
  onReverted,
}: {
  changes: FileChange[];
  repoPath: string | null;
  onClear: () => void;
  onReverted: (path: string) => void;
}): JSX.Element {
  const t = useT();
  const [openPath, setOpenPath] = useState<string | null>(null);

  if (changes.length === 0) {
    return (
      <div className="files__empty-state">
        <RefreshCw size={18} strokeWidth={2.25} />
        <span className="files__empty-title">{t("files.noChanges")}</span>
        <span className="files__empty-sub">{t("files.noChangesSub")}</span>
      </div>
    );
  }

  const totalAdded = changes.reduce((s, c) => s + c.added, 0);
  const totalRemoved = changes.reduce((s, c) => s + c.removed, 0);

  function abs(p: string): string {
    if (!repoPath) return p;
    if (/^([a-zA-Z]:[\\/]|\/)/.test(p)) return p;
    const sep = repoPath.includes("\\") ? "\\" : "/";
    return `${repoPath}${sep}${p.replace(/[\\/]/g, sep)}`;
  }

  async function revert(c: FileChange): Promise<void> {
    const absPath = abs(c.path);
    const ok = await window.api.fs.revert({
      path: absPath,
      before: c.before,
      existed: c.existed,
    });
    if (ok) {
      onReverted(c.path);
      emitAppEvent("editor:reload", { path: absPath });
    }
  }

  return (
    <div className="changes">
      <div className="changes__summary">
        <span className="changes__count">
          {t("files.changedCount", { n: changes.length })}
        </span>
        <span className="changes__totals">
          {totalAdded > 0 && (
            <span className="changes__added">+{totalAdded}</span>
          )}
          {totalRemoved > 0 && (
            <span className="changes__removed">−{totalRemoved}</span>
          )}
        </span>
        <button
          type="button"
          className="changes__clear"
          onClick={onClear}
          title={t("files.clearChanges")}
        >
          {t("files.clearChanges")}
        </button>
      </div>

      <div className="changes__list">
        {changes.map((c) => {
          const name = c.path.split(/[\\/]/).pop() ?? c.path;
          const open = openPath === c.path;
          return (
            <div key={c.path} className="changes__item">
              <div
                className={`changes__row${open ? " changes__row--open" : ""}`}
              >
                <button
                  type="button"
                  className="changes__row-main"
                  onClick={() => setOpenPath(open ? null : c.path)}
                  aria-expanded={open}
                >
                  <ChevronRight
                    size={12}
                    className={`changes__chevron${open ? " changes__chevron--open" : ""}`}
                  />
                  <img
                    className="changes__icon"
                    src={fileIcon(name)}
                    alt=""
                    aria-hidden="true"
                  />
                  <span className="changes__name">{name}</span>
                  <span className="changes__nums">
                    {c.added > 0 && (
                      <span className="changes__added">+{c.added}</span>
                    )}
                    {c.removed > 0 && (
                      <span className="changes__removed">−{c.removed}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="changes__revert"
                  title={t("files.revert")}
                  aria-label={t("files.revert")}
                  onClick={() => void revert(c)}
                >
                  <Undo2 size={13} />
                </button>
              </div>
              {open && <ChangeDiff change={c} repoPath={repoPath} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
