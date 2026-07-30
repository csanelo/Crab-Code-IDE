import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  Menu,
} from "electron";
import { basename } from "node:path";
import { join } from "node:path";
import { statSync } from "node:fs";
import { registerAgent } from "./agent";
import { registerFileSystem } from "./fileSystem";
import { registerTerminal, killAllTerminals } from "./terminal";
import { registerSettings } from "./settings";
import { registerProviders } from "./providers";
import { registerMcp } from "./mcp";
import { registerTranscribe } from "./transcribe";
import { registerSkills } from "./skills";
import { registerGithub, registerSsh } from "./github";
import { registerRemote } from "./remote";
import { registerLsp, killAllLsp } from "./lsp";
import { registerBrowserBridge } from "./browser";
import { autoUpdater } from "electron-updater";

const isDev = !app.isPackaged;

// Render text with grayscale antialiasing instead of subpixel (LCD) rendering,
// so glyph edges stay neutral gray instead of showing colored fringes.
app.commandLine.appendSwitch("disable-lcd-text");
app.commandLine.appendSwitch("disable-font-subpixel-positioning");

app.setName("CrabCode");
if (process.platform === "win32") app.setAppUserModelId("com.crabcode.app");

const appIcon = join(
  __dirname,
  process.platform === "win32"
    ? "../../resources/icon.ico"
    : "../../resources/icon.png",
);

const isMac = process.platform === "darwin";
let currentLang = "ru";

function getMenuTranslations(lang: string) {
  const isRu = lang === "ru" || (lang !== "en" && app.getLocale().startsWith("ru"));
  if (isRu) {
    return {
      aboutApp: "О программе CrabCode",
      settings: "Настройки...",
      hideApp: "Скрыть CrabCode",
      hideOthers: "Скрыть остальные",
      showAll: "Показать все",
      quitApp: "Завершить CrabCode",
      file: "Файл",
      newSession: "Новая сессия агента",
      openFolder: "Открыть папку...",
      save: "Сохранить",
      saveAll: "Сохранить всё",
      closeWindow: "Закрыть окно",
      edit: "Правка",
      undo: "Отменить",
      redo: "Повторить",
      cut: "Вырезать",
      copy: "Копировать",
      paste: "Вставить",
      selectAll: "Выделить всё",
      searchWorkspace: "Поиск в проекте",
      view: "Вид",
      quickPalette: "Панель команд / Поиск",
      toggleSidebar: "Боковая панель файлов",
      toggleChat: "Панель чата агента",
      toggleTerminal: "Встроенный терминал",
      toggleBrowser: "Браузер агента",
      zoomIn: "Увеличить",
      zoomOut: "Уменьшить",
      zoomReset: "Сбросить масштаб",
      fullScreen: "Полноэкранный режим",
      devTools: "Инструменты разработчика",
      window: "Окно",
      minimize: "Свернуть",
      zoom: "Изменить размер",
      front: "Все окна на передний план",
      help: "Справка",
    };
  }
  return {
    aboutApp: "About CrabCode",
    settings: "Settings...",
    hideApp: "Hide CrabCode",
    hideOthers: "Hide Others",
    showAll: "Show All",
    quitApp: "Quit CrabCode",
    file: "File",
    newSession: "New Agent Session",
    openFolder: "Open Folder...",
    save: "Save",
    saveAll: "Save All",
    closeWindow: "Close Window",
    edit: "Edit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    searchWorkspace: "Search in Project",
    view: "View",
    quickPalette: "Command Palette / Quick Open",
    toggleSidebar: "Toggle Files Sidebar",
    toggleChat: "Toggle Agent Chat",
    toggleTerminal: "Toggle Terminal",
    toggleBrowser: "Toggle Agent Browser",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    zoomReset: "Reset Zoom",
    fullScreen: "Toggle Full Screen",
    devTools: "Toggle Developer Tools",
    window: "Window",
    minimize: "Minimize",
    zoom: "Zoom",
    front: "Bring All to Front",
    help: "Help",
  };
}

