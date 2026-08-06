import { emit, on, type TerminalRunRequest } from './appEvents'

/**
 * Runs a command in the integrated terminal and asks the terminal to watch it:
 * once the command finishes, a 'terminal:result' event is emitted with the exit
 * code and the captured output, so the agent can react to failures.
 */
let counter = 0
let activeRunId: string | null = null
const pendingRuns: TerminalRunRequest[] = []

function dispatchRun(request: TerminalRunRequest): void {
  activeRunId = request.runId ?? null
  emit('terminal:run', request)
}

on('terminal:result', (result) => {
  if (result.runId !== activeRunId) return
  activeRunId = null
  const next = pendingRuns.shift()
  if (next) dispatchRun(next)
})

export function runCommandWatched(command: string): string {
  counter += 1
  const runId = `run_${Date.now().toString(36)}_${counter}`
  const request = { command, watch: true, runId }
  if (activeRunId) pendingRuns.push(request)
  else dispatchRun(request)
  return runId
}
