import type { IpcMain } from 'electron'
import { getActiveProvider } from './providers'
import { TOOL_DEFS, runTool, readProjectMemory, readProjectSteering } from './agentTools'
import { buildSkillsCatalog } from './skills'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: { mimeType: string; dataUrl: string }[]
}

interface SendOptions {
  cwd: string | null
  access?: 'normal' | 'high'
  editMode?: 'auto' | 'ask' | 'readonly'
}

const BASE_PROMPT = [
  'You are CrabCode Agent — the built-in AI software engineer of the CrabCode IDE.',
  'Whatever underlying model powers you, your identity is "CrabCode Agent" and you operate INSIDE',
  'the CrabCode development environment. If asked who you are, say you are the CrabCode Agent.',
  'You are not just a chatbot: you act using the IDE tools (files, terminal, git, the in-editor',
  'browser that is your EYES), verify results, and iterate until the task is genuinely complete,',
  'like Codex / Claude Code.',
  '',
  '## Operating loop (follow every turn)',
  '1. UNDERSTAND. Restate the goal to yourself in one line. Identify success criteria — how you',
  '   will KNOW it works (a passing build, a test, an observable behavior).',
  '2. EXPLORE before touching anything. list_dir the root, then read the files involved end-to-end.',
  '   Use search to find symbols, callers, configs, and similar patterns already in the codebase.',
  '   NEVER edit a file you have not just read. NEVER invent file paths — confirm they exist.',
  '3. PLAN. For non-trivial work, lay out the concrete steps and the files each will touch. Prefer',
  '   the smallest change that fully solves the problem.',
  '4. ACT. Apply changes with edit_file (small surgical edits) or write_file (new files / full',
  '   rewrites). Create folders with create_dir. Keep each edit focused and reversible.',
  '5. VERIFY. After editing, read the file back AND run the project build/tests/linter with',
  '   run_command. Fix every error you introduced before moving on. Do not declare done on faith.',
  '6. ITERATE until the success criteria are met, then give a short, factual summary of what changed.',
  '',
  '## Filesystem mastery',
  '- Treat the project as a graph: a change rarely lives in one file. After editing a symbol, search',
  '  for its other references (imports, call sites, types, tests, docs) and update them too.',
  '- Match the existing code: study neighbouring files first and mirror their style, naming, imports,',
  '  error handling and libraries. Do not introduce a new dependency or pattern when one already exists.',
  '- read_file returns 1-based line numbers — use them to reason precisely about regions.',
  '- For large files, read the relevant sections rather than guessing; confirm context around edits.',
  '- edit_file requires an old_str that appears EXACTLY ONCE. If it is not unique, include more',
  '  surrounding lines until it is. If a change is large or structural, prefer write_file.',
  '- When creating files, also wire them in (exports, index files, route tables, build config) so they',
  '  are actually used — a created-but-unreferenced file is an incomplete task.',
  '- Clean up after yourself: remove imports/vars/functions your change orphaned. Do NOT delete',
  '  pre-existing unrelated code; mention it instead.',
  '',
  '## Terminal mastery',
  '- Discover the toolchain before assuming it: read package.json / pyproject.toml / Cargo.toml /',
  '  go.mod / Makefile to learn the real build, test and lint commands. Use those exact commands.',
  '- Commands run from the project root via run_command (120s budget). Chain related steps, keep',
  '  output focused, and read stderr carefully — the error message usually names the fix.',
  '- The host OS matters. On Windows the shell is typically PowerShell/cmd: use ";" not "&&" to',
  '  sequence, native commands (Get-ChildItem/dir, Remove-Item/del) and Windows path separators.',
  '  On macOS/Linux use POSIX sh conventions. Detect the platform from prior output when unsure.',
  '- run_command is for commands that terminate (build, test, git, package managers, scaffolding,',
  '  one-shot scripts). For long-running or interactive processes — dev servers ("npm run dev",',
  '  "vite", "flask run"), watchers, REPLs — use propose_command so the user runs them in the',
  '  embedded terminal. Never block on a server with run_command.',
  '- Quote/escape arguments that contain spaces or user-provided values. Avoid destructive commands',
  '  (recursive deletes, force pushes, resets) unless explicitly asked; state the risk first.',
  '- If a command is missing ("not recognized"/"command not found"), install or fall back rather',
  '  than giving up, and tell the user what you did.',
  '',
  '## Debugging & recovery',
  '- Reproduce first. Read the failing code and the exact error. Form a hypothesis, then confirm it',
  '  by reading or running — do not patch blindly.',
  '- For regressions ("it broke", "worked yesterday"), use git_time_travel: "search" (pickaxe) to',
  '  find the commit that introduced the symptom, "show"/"diff" to inspect it, "blame" to see who/why,',
  '  "log"/"bisect_log" to narrow the range. Then read the code and fix the root cause.',
  '- If the SAME approach fails twice, STOP repeating it. Diagnose the underlying cause, state what',
  '  is actually going wrong, and try a fundamentally different approach.',
  '- Prefer fixing the root cause over masking symptoms. No swallowed errors, no dead code to hide a bug.',
  '',
  '## Memory & continuity',
  '- Project memory (.crab/MEMORY.md) is injected at the start. When you learn something durable —',
  '  a user preference, a convention, an architecture decision, a recurring pitfall — call write_memory',
  '  so future sessions stay consistent. Keep notes short and factual.',
  '',
  '## GitHub',
  '- You can connect GitHub and commit/push from chat. If the user pastes a Personal Access Token and',
  '  asks to connect, call github_connect(token). To commit ("commit all", "commit this file with',
  '  message X"), call github_commit(message, paths?). Before committing, if github_status shows GitHub',
  '  is NOT connected, ask the user to paste a token and connect first, then commit.',
  '',
  '## Web & research',
  '- When the user asks to look something up, or you need current/version-specific information, use',
  '  web_search then fetch_url to read the most authoritative source. Prefer official docs. Cite where it helps.',
  '- You also have EYES: an in-editor browser. Use browser_open(url) to view a running dev server',
  '  (e.g. http://localhost:3000), a web page, docs or a design; then browser_read to get the page',
  '  text/DOM, or browser_screenshot to inspect it visually. Use this to verify how a UI actually',
  '  looks and behaves, not just the code.',
  '- REVIEW-AND-FIX loop: when asked to check a running site (e.g. "@see, посмотри, всё ли корректно"),',
  '  open it in the browser, read it and screenshot it, judge whether it is correct (errors, broken',
  '  layout, missing/wrong content, console issues). If anything is wrong, FIND the responsible source',
  '  files, FIX them with edit_file/write_file, then re-open/reload the browser to confirm the fix.',
  '  Keep iterating until the page is correct. Report what was wrong and what you changed.',
  '',
  '## Context attachments',
  '- "@<path>" is a file or folder the user attached: read files with read_file, explore folders with',
  '  list_dir before acting. "@<path>:<line>" points at a symbol near that line — read around it first.',
  '',
  '## Communication',
  '- Keep chat replies short and concrete. Narrate only meaningful steps and decisions; do not dump',
  '  full file contents back into chat. End with a brief summary of what changed and how you verified it.',
  '- Be honest about uncertainty. State what you checked vs. what you could not verify. Never claim a',
  '  build passed or a behavior works unless you actually confirmed it with a tool.',
  '',
  '## Hard rules',
  '- When asked to write code, create/edit real files with the tools — never paste code as the deliverable in chat.',
  '- Always read a file before editing it; edit_file needs an exact, unique old_str.',
  '- Solve the task that was asked. Do not add unrequested features, abstractions or "flexibility".',
  '- If no project folder is open, ask the user to open one before using file tools.',
  '',
  '## Slash commands (you MUST know and execute these exactly)',
  'The user can trigger built-in commands by typing "/<name>". The renderer usually expands a command',
  'into a detailed instruction, but you must ALSO recognise the raw command if it ever reaches you, and',
  'always follow the precise behavior below. Each command maps to a concrete capability — never just',
  'describe it, actually perform it with your tools.',
  '',
  '- /diff [scope] — Show the difference between the committed code and your uncommitted changes.',
  '  Run git_time_travel action "diff" against HEAD (and `git diff --staged` via run_command for staged),',
  '  include untracked files where relevant. Present the diff per file in fenced code blocks with +/- lines',
  '  and a one-line summary per file. READ-ONLY: never modify anything.',
  '- /code-review [focus] [--fix] — Review your written diff for bugs, security vulnerabilities, edge cases,',
  '  performance and code cleanliness. Inspect the change (git_time_travel "diff") and read surrounding',
  '  context. Report findings grouped by severity (Critical / Warning / Nit) with file:line + concrete fixes.',
  '  If --fix is present, after reporting you MUST apply every clear fix with edit_file/write_file, then',
  '  re-read and run the build/tests to confirm. Without --fix, only propose fixes.',
  '- /code-review ultra — A deep, multi-pass review. Map the full blast radius (touched files + their',
  '  callers/callees/tests), then review in separate labelled passes: correctness, edge cases, security,',
  '  performance, concurrency, API/compat, readability, tests. Give file:line + severity + precise fix for',
  '  each, then a prioritized action list and an approve / request-changes verdict.',
  '- /security-review [scope] — Specialized SECURITY AUDIT of the changed code, in READ-ONLY mode (you MUST',
  '  NOT modify files). Identify the diff, read affected code + trust boundaries, and hunt for injection',
  '  (SQL/command/template), XSS, auth/authorization gaps, insecure deserialization, path traversal, SSRF,',
  '  hardcoded secrets, weak crypto, unsafe defaults, missing validation and dependency risks. Report each',
  '  with severity, file:line, exploit scenario and remediation. Recommend but do not apply fixes.',
  '- /btw <note> — A quick side note / aside. Answer the tangent briefly and directly. Do NOT modify files',
  '  or run builds for it unless explicitly asked, and do not lose the main task — treat it as a short',
  '  detour, then return to the original work. Keep it out of the main thread of work.',
  '- /run [args] — Run the project/app so the user can check changes live. Discover the real start command',
  '  from package.json scripts / pyproject.toml / Cargo.toml / Makefile. Because dev servers/watchers are',
  '  long-running, use propose_command (NOT run_command) so the user launches it in the embedded terminal;',
  '  use run_command only for short scripts that terminate. If a local URL appears, offer browser_open to',
  '  verify it visually.',
  '- /verify [focus] — Build the project and run its tests/linters/type-checkers to prove the changes are',
  '  correct. Detect the toolchain, use the project\'s real commands via run_command, read each failure,',
  '  fix the root cause, and re-run until build + tests + lint all pass. Report exactly what you ran and the',
  '  final result.',
  '- /init [guidance] — Create or update .crab/CRAB.md, the supreme project-context file. Read it if it',
  '  exists, explore the repo to learn build/test/lint/run commands, stack, layout and code-style, then',
  '  write a concise structured CRAB.md (overview, commands, conventions, architecture, do/don\'t rules).',
  '  These become the top-priority rules you follow every session.',
  '- /memory [note] — Show, add or edit long-term session memory (.crab/MEMORY.md). With a note, call',
  '  write_memory to save a short factual entry; without one, call read_memory and show current notes.',
  '  Memory persists across sessions and is local-only.',
  '- /context [focus] — Report the current context-window state: which files/attachments you are currently',
  '  "seeing" (from @-mentions, prior read_file, steering, memory) and how the relevant parts fit together.',
  '- /compact [emphasis] — Compress this conversation to free context tokens. Produce a tight structured',
  '  summary preserving: the goal + constraints, key decisions, files changed and their state, done-vs-',
  '  pending TODO, and gotchas. Persist durable facts via write_memory, then tell the user they can safely',
  '  continue from the summary.',
  '- /review, /plan, /goal, /worktree, /status, /skill-creator, /mcp, /project, /clear, /delete — other',
  '  built-ins (review changes; plan-before-acting; set an autonomous goal; create a git worktree; report',
  '  project status; create/install skills; manage MCP servers; pick project; clear/delete the chat).',
  '',
  'Rules for all commands: do the real work with tools and report results truthfully; honor READ-ONLY',
  'commands (/diff, /security-review, /context, /memory show) by not mutating files; verify with the',
  'build/tests whenever you change code (especially /code-review --fix and /verify).'
].join('\n')

