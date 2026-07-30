export function asset(path: string): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  const base = env?.BASE_URL || '/'
  const clean = path.startsWith('/') ? path.slice(1) : path
  return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`
}
