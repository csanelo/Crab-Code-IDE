import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
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

app.setName("CrabCode");
if (process.platform === "win32") app.setAppUserModelId("com.crabcode.app");

const appIcon = join(
  __dirname,
  process.platform === "win32"
    ? "../../resources/icon.ico"
    : "../../resources/icon.png",
);

const isMac = process.platform === "darwin";

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
});

const frameOptions: Electron.BrowserWindowConstructorOptions = isMac
  ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 14 } }
  : { frame: false, titleBarStyle: "hidden" };

let editorWindow: BrowserWindow | null = null;

let mainWindow: BrowserWindow | null = null;

let pendingMacOpen: string | null = null;

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
    width: 1533,
    height: 842,
    minWidth: 720,
    minHeight: 480,
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

  win.on("ready-to-show", () => win.show());

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

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

  ipcMain.handle("window:minimize", () => win.minimize());
  ipcMain.handle("window:toggle-maximize", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle("window:close", () => win.close());
  ipcMain.handle("window:is-maximized", () => win.isMaximized());
  win.on("maximize", () => win.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win.webContents.send("window:maximized", false));

  const ZOOM_MIN = -3;
  const ZOOM_MAX = 6;
  ipcMain.handle("window:zoom", (_e, delta: number) => {
    const wc = win.webContents;
    if (delta === 0) {
      wc.setZoomLevel(0);
    } else {
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, wc.getZoomLevel() + delta),
      );
      wc.setZoomLevel(next);
    }
    return win.webContents.getZoomLevel();
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
  killAllTerminals();
  killAllLsp();
});

app.on("window-all-closed", () => {
  killAllTerminals();
  killAllLsp();
  if (process.platform !== "darwin") app.quit();
});