function sendMenuAction(action: string): void {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send("menu:action", action);
  }
}

function setupAppMenu(lang: string = currentLang): void {
  currentLang = lang;
  const t = getMenuTranslations(lang);
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: t.aboutApp,
                click: () => sendMenuAction("about"),
              },
              { type: "separator" as const },
              {
                label: t.settings,
                accelerator: "CmdOrCtrl+,",
                click: () => sendMenuAction("settings"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const, label: t.hideApp },
              { role: "hideOthers" as const, label: t.hideOthers },
              { role: "unhide" as const, label: t.showAll },
              { type: "separator" as const },
              { role: "quit" as const, label: t.quitApp },
            ],
          },
        ]
      : []),
    {
      label: t.file,
      submenu: [
        {
          label: t.newSession,
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("new-session"),
        },
        {
          label: t.openFolder,
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("open-folder"),
        },
        { type: "separator" },
        {
          label: t.save,
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save"),
        },
        {
          label: t.saveAll,
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("save-all"),
        },
        { type: "separator" },
        {
          label: t.closeWindow,
          accelerator: "CmdOrCtrl+W",
          role: "close",
        },
      ],
    },
    {
      label: t.edit,
      submenu: [
        { role: "undo", label: t.undo },
        { role: "redo", label: t.redo },
        { type: "separator" },
        { role: "cut", label: t.cut },
        { role: "copy", label: t.copy },
        { role: "paste", label: t.paste },
        { role: "selectAll", label: t.selectAll },
        { type: "separator" },
        {
          label: t.searchWorkspace,
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => sendMenuAction("search-workspace"),
        },
      ],
    },
    {
      label: t.view,
      submenu: [
        {
          label: t.quickPalette,
          accelerator: "CmdOrCtrl+P",
          click: () => sendMenuAction("quick-palette"),
        },
        { type: "separator" },
        {
          label: t.toggleSidebar,
          accelerator: "CmdOrCtrl+B",
          click: () => sendMenuAction("toggle-sidebar"),
        },
        {
          label: t.toggleChat,
          accelerator: "CmdOrCtrl+J",
          click: () => sendMenuAction("toggle-chat"),
        },
        {
          label: t.toggleTerminal,
          accelerator: "CmdOrCtrl+`",
          click: () => sendMenuAction("toggle-terminal"),
        },
        {
          label: t.toggleBrowser,
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => sendMenuAction("toggle-browser"),
        },
        { type: "separator" },
        {
          label: t.zoomIn,
          accelerator: "CmdOrCtrl+=",
          click: () => sendMenuAction("zoom-in"),
        },
        {
          label: t.zoomOut,
          accelerator: "CmdOrCtrl+-",
          click: () => sendMenuAction("zoom-out"),
        },
        {
          label: t.zoomReset,
          accelerator: "CmdOrCtrl+0",
          click: () => sendMenuAction("zoom-reset"),
        },
        { type: "separator" },
        { role: "togglefullscreen", label: t.fullScreen },
        { role: "toggleDevTools", label: t.devTools },
      ],
    },
    {
      label: t.window,
      submenu: [
        { role: "minimize", label: t.minimize },
        { role: "zoom", label: t.zoom },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const, label: t.front },
            ]
          : []),
      ],
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.aboutApp,
          click: () => sendMenuAction("about"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("app:set-language", (_e, lang: string) => {
  if (typeof lang === "string") setupAppMenu(lang);
  return true;
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase();
    const blocked =
      key === "f12" ||
      (input.control && input.shift && ["i", "j", "c"].includes(key)) ||
      (input.meta && input.alt && ["i", "j", "c"].includes(key));
    if (blocked) event.preventDefault();
  });
  contents.on("devtools-opened", () => contents.closeDevTools());
  contents.on("context-menu", (_e, params) => {
    const tr = getMenuTranslations(currentLang);
    const hasSelection = params.selectionText.trim().length > 0;
    const canCopy = params.editFlags.canCopy || hasSelection;

    if (!params.isEditable && !hasSelection) return;

    const menu = Menu.buildFromTemplate([
      { role: "undo" as const, label: tr.undo, enabled: params.editFlags.canUndo },
      { role: "redo" as const, label: tr.redo, enabled: params.editFlags.canRedo },
      { type: "separator" as const },
      { role: "cut" as const, label: tr.cut, enabled: params.editFlags.canCut },
      { role: "copy" as const, label: tr.copy, enabled: canCopy },
      { role: "paste" as const, label: tr.paste, enabled: params.editFlags.canPaste },
      { type: "separator" as const },
      { role: "selectAll" as const, label: tr.selectAll, enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup();
  });
});

const frameOptions: Electron.BrowserWindowConstructorOptions = isMac
  ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 14 } }
  : { frame: false, titleBarStyle: "hidden" };

