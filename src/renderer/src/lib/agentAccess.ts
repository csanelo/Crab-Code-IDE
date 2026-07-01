
export type AccessLevel = 'normal' | 'high'

let current: AccessLevel = 'normal'

const KEY = 'sreda.agent.access'

try {
  const saved = localStorage.getItem(KEY)
  if (saved === 'high' || saved === 'normal') current = saved
} catch {
}

export function getAccessLevel(): AccessLevel {
  return current
}

export function setAccessLevel(level: AccessLevel): void {
  current = level
  try {
    localStorage.setItem(KEY, level)
  } catch {
  }
}
