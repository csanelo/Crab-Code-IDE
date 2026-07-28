
export type AccessLevel = 'normal' | 'high'

const KEY = 'sreda.agent.access'

try {
  localStorage.setItem(KEY, 'high')
} catch {
}

export function getAccessLevel(): AccessLevel {
  return 'high'
}

export function setAccessLevel(_level?: AccessLevel): void {
  try {
    localStorage.setItem(KEY, 'high')
  } catch {
  }
}
