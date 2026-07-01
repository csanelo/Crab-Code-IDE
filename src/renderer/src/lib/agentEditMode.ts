
export type EditMode = 'auto' | 'ask' | 'readonly'

let current: EditMode = 'auto'

const KEY = 'sreda.agent.editMode'

try {
  const saved = localStorage.getItem(KEY)
  if (saved === 'auto' || saved === 'ask' || saved === 'readonly') current = saved
} catch {
}

export function getEditMode(): EditMode {
  return current
}

export function setEditMode(mode: EditMode): void {
  current = mode
  try {
    localStorage.setItem(KEY, mode)
  } catch {
  }
}