let editorWindow: BrowserWindow | null = null;

let mainWindow: BrowserWindow | null = null;

let agentWindow: BrowserWindow | null = null;

let pendingMacOpen: string | null = null;

let isQuitting = false;

function setupAutoUpdate(): void {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {});
  autoUpdater.on("update-downloaded", () => {
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });
  void autoUpdater.checkForUpdates().catch(() => null);
  setInterval(
    () => {
      void autoUpdater.checkForUpdates().catch(() => null);
    },
    5 * 60 * 1000,
  );
}

function pathFromArgv(argv: string[]): string | null {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const a of args) {
    if (!a || a.startsWith("-")) continue;
    try {
      statSync(a);
      return a;
    } catch {}
  }
  return null;
}

function deliverOpenPath(target: string): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  let isDir = false;
  try {
    isDir = statSync(target).isDirectory();
  } catch {
    return;
  }
  const send = (): void =>
    win.webContents.send("app:open-path", { path: target, isDir });
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  } else {
    send();
  }
  if (win.isMinimized()) win.restore();
  win.focus();
}

function editorUrl(): { url?: string; file?: string } {
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    return { url: `${process.env["ELECTRON_RENDERER_URL"]}#editor` };
  }
  return { file: join(__dirname, "../renderer/index.html") };
}

function openEditorWindow(path: string): void {
  if (editorWindow && !editorWindow.isDestroyed()) {
    if (editorWindow.isMinimized()) editorWindow.restore();
    editorWindow.focus();
    editorWindow.webContents.send("editor:open-file", path);
    return;
  }

  editorWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 480,
    minHeight: 320,
    show: false,
    ...frameOptions,
    backgroundColor: "#181818",
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  const ed = editorWindow;
  ed.on("ready-to-show", () => ed.show());
  ed.webContents.on("did-finish-load", () =>
    ed.webContents.send("editor:open-file", path),
  );
  ed.on("closed", () => {
    editorWindow = null;
  });
  ed.on("maximize", () => ed.webContents.send("window:maximized", true));
  ed.on("unmaximize", () => ed.webContents.send("window:maximized", false));
  ed.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const target = editorUrl();
  if (target.url) ed.loadURL(target.url);
  else ed.loadFile(target.file!, { hash: "editor" });
}

interface DiffPayload {
  path: string;
  original: string;
  modified: string;
}

