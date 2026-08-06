export interface TerminalExecutionRecord {
  runId: string
  command: string
  cwd: string | null
  projectRoot: string | null
  ok: boolean
  exitCode: number | null
  output: string
  finishedAt: number
}

const STORAGE_KEY = 'crabcode.terminal.knowledge.v1'
const MAX_RECORDS = 80

function loadRecords(): TerminalExecutionRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is TerminalExecutionRecord =>
      item && typeof item.command === 'string' && typeof item.ok === 'boolean'
    )
  } catch {
    return []
  }
}

export function rememberTerminalExecution(record: TerminalExecutionRecord): void {
  try {
    const records = loadRecords().filter((item) => item.runId !== record.runId)
    records.push({ ...record, output: record.output.slice(-4000) })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)))
  } catch {
    // Terminal memory is an optimisation; execution must still work without storage.
  }
}

export function terminalKnowledgeContext(projectRoot: string | null): string {
  const allRecords = loadRecords()
  const records = projectRoot
    ? allRecords.filter((item) =>
        item.projectRoot === projectRoot ||
        (!item.projectRoot && Boolean(item.cwd?.startsWith(projectRoot)))
      )
    : allRecords
  const currentCwd = records[records.length - 1]?.cwd ?? projectRoot
  if (!records.length) {
    return currentCwd
      ? `# Integrated terminal context\nCurrent terminal working directory: ${currentCwd}\nNo commands have been completed from a Run card in this directory yet.`
      : ''
  }

  const sameDirectory = records.filter((item) => item.cwd === currentCwd).slice(-12)
  const otherDirectories = [...new Set(
    records.map((item) => item.cwd).filter((cwd): cwd is string => Boolean(cwd && cwd !== currentCwd)),
  )].slice(-6)
  const lines = sameDirectory.map((item) => {
    const status = item.ok ? 'SUCCESS' : `FAILED(exit ${item.exitCode ?? 'unknown'})`
    const evidence = item.output.trim().split('\n').slice(-2).join(' | ').slice(0, 280)
    return `- ${status}: ${item.command}${evidence ? ` — ${evidence}` : ''}`
  })

  return [
    '# Integrated terminal execution memory',
    `Current terminal working directory: ${currentCwd ?? '(unknown)'}`,
    'Only commands listed under this exact directory were actually run by the user. Do not treat commands from another directory as verified here.',
    ...(lines.length ? ['Commands completed in this exact directory:', ...lines] : ['No Run-card command has completed in this exact directory yet.']),
    ...(projectRoot ? [`Active project root: ${projectRoot}`] : []),
    ...(otherDirectories.length ? [`Other known directories inside this project (their results do not apply to the current directory): ${otherDirectories.join(', ')}`] : []),
    'Reuse successful commands when appropriate. Do not repeat a successful command unless verification is necessary. Never claim an unexecuted command succeeded.',
  ].join('\n')
}
