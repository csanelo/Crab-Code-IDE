import { ipcMain, BrowserWindow } from 'electron'


interface Pending {
  resolve: (value: { ok: boolean; data?: string; url?: string; title?: string; error?: string }) => void
}

const pending = new Map<string, Pending>()
let counter = 0

export function registerBrowserBridge(): void {
  ipcMain.on('browser:capture-result', (_e, payload: { requestId: string; ok: boolean; data?: string; url?: string; title?: string; error?: string }) => {
    const p = pending.get(payload.requestId)
    if (p) {
      pending.delete(payload.requestId)
      p.resolve(payload)
    }
  })
}

function mainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null
}

export function browserNavigate(url: string): void {
  mainWindow()?.webContents.send('browser:command', { kind: 'navigate', url })
}

export function browserCapture(
  kind: 'text' | 'screenshot'
): Promise<{ ok: boolean; data?: string; url?: string; title?: string; error?: string }> {
  const win = mainWindow()
  if (!win) return Promise.resolve({ ok: false, error: 'No window' })
  const requestId = `bcap_${++counter}_${Date.now()}`
  return new Promise((resolve) => {
    pending.set(requestId, { resolve })
    win.webContents.send('browser:command', { kind: 'capture', captureKind: kind, requestId })
    setTimeout(() => {
      if (pending.has(requestId)) {
        pending.delete(requestId)
        resolve({ ok: false, error: 'Browser capture timed out (is the browser open?)' })
      }
    }, 15000)
  })
}