function openEditorWindowDiff(payload: DiffPayload): void {
  if (editorWindow && !editorWindow.isDestroyed()) {
    if (editorWindow.isMinimized()) editorWindow.restore();
    editorWindow.focus();
    editorWindow.webContents.send("editor:open-diff", payload);
    return;
  }
  openEditorWindow(payload.path);
  const ed = editorWindow;
  if (ed) {
    ed.webContents.once("did-finish-load", () =>
      ed.webContents.send("editor:open-diff", payload),
    );
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // Fixed launch size, centred on screen, regardless of the previous session.
    width: 1254,
    height: 767,
    minWidth: 720,
    minHeight: 480,
    center: true,
    show: false,
    ...frameOptions,
    backgroundColor: "#181818",
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      devTools: false,
    },
  });

  win.on("ready-to-show", () => {
    // Electron may restore a maximized state or clamp the size on some display
    // setups, so re-apply the intended bounds right before the first paint.
    if (win.isMaximized()) win.unmaximize();
    win.setSize(1254, 767);
    win.center();
    win.show();
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  function openAgentWindow(): boolean {
    if (agentWindow && !agentWindow.isDestroyed()) {
      if (agentWindow.isMinimized()) agentWindow.restore();
      agentWindow.focus();
      return true;
    }

    agentWindow = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 720,
      minHeight: 520,
      show: false,
      ...frameOptions,
      backgroundColor: "#181818",
      icon: appIcon,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true,
        devTools: false,
      },
    });

    agentWindow.on("ready-to-show", () => {
      const next = agentWindow;
      if (!next || next.isDestroyed()) return;
      // Agent and IDE stay independent: opening one never hides the other.
      next.show();
      next.focus();
    });
    agentWindow.on("closed", () => {
      if (agentWindow) agentWindow = null;
    });
    agentWindow.on("maximize", () =>
      agentWindow?.webContents.send("window:maximized", true),
    );
    agentWindow.on("unmaximize", () =>
      agentWindow?.webContents.send("window:maximized", false),
    );
    agentWindow.webContents.on("did-fail-load", () => {
      const failed = agentWindow;
      agentWindow = null;
      if (failed && !failed.isDestroyed()) failed.destroy();
    });

    if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
      agentWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#agent`);
    } else {
      agentWindow.loadFile(join(__dirname, "../renderer/index.html"), {
        hash: "agent",
      });
    }

    return true;
  }

  win.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      if (permission === "media" || permission === "audioCapture") {
        callback(true);
        return;
      }
      callback(false);
    },
  );

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow) return false;
    if (targetWindow.isMaximized()) targetWindow.unmaximize();
    else targetWindow.maximize();
    return targetWindow.isMaximized();
  });
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("window:is-maximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
  win.on("maximize", () => win.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win.webContents.send("window:maximized", false));

  const ZOOM_MIN = -3;
  const ZOOM_MAX = 6;
  ipcMain.handle("window:zoom", (event, delta: number) => {
    const wc = event.sender;
    if (delta === 0) {
      wc.setZoomLevel(0);
    } else {
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, wc.getZoomLevel() + delta),
      );
      wc.setZoomLevel(next);
    }
    return wc.getZoomLevel();
  });

  ipcMain.handle("project:open-dialog", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Открыть проект",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0];
    return { path, name: basename(path) };
  });

  ipcMain.handle("app:open-agent-window", () => {
    return openAgentWindow();
  });

  ipcMain.handle("app:return-to-ide", (event, sessionSnapshot?: unknown) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (sessionSnapshot) {
      mainWindow.webContents.send("app:agent-sessions", sessionSnapshot);
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    // Do not close Agent — the IDE and Agent are intentionally separate windows.
    return true;
  });

  ipcMain.handle("project:reveal", async (_e, path: string) => {
    if (!path) return false;
    await shell.openPath(path);
    return true;
  });

  ipcMain.handle("editor:open", (_e, path: string) => {
    if (!path) return false;
    openEditorWindow(path);
    return true;
  });

  ipcMain.handle(
    "editor:open-diff",
    (_e, payload: { path: string; original: string; modified: string }) => {
      if (!payload?.path) return false;
      openEditorWindowDiff(payload);
      return true;
    },
  );

  ipcMain.handle("app:clipboard-write", (_e, text: string) => {
    clipboard.writeText(text ?? "");
    return true;
  });

  ipcMain.handle("app:clipboard-read", () => clipboard.readText());

  ipcMain.handle("app:about", () => {
    const { versions, platform, arch } = process;
    return {
      name: "CrabCode",
      version: app.getVersion(),
      electron: versions.electron ?? "",
      chromium: versions.chrome ?? "",
      node: versions.node ?? "",
      v8: versions.v8 ?? "",
      os: `${platform} ${arch}`,
    };
  });

