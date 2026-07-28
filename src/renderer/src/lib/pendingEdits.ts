export interface PendingEdit {
  id: string
  path: string
  name: string
  startLine: number
  endLine: number
  /** The code that was replaced - restored when the user picks Undo. */
  before: string
  /** The code the model produced - used to validate the edit is still there. */
  after: string
  /** File contents before the edit, so Changes can show a real diff. */
  fileBefore: string
}

const KEY = 'crabcode.pendingEdits'

function load(): PendingEdit[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingEdit[]) : []
  } catch {
    return []
  }
}

let items: PendingEdit[] = load()
const subs = new Set<(list: PendingEdit[]) => void>()

function publish(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage is best-effort */
  }
  subs.forEach((fn) => fn(items))
}

export function getPendingEdits(): PendingEdit[] {
  return items
}

export function getPendingEditFor(path: string): PendingEdit | undefined {
  return items.find((x) => x.path === path)
}

export function addPendingEdit(edit: PendingEdit): void {
  items = [...items.filter((x) => x.path !== edit.path), edit]
  publish()
}

export function removePendingEdit(id: string): void {
  const next = items.filter((x) => x.id !== id)
  if (next.length === items.length) return
  items = next
  publish()
}

export function clearPendingEdits(): void {
  if (items.length === 0) return
  items = []
  publish()
}

export function subscribePendingEdits(fn: (list: PendingEdit[]) => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}