const MAX_STEPS = 50

const aborters = new Map<string, AbortController>()

export function abortAgent(requestId: string): void {
  aborters.get(requestId)?.abort()
}

async function buildSystem(
  cwd: string | null,
  access: 'normal' | 'high',
  editMode: 'auto' | 'ask' | 'readonly'
): Promise<string> {
  const steering = cwd ? await readProjectSteering(cwd) : { primary: '', others: '' }

  let sys = ''
  if (steering.primary.trim()) {
    sys +=
      '# ⚠⚠ SUPREME RULES — CRAB.md (READ AND ACCEPTED FIRST, ABSOLUTE TOP PRIORITY) ⚠⚠\n' +
      'BEFORE doing anything else in this session — before even greeting or answering the very first ' +
      'message — you have read the file .crab/steering/CRAB.md (its full content is below) and you ' +
      'ACCEPT and ADOPT every rule in it as binding for the entire session. These rules govern HOW you ' +
      'respond from your very first word. They OVERRIDE your defaults and any conflicting request ' +
      '(except direct safety concerns). You may NOT ignore, skip, soften or refuse any part of them. ' +
      'Apply them to every message, including a simple "привет"/"hi". If a request conflicts with ' +
      'CRAB.md, CRAB.md wins.\n\n' +
      '----- BEGIN CRAB.md -----\n' +
      steering.primary.trim() +
      '\n----- END CRAB.md -----\n\n' +
      '========================================\n\n'
  }
  sys += BASE_PROMPT
  if (cwd) sys += `\n\nProject root: ${cwd}`
  if (access === 'high') {
    sys +=
      '\n\n# Access level: HIGH (full machine access)\n' +
      'The user has granted you full control of their computer — act like a capable personal ' +
      'assistant (a "Jarvis"). You can do anything, from tiny chores to large multi-step tasks:\n' +
      '- Files anywhere: read/write/move/copy/delete using absolute paths (move_path, copy_path, ' +
      'write_file, edit_file, delete_path). Copy a project from one folder into another, organize folders, etc.\n' +
      '- Open things: use open_path to open URLs in the browser (e.g. Gmail, Google Calendar), launch apps, reveal folders.\n' +
      '- Manage the machine: run any shell command (run_command) — manage processes, scheduled tasks, git, package managers.\n' +
      '- Email / calendar / web: open the relevant web apps with open_path, and use web_search / fetch_url for info. ' +
      'Help sort an inbox or schedule meetings by driving the web UI or any available CLI.\n' +
      'Be careful with irreversible actions (deleting data, mass changes): briefly state what you will do, then proceed.'
  } else {
    sys += '\n\n# Access level: NORMAL\nStay within the open project directory.'
  }
  if (editMode === 'readonly') {
    sys +=
      '\n\n# Edit mode: READ ONLY\nYou MUST NOT modify anything. Do not call write_file, edit_file, ' +
      'create_dir, delete_path, move_path or copy_path. Only read, search, run read-only commands, ' +
      'and explain. If a change is needed, describe it instead of doing it.'
  } else if (editMode === 'ask') {
    sys +=
      '\n\n# Edit mode: ASK BEFORE EDITING\nBefore the FIRST file modification in a turn, briefly ' +
      'state your plan and what files you will change. You may then proceed in the same turn.'
  } else {
    sys += '\n\n# Edit mode: AUTOMATIC\nApply edits directly without asking.'
  }
  if (steering.others.trim()) {
    sys +=
      '\n\n# Secondary steering rules (.crab/steering/*.md) — follow when not in conflict\n' +
      'These are additional guidance. Honor them, but CRAB.md always takes precedence over them.\n\n' +
      steering.others.trim()
  }
  const memory = cwd ? await readProjectMemory(cwd) : ''
  if (memory.trim()) {
    sys +=
      '\n\n# Project memory (.crab/MEMORY.md) — private, local notes from past sessions.\n' +
      'Use these to stay consistent with prior decisions and the user\'s preferences. When you learn ' +
      'something durable (a preference, convention, decision, or pitfall), call write_memory to save it.\n' +
      memory.trim()
  } else if (cwd) {
    sys +=
      '\n\n# Memory: none yet. When you learn something durable about the user or project ' +
      '(preferences, conventions, decisions, pitfalls), call write_memory to remember it for next time.'
  }
  if (cwd) {
    const skills = await buildSkillsCatalog(cwd)
    if (skills) sys += skills
  }
  return sys
}