function toElectronAccelerator(shortcut?: string): string | undefined {
  if (!shortcut) return undefined;
  const acc = shortcut
    .replace(/⇧/g, "Shift+")
    .replace(/⌥/g, "Alt+")
    .replace(/⌃/g, "Control+")
    .replace(/⌘/g, "CmdOrCtrl+");
  return /^[\x00-\x7F]+$/.test(acc) ? acc : undefined;
}

  ipcMain.handle(
    "app:show-context-menu",
    async (
      event,
      items: Array<{
        id: string;
        label?: string;
        shortcut?: string;
        danger?: boolean;
        disabled?: boolean;
        separator?: boolean;
      }>,
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return null;

      return new Promise<string | null>((resolve) => {
        let resolved = false;
        const menuItems: Electron.MenuItemConstructorOptions[] = items.map(
          (item) => {
            if (item.separator) return { type: "separator" };
            return {
              label: item.label,
              accelerator: toElectronAccelerator(item.shortcut),
              enabled: !item.disabled,
              click: () => {
                resolved = true;
                resolve(item.id);
              },
            };
          },
        );

        const menu = Menu.buildFromTemplate(menuItems);
        menu.popup({
          window: win,
          callback: () => {
            setTimeout(() => {
              if (!resolved) resolve(null);
            }, 100);
          },
        });
      });
    },
  );

  ipcMain.handle("app:show-about", async () => {
    const { versions, platform, arch } = process;
    const detail = [
      `Версия: ${app.getVersion()}`,
      `Electron: ${versions.electron}`,
      `Chromium: ${versions.chrome}`,
      `Node.js: ${versions.node}`,
      `V8: ${versions.v8}`,
      `OS: ${platform} ${arch}`,
    ].join("\n");
    const result = await dialog.showMessageBox(win, {
      type: "info",
      title: "CrabCode",
      message: "CrabCode",
      detail,
      buttons: ["Копировать", "OK"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) {
      const { clipboard } = await import("electron");
      clipboard.writeText(detail);
    }
    return true;
  });

  registerFileSystem(win);
  registerTerminal(win);
  registerSettings(ipcMain);
  registerProviders(ipcMain);
  registerMcp(ipcMain);
  registerTranscribe(ipcMain);
  registerSkills(ipcMain);
  registerGithub(ipcMain);
  registerSsh(ipcMain);
  registerRemote(ipcMain);
  registerLsp(ipcMain);
  registerBrowserBridge();

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const target = pathFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (target) deliverOpenPath(target);
    }
  });

  app.on("open-file", (e, p) => {
    e.preventDefault();
    if (app.isReady() && mainWindow) deliverOpenPath(p);
    else pendingMacOpen = p;
  });

  app.whenReady().then(() => {
    setupAppMenu();
    registerAgent(ipcMain);

    ipcMain.handle("editor-window:minimize", () => editorWindow?.minimize());
    ipcMain.handle("editor-window:toggle-maximize", () => {
      if (!editorWindow) return false;
      if (editorWindow.isMaximized()) editorWindow.unmaximize();
      else editorWindow.maximize();
      return editorWindow.isMaximized();
    });
    ipcMain.handle("editor-window:close", () => editorWindow?.close());

    createWindow();
    setupAutoUpdate();

    const initialTarget = pendingMacOpen ?? pathFromArgv(process.argv);
    if (initialTarget) deliverOpenPath(initialTarget);
    pendingMacOpen = null;

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  killAllTerminals();
  killAllLsp();
});

app.on("window-all-closed", () => {
  killAllTerminals();
  killAllLsp();
  if (process.platform !== "darwin") app.quit();
});
