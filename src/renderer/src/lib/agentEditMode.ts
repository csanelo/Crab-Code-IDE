export type EditMode = 'auto' | 'ask' | 'readonly'

const KEY = 'sreda.agent.editMode'
type EditModeListener = (mode: EditMode) => void
const listeners = new Set<EditModeListener>()

function isEditMode(value: string | null): value is EditMode {
  return value === 'auto' || value === 'ask' || value === 'readonly'
}

function readStored(): EditMode {
  try {
    const saved = localStorage.getItem(KEY)
    if (isEditMode(saved)) return saved
  } catch {
    // Ignore unavailable storage.
  }
  return 'auto'
}

let current: EditMode = readStored()

function publish(mode: EditMode): void {
  current = mode
  for (const listener of listeners) listener(mode)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !isEditMode(event.newValue)) return
    publish(event.newValue)
  })
  window.addEventListener('focus', () => {
    const stored = readStored()
    if (stored !== current) publish(stored)
  })
}

export function getEditMode(): EditMode {
  return current
}

export function setEditMode(mode: EditMode): void {
  publish(mode)
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Storage is best-effort.
  }
}

export function subscribeEditMode(listener: EditModeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