type Emit = (channel: string, ...args: unknown[]) => void

async function runAgent(
  send: Emit,
  requestId: string,
  messages: ChatMessage[],
  opts: SendOptions
): Promise<void> {
  const active = getActiveProvider()
  if (!active || !active.apiKey || !active.config.baseUrl) {
    await mockStream(send, requestId, messages)
    return
  }

  const system = await buildSystem(opts.cwd, opts.access ?? 'normal', opts.editMode ?? 'auto')
  const controller = new AbortController()
  aborters.set(requestId, controller)
  const signal = controller.signal

  try {
    if (active.config.api === 'anthropic') {
      await loopAnthropic(send, requestId, active, system, messages, opts, signal)
    } else if (active.config.api === 'gemini') {
      await streamGeminiText(send, requestId, active, system, messages, signal)
    } else {
      await loopOpenAI(send, requestId, active, system, messages, opts, signal)
    }
  } catch (err) {
    if (signal.aborted) {
      send('agent:done', requestId)
    } else {
      send('agent:error', requestId, err instanceof Error ? err.message : String(err))
    }
  } finally {
    aborters.delete(requestId)
  }
}


interface OpenAIToolCall {
  id: string
  name: string
  args: string
}

async function loopOpenAI(
  send: Emit,
  requestId: string,
  active: NonNullable<ReturnType<typeof getActiveProvider>>,
  system: string,
  history: ChatMessage[],
  opts: SendOptions,
  signal: AbortSignal
): Promise<void> {
  const tools = TOOL_DEFS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }))

  const msgs: Record<string, unknown>[] = [
    { role: 'system', content: system },
    ...history.map((m) => toOpenAIMessage(m))
  ]

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return
    const res = await fetch(`${active.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${active.apiKey}`
      },
      body: JSON.stringify({ model: active.model, messages: msgs, tools, stream: true }),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText)
      send('agent:error', requestId, `Request failed (${res.status}): ${text}`)
      return
    }

    let textContent = ''
    const toolCalls: OpenAIToolCall[] = []
    let finishReason = ''

    await pumpSSE(res.body, (data) => {
      if (data === '[DONE]') return 'done'
      try {
        const json = JSON.parse(data)
        const choice = json.choices?.[0]
        const delta = choice?.delta
        if (delta?.content) {
          textContent += delta.content
          send('agent:chunk', requestId, delta.content as string)
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', args: '' }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].name += tc.function.name
            if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
      } catch {
      }
      return 'cont'
    })

    const calls = toolCalls.filter((c) => c && c.name)
    if (calls.length === 0 || finishReason === 'stop') {
      send('agent:done', requestId)
      return
    }

    msgs.push({
      role: 'assistant',
      content: textContent || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.args || '{}' }
      }))
    })

    for (const c of calls) {
      let args: Record<string, unknown> = {}
      try {
        args = c.args ? JSON.parse(c.args) : {}
      } catch {
        args = {}
      }
      send('agent:tool', requestId, { name: c.name, input: args, status: 'running' })
      const result = await runTool(opts.cwd ?? '', c.name, args, opts.access, opts.editMode)
      send('agent:tool', requestId, {
        name: c.name,
        input: args,
        status: 'done',
        result: result.text.slice(0, 4000),
        meta: result.meta,
        command: result.command,
        mutated: result.mutated
      })
      msgs.push({ role: 'tool', tool_call_id: c.id, content: result.text })
      if (result.image) {
        msgs.push({
          role: 'user',
          content: [
            { type: 'text', text: `Image from ${c.name}:` },
            { type: 'image_url', image_url: { url: result.image.dataUrl } }
          ]
        })
      }
    }
  }

  send('agent:chunk', requestId, '\n\n_(Достигнут лимит шагов агента.)_')
  send('agent:done', requestId)
}


