export interface DirtyFile {
  path: string
  name: string
}

let items: DirtyFile[] = []
const subs = new Set<(list: DirtyFile[]) => void>()

export function getDirtyFiles(): DirtyFile[] {
  return items
}

export function setDirtyFiles(list: DirtyFile[]): void {
  const same =
    list.length === items.length &&
    list.every((f, i) => f.path === items[i].path)
  if (same) return
  items = list
  subs.forEach((fn) => fn(items))
}

export function subscribeDirtyFiles(fn: (list: DirtyFile[]) => void): () => void {
  subs.add(fn)
  return () => subs.delete(fn)
}
