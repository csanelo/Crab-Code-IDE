import { emit } from './appEvents'

/**
 * Runs a command in the integrated terminal and asks the terminal to watch it:
 * once the command finishes, a 'terminal:result' event is emitted with the exit
 * code and the captured output, so the agent can react to failures.
 */
let counter = 0

export function runCommandWatched(command: string): string {
  counter += 1
  const runId = `run_${Date.now().toString(36)}_${counter}`
  emit('terminal:run', { command, watch: true, runId })
  return runId
}