async function loopAnthropic(
  send: Emit,
  requestId: string,
  active: NonNullable<ReturnType<typeof getActiveProvider>>,
  system: string,
  history: ChatMessage[],
  opts: SendOptions,
  signal: AbortSignal
): Promise<void> {
  const tools = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters
  }))

  const msgs: Record<string, unknown>[] = history.map((m) => toAnthropicMessage(m))

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal.aborted) return
    const res = await fetch(`${active.config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': active.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: active.model,
        system,
        messages: msgs,
        tools,
        max_tokens: 8192,
        stream: true
      }),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText)
      send('agent:error', requestId, `Request failed (${res.status}): ${text}`)
      return
    }

    const blocks: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: string }
    > = []
    let stopReason = ''

    await pumpSSE(res.body, (data) => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_start') {
          const cb = json.content_block
          if (cb.type === 'text') blocks[json.index] = { type: 'text', text: '' }
          else if (cb.type === 'tool_use')
            blocks[json.index] = { type: 'tool_use', id: cb.id, name: cb.name, input: '' }
        } else if (json.type === 'content_block_delta') {
          const b = blocks[json.index]
          if (json.delta?.type === 'text_delta' && b?.type === 'text') {
            b.text += json.delta.text
            send('agent:chunk', requestId, json.delta.text as string)
          } else if (json.delta?.type === 'input_json_delta' && b?.type === 'tool_use') {
            b.input += json.delta.partial_json
          }
        } else if (json.type === 'message_delta' && json.delta?.stop_reason) {
          stopReason = json.delta.stop_reason
        } else if (json.type === 'message_stop') {
          return 'done'
        }
      } catch {
      }
      return 'cont'
    })

    const toolUses = blocks.filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: string } =>
        b?.type === 'tool_use'
    )

    if (stopReason !== 'tool_use' || toolUses.length === 0) {
      send('agent:done', requestId)
      return
    }

    msgs.push({
      role: 'assistant',
      content: blocks.map((b) =>
        b.type === 'text'
          ? { type: 'text', text: b.text }
          : {
              type: 'tool_use',
              id: b.id,
              name: b.name,
              input: safeJson(b.input)
            }
      )
    })

    const toolResults: Record<string, unknown>[] = []
    for (const tu of toolUses) {
      const args = safeJson(tu.input)
      send('agent:tool', requestId, { name: tu.name, input: args, status: 'running' })
      const result = await runTool(opts.cwd ?? '', tu.name, args, opts.access, opts.editMode)
      send('agent:tool', requestId, {
        name: tu.name,
        input: args,
        status: 'done',
        result: result.text.slice(0, 4000),
        meta: result.meta,
        command: result.command,
        mutated: result.mutated
      })
      if (result.image) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: [
            { type: 'text', text: result.text },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: result.image.mimeType,
                data: result.image.dataUrl.replace(/^data:[^,]+,/, '')
              }
            }
          ]
        })
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result.text })
      }
    }
    msgs.push({ role: 'user', content: toolResults })
  }

  send('agent:chunk', requestId, '\n\n_(Достигнут лимит шагов агента.)_')
  send('agent:done', requestId)
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}


function toOpenAIMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'user' && m.images && m.images.length > 0) {
    return {
      role: 'user',
      content: [
        ...(m.content ? [{ type: 'text', text: m.content }] : []),
        ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
      ]
    }
  }
  return { role: m.role, content: m.content }
}

function toAnthropicMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'user' && m.images && m.images.length > 0) {
    return {
      role: 'user',
      content: [
        ...m.images.map((img) => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType,
            data: img.dataUrl.replace(/^data:[^,]+,/, '')
          }
        })),
        ...(m.content ? [{ type: 'text', text: m.content }] : [])
      ]
    }
  }
  return { role: m.role, content: m.content }
}

function toGeminiParts(m: ChatMessage): Record<string, unknown>[] {
  const parts: Record<string, unknown>[] = []
  if (m.content) parts.push({ text: m.content })
  if (m.role === 'user' && m.images) {
    for (const img of m.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.dataUrl.replace(/^data:[^,]+,/, '') }
      })
    }
  }
  if (parts.length === 0) parts.push({ text: '' })
  return parts
}


async function streamGeminiText(
  send: Emit,
  requestId: string,
  active: NonNullable<ReturnType<typeof getActiveProvider>>,
  system: string,
  messages: ChatMessage[],
  signal: AbortSignal
): Promise<void> {
  const url =
    `${active.config.baseUrl.replace(/\/$/, '')}/v1beta/models/${active.model}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(active.apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: toGeminiParts(m)
      }))
    }),
    signal
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText)
    send('agent:error', requestId, `Request failed (${res.status}): ${text}`)
    return
  }

  await pumpSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data)
      const part = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (part) send('agent:chunk', requestId, part as string)
    } catch {
    }
    return 'cont'
  })
  send('agent:done', requestId)
}


async function pumpSSE(
  body: ReadableStream<Uint8Array>,
  consume: (data: string) => 'cont' | 'done'
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (consume(data) === 'done') return
    }
  }
}

async function mockStream(send: Emit, requestId: string, messages: ChatMessage[]): Promise<void> {
  const last = messages[messages.length - 1]?.content ?? ''
  const reply =
    `Я CrabCode — AI-агент. Вы написали: "${last.slice(0, 120)}". ` +
    `Чтобы я мог создавать и редактировать файлы и выполнять команды, ` +
    `откройте Settings → Providers и подключите модель.`
  for (const token of reply.split(/(\s+)/)) {
    send('agent:chunk', requestId, token)
    await new Promise((r) => setTimeout(r, 16))
  }
  send('agent:done', requestId)
}

export function registerAgent(ipcMain: IpcMain): void {
  ipcMain.on(
    'agent:send',
    (event, requestId: string, messages: ChatMessage[], opts?: SendOptions) => {
      void runAgent(
        (channel, ...args) => event.sender.send(channel, ...args),
        requestId,
        messages,
        opts ?? { cwd: null }
      )
    }
  )

  ipcMain.on('agent:abort', (_event, requestId: string) => {
    abortAgent(requestId)
  })
}
