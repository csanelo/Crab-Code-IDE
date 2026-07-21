import { ipcMain, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import * as pty from "@lydell/node-pty";
import type { IPty } from "@lydell/node-pty";
import type { ClientChannel } from "ssh2";
import { getGeneralSettings } from "./settings";
import { ensureRemote } from "./remote";

interface Session {
  proc?: IPty;
  remote?: ClientChannel;
}

const sessions = new Map<string, Session>();

export function killAllTerminals(): void {
  for (const [id, s] of sessions) {
    if (s.remote) {
      try {
        s.remote.end();
      } catch {}
      sessions.delete(id);
      continue;
    }
    if (!s.proc) {
      sessions.delete(id);
      continue;
    }
    const proc = s.proc;
    const pid = proc.pid;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
          windowsHide: true,
        });
      } else {
        try {
          process.kill(-pid, "SIGTERM");
        } catch {}
        proc.kill("SIGKILL");
      }
    } catch {}
    sessions.delete(id);
  }
}

function shellCommand(): { file: string; args: string[] } {
  const pref = getGeneralSettings().defaultShell;
  const isWin = process.platform === "win32";

  if (pref !== "auto") {
    if (pref === "cmd" && isWin)
      return { file: process.env.ComSpec ?? "cmd.exe", args: [] };
    if (pref === "powershell" && isWin)
      return { file: "powershell.exe", args: [] };
    if (pref === "pwsh") return { file: "pwsh", args: [] };
    if (pref === "gitbash" && isWin) {
      return {
        file: "C:/Program Files/Git/bin/bash.exe",
        args: ["--login", "-i"],
      };
    }
    if (pref === "bash") return { file: "bash", args: [] };
  }

  if (isWin) {
    return { file: process.env.ComSpec ?? "cmd.exe", args: [] };
  }
  return { file: process.env.SHELL ?? "/bin/bash", args: [] };
}

export function registerTerminal(win: BrowserWindow): void {
  ipcMain.handle(
    "terminal:spawn",
    (
      event,
      payload: { id: string; cwd: string | null; cols: number; rows: number },
    ) => {
      const target = event.sender;
      const send = (channel: string, ...args: unknown[]): void => {
        if (!target.isDestroyed()) target.send(channel, ...args);
      };
      const existing = sessions.get(payload.id);
      if (existing) return { pid: existing.proc.pid, reused: true };
      const { file, args } = shellCommand();
      let proc: IPty;
      try {
        proc = pty.spawn(file, args, {
          name: "xterm-256color",
          cwd:
            payload.cwd ??
            process.env.USERPROFILE ??
            process.env.HOME ??
            process.cwd(),
          env: process.env as Record<string, string>,
          cols: Math.max(20, payload.cols | 0) || 80,
          rows: Math.max(5, payload.rows | 0) || 24,
        });
      } catch (err) {
        send(
          "terminal:data",
          payload.id,
          `\r\n\x1b[31mFailed to start shell: ${err instanceof Error ? err.message : String(err)}\x1b[0m\r\n`,
        );
        return { pid: -1, reused: false };
      }

      proc.onData((data) => {
        send("terminal:data", payload.id, data);
      });
      proc.onExit(({ exitCode }) => {
        send("terminal:exit", payload.id, exitCode);
        sessions.delete(payload.id);
      });

      sessions.set(payload.id, { proc });
      return { pid: proc.pid, reused: false };
    },
  );

  ipcMain.handle(
    "terminal:spawn-remote",
    async (
      event,
      payload: {
        id: string;
        connId: string;
        cwd: string | null;
        cols: number;
        rows: number;
      },
    ) => {
      const target = event.sender;
      const send = (channel: string, ...args: unknown[]): void => {
        if (!target.isDestroyed()) target.send(channel, ...args);
      };
      const existing = sessions.get(payload.id);
      if (existing) return { pid: 0, reused: true };
      const conn = await ensureRemote(payload.connId);
      if (!conn) {
        send(
          "terminal:data",
          payload.id,
          `\r\n\x1b[31mRemote host not connected.\x1b[0m\r\n`,
        );
        return { pid: -1, reused: false };
      }
      return await new Promise<{ pid: number; reused: boolean }>((resolve) => {
        conn.client.shell(
          {
            cols: Math.max(20, payload.cols | 0) || 80,
            rows: Math.max(5, payload.rows | 0) || 24,
          },
          (err, stream) => {
            if (err) {
              send(
                "terminal:data",
                payload.id,
                `\r\n\x1b[31m${err.message}\x1b[0m\r\n`,
              );
              resolve({ pid: -1, reused: false });
              return;
            }
            stream.on("data", (d: Buffer) =>
              send("terminal:data", payload.id, d.toString()),
            );
            stream.stderr.on("data", (d: Buffer) =>
              send("terminal:data", payload.id, d.toString()),
            );
            stream.on("close", () => {
              send("terminal:exit", payload.id, 0);
              sessions.delete(payload.id);
            });
            sessions.set(payload.id, { remote: stream });
            if (payload.cwd)
              stream.write(`cd ${JSON.stringify(payload.cwd)}\n`);
            resolve({ pid: 0, reused: false });
          },
        );
      });
    },
  );

  ipcMain.handle("terminal:write", (_e, id: string, data: string) => {
    const s = sessions.get(id);
    if (s?.remote) s.remote.write(data);
    else s?.proc?.write(data);
    return true;
  });

  ipcMain.handle("terminal:interrupt", (_e, id: string) => {
    const s = sessions.get(id);
    if (!s) return false;
    try {
      if (s.remote) s.remote.write("\x03");
      else s.proc?.write("\x03");
    } catch {}
    return true;
  });

  ipcMain.handle(
    "terminal:resize",
    (_e, id: string, cols: number, rows: number) => {
      const s = sessions.get(id);
      if (!s) return false;
      try {
        if (s.remote)
          s.remote.setWindow(
            Math.max(5, rows | 0),
            Math.max(20, cols | 0),
            0,
            0,
          );
        else s.proc?.resize(Math.max(20, cols | 0), Math.max(5, rows | 0));
      } catch {}
      return true;
    },
  );

  ipcMain.handle("terminal:kill", (_e, id: string) => {
    const s = sessions.get(id);
    if (!s) return false;
    if (s.remote) {
      try {
        s.remote.end();
      } catch {}
      sessions.delete(id);
      return true;
    }
    if (!s.proc) {
      sessions.delete(id);
      return true;
    }
    const proc = s.proc;
    const pid = proc.pid;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
          windowsHide: true,
        });
      } else {
        try {
          process.kill(-pid, "SIGTERM");
        } catch {}
        proc.kill("SIGKILL");
      }
    } catch {}
    sessions.delete(id);
    return true;
  });
}
