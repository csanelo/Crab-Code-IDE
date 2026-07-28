import { emit } from './appEvents'

/**
 * Cross-window workspace sync.
 *
 * The Agent runs in its own BrowserWindow, but its file mutations happen in the
 * main process. Main broadcasts every mutation on the `workspace:changed`
 * channel, so each window (IDE + Agent) refreshes its file tree and reloads the
 * touched file in the editor. That is what makes "edit in Agent -> applied in
 * the IDE" work live, without reopening the file.
 */

let installed = false

function toAbsolute(cwd: string | null, path: string | null): string | null {
  if (!path) return null
  if (/^([a-zA-Z]:[\\/]|\/|ssh:\/\/)/.test(path)) return path
  if (!cwd) return null
  const sep = cwd.includes('\\') ? '\\' : '/'
  const rel = path.replace(/[\\/]/g, sep).replace(new RegExp(`^\\${sep}+`), '')
  return `${cwd.replace(/[\\/]+$/, '')}${sep}${rel}`
}

export function installWorkspaceSync(): void {
  if (installed) return
  installed = true
  const api = (window as unknown as { api?: { workspace?: { onChanged?: (cb: (p: { tool: string; cwd: string | null; path: string | null }) => void) => () => void } } }).api
  const onChanged = api?.workspace?.onChanged
  if (!onChanged) return
  onChanged(({ tool, cwd, path }) => {
    emit('fs:changed', undefined)
    const abs = toAbsolute(cwd, path)
    if (!abs) return
    if (tool === 'write_file' || tool === 'edit_file' || tool === 'move_path' || tool === 'copy_path') {
      emit('editor:agentEdit', { path: abs })
    } else if (tool === 'delete_path') {
      emit('editor:reload', { path: abs })
    }
  })
}
