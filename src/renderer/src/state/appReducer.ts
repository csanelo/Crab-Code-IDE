import type { Conversation, ID, Repository, View, FileChange } from '../domain/types'
import { createId } from '../domain/ids'
import { translate } from '../i18n'

export interface AppState {
  repositories: Repository[]
  conversations: Record<ID, Conversation>
  activeRepositoryId: ID | null
  activeConversationId: ID | null
  view: View
  changes: Record<ID, FileChange[]>
}

export type Action =
  | { type: 'INIT'; payload: AppState }
  | { type: 'CREATE_CONVERSATION'; repositoryId: ID | null }
  | { type: 'ADD_CONVERSATION'; conversation: Conversation }
  | { type: 'SELECT_CONVERSATION'; id: ID }
  | { type: 'RENAME_CONVERSATION'; id: ID; title: string }
  | { type: 'DELETE_CONVERSATION'; id: ID }
  | { type: 'CLEAR_CONVERSATION'; id: ID }
  | { type: 'TOGGLE_PIN_CONVERSATION'; id: ID }
  | { type: 'OPEN_PROJECT'; repository: Repository }
  | { type: 'SELECT_PROJECT'; id: ID }
  | { type: 'DELETE_PROJECT'; id: ID }
  | { type: 'RENAME_PROJECT'; id: ID; name: string }
  | { type: 'TOGGLE_PIN_PROJECT'; id: ID }
  | {
      type: 'ADD_MESSAGE'
      conversationId: ID
      messageId: ID
      role: 'user' | 'assistant'
      content: string
      streaming?: boolean
      attachments?: import('../domain/types').Attachment[]
    }
  | { type: 'APPEND_CHUNK'; conversationId: ID; messageId: ID; chunk: string }
  | {
      type: 'TOOL_EVENT'
      conversationId: ID
      messageId: ID
      repositoryId: ID | null
      tool: import('../domain/types').ToolCall
    }
  | { type: 'CLEAR_CHANGES'; repositoryId: ID }
  | { type: 'REMOVE_CHANGE'; repositoryId: ID; path: string }
  | { type: 'RECORD_CHANGE'; repositoryId: ID; change: import('../domain/types').FileChange }
  | { type: 'FINISH_MESSAGE'; conversationId: ID; messageId: ID }
  | { type: 'FAIL_MESSAGE'; conversationId: ID; messageId: ID; error: string }
  | { type: 'SET_VIEW'; view: View }

function touch(conv: Conversation): Conversation {
  return { ...conv, updatedAt: Date.now() }
}

function deriveTitle(content: string): string {
  const clean = content.trim()
  if (!clean) return translate('chat.newChat')
  const first = clean.split(/\s+/)[0].replace(/^[^\p{L}\p{N}/_-]+|[^\p{L}\p{N}/_-]+$/gu, '')
  return first || translate('chat.newChat')
}

export function newConversation(repositoryId: ID | null): Conversation {
  const now = Date.now()
  return {
    id: createId('conv_'),
    title: translate('chat.newChat'),
    repositoryId,
    messages: [],
    createdAt: now,
    updatedAt: now
  }
}

export function newRepository(
  name: string,
  path: string | null,
  source: 'folder' | 'github' | 'ssh' = 'folder'
): Repository {
  return {
    id: createId('repo_'),
    name,
    path,
    conversationIds: [],
    source
  }
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT':
      return action.payload

    case 'CREATE_CONVERSATION': {
      const conv = newConversation(action.repositoryId)
      const repositories = action.repositoryId
        ? state.repositories.map((r) =>
            r.id === action.repositoryId
              ? { ...r, conversationIds: [conv.id, ...r.conversationIds] }
              : r
          )
        : state.repositories
      return {
        ...state,
        repositories,
        conversations: { ...state.conversations, [conv.id]: conv },
        activeConversationId: conv.id,
        view: 'chat'
      }
    }

    case 'ADD_CONVERSATION': {
      const conv = action.conversation
      const repositories = conv.repositoryId
        ? state.repositories.map((r) =>
            r.id === conv.repositoryId
              ? { ...r, conversationIds: [conv.id, ...r.conversationIds] }
              : r
          )
        : state.repositories
      return {
        ...state,
        repositories,
        conversations: { ...state.conversations, [conv.id]: conv },
        activeConversationId: conv.id,
        view: 'chat'
      }
    }

    case 'SELECT_CONVERSATION':
      return { ...state, activeConversationId: action.id, view: 'chat' }

    case 'OPEN_PROJECT': {
      const existing = action.repository.path
        ? state.repositories.find((r) => r.path === action.repository.path)
        : undefined
      if (existing) {
        return { ...state, activeRepositoryId: existing.id, view: 'chat' }
      }
      return {
        ...state,
        repositories: [...state.repositories, action.repository],
        activeRepositoryId: action.repository.id,
        activeConversationId: null,
        view: 'chat'
      }
    }

    case 'SELECT_PROJECT': {
      const repo = state.repositories.find((r) => r.id === action.id)
      if (!repo) return state
      return {
        ...state,
        activeRepositoryId: action.id,
        activeConversationId: repo.conversationIds[0] ?? null,
        view: 'chat'
      }
    }

    case 'RENAME_PROJECT': {
      return {
        ...state,
        repositories: state.repositories.map((r) =>
          r.id === action.id ? { ...r, name: action.name } : r
        )
      }
    }

    case 'TOGGLE_PIN_PROJECT': {
      return {
        ...state,
        repositories: state.repositories.map((r) =>
          r.id === action.id ? { ...r, pinned: !r.pinned } : r
        )
      }
    }

    case 'DELETE_PROJECT': {
      const repo = state.repositories.find((r) => r.id === action.id)
      if (!repo) return state
      const conversations = { ...state.conversations }
      for (const cid of repo.conversationIds) delete conversations[cid]
      const repositories = state.repositories.filter((r) => r.id !== action.id)
      const activeRepositoryId =
        state.activeRepositoryId === action.id
          ? (repositories[0]?.id ?? null)
          : state.activeRepositoryId
      const activeConversationId =
        state.activeConversationId && conversations[state.activeConversationId]
          ? state.activeConversationId
          : null
      return { ...state, repositories, conversations, activeRepositoryId, activeConversationId }
    }

    case 'RENAME_CONVERSATION': {
      const conv = state.conversations[action.id]
      if (!conv) return state
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.id]: touch({ ...conv, title: action.title })
        }
      }
    }

    case 'DELETE_CONVERSATION': {
      const { [action.id]: _removed, ...rest } = state.conversations
      const repositories = state.repositories.map((r) => ({
        ...r,
        conversationIds: r.conversationIds.filter((cid) => cid !== action.id)
      }))
      const activeConversationId =
        state.activeConversationId === action.id ? null : state.activeConversationId
      return { ...state, conversations: rest, repositories, activeConversationId }
    }

    case 'TOGGLE_PIN_CONVERSATION': {
      const conv = state.conversations[action.id]
      if (!conv) return state
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.id]: { ...conv, pinned: !conv.pinned }
        }
      }
    }

    case 'CLEAR_CONVERSATION': {
      const conv = state.conversations[action.id]
      if (!conv) return state
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [action.id]: touch({ ...conv, messages: [] })
        }
      }
    }

    case 'ADD_MESSAGE': {
      const conv = state.conversations[action.conversationId]
      if (!conv) return state
      const isFirstUserMessage = action.role === 'user' && conv.messages.length === 0
      const updated: Conversation = touch({
        ...conv,
        title: isFirstUserMessage ? deriveTitle(action.content) : conv.title,
        messages: [
          ...conv.messages,
          {
            id: action.messageId,
            role: action.role,
            content: action.content,
            createdAt: Date.now(),
            streaming: action.streaming,
            attachments: action.attachments
          }
        ]
      })
      return {
        ...state,
        conversations: { ...state.conversations, [action.conversationId]: updated }
      }
    }

    case 'APPEND_CHUNK': {
      const conv = state.conversations[action.conversationId]
      if (!conv) return state
      const updated: Conversation = {
        ...conv,
        messages: conv.messages.map((m) => {
          if (m.id !== action.messageId) return m
          const segments = m.segments ? [...m.segments] : []
          const lastSeg = segments[segments.length - 1]
          if (lastSeg && lastSeg.kind === 'text') {
            segments[segments.length - 1] = { kind: 'text', text: lastSeg.text + action.chunk }
          } else {
            segments.push({ kind: 'text', text: action.chunk })
          }
          return { ...m, content: m.content + action.chunk, segments }
        })
      }
      return {
        ...state,
        conversations: { ...state.conversations, [action.conversationId]: updated }
      }
    }

    case 'TOOL_EVENT': {
      const conv = state.conversations[action.conversationId]
      if (!conv) return state
      const updatedConv: Conversation = {
        ...conv,
        messages: conv.messages.map((m) => {
          if (m.id !== action.messageId) return m
          const calls = m.toolCalls ? [...m.toolCalls] : []
          const segments = m.segments ? [...m.segments] : []
          if (action.tool.status === 'done') {
            const idx = [...calls]
              .reverse()
              .findIndex((c) => c.name === action.tool.name && c.status === 'running')
            if (idx >= 0) {
              const realIdx = calls.length - 1 - idx
              calls[realIdx] = action.tool
              const segIdx = [...segments]
                .reverse()
                .findIndex(
                  (s) => s.kind === 'tool' && s.tool.name === action.tool.name && s.tool.status === 'running'
                )
              if (segIdx >= 0) {
                const realSeg = segments.length - 1 - segIdx
                segments[realSeg] = { kind: 'tool', tool: action.tool }
              }
              return { ...m, toolCalls: calls, segments }
            }
          }
          calls.push(action.tool)
          segments.push({ kind: 'tool', tool: action.tool })
          return { ...m, toolCalls: calls, segments }
        })
      }

      let changes = state.changes
      const meta = action.tool.meta
      if (action.tool.status === 'done' && meta && action.repositoryId) {
        const repoId = action.repositoryId
        const prev = changes[repoId] ?? []
        const existingIdx = prev.findIndex((c) => c.path === meta.path)
        const entry: FileChange = {
          path: meta.path,
          added: meta.added,
          removed: meta.removed,
          diff: meta.diff,
          updatedAt: Date.now(),
          before: meta.before ?? '',
          existed: meta.existed ?? false
        }
        let nextList: FileChange[]
        if (existingIdx >= 0) {
          const merged: FileChange = {
            ...entry,
            added: prev[existingIdx].added + meta.added,
            removed: prev[existingIdx].removed + meta.removed,
            before: prev[existingIdx].before,
            existed: prev[existingIdx].existed
          }
          nextList = [merged, ...prev.filter((_, i) => i !== existingIdx)]
        } else {
          nextList = [entry, ...prev]
        }
        changes = { ...changes, [repoId]: nextList }
      }

      return {
        ...state,
        conversations: { ...state.conversations, [action.conversationId]: updatedConv },
        changes
      }
    }

    case 'CLEAR_CHANGES': {
      const { [action.repositoryId]: _drop, ...rest } = state.changes
      return { ...state, changes: rest }
    }

    case 'REMOVE_CHANGE': {
      const list = state.changes[action.repositoryId]
      if (!list) return state
      const next = list.filter((c) => c.path !== action.path)
      return { ...state, changes: { ...state.changes, [action.repositoryId]: next } }
    }

    case 'RECORD_CHANGE': {
      const repoId = action.repositoryId
      const prev = state.changes[repoId] ?? []
      const c = action.change
      const existingIdx = prev.findIndex((x) => x.path === c.path)
      let nextList: FileChange[]
      if (existingIdx >= 0) {
        const merged: FileChange = {
          ...c,
          before: prev[existingIdx].before,
          existed: prev[existingIdx].existed
        }
        nextList = [merged, ...prev.filter((_, i) => i !== existingIdx)]
      } else {
        nextList = [c, ...prev]
      }
      return { ...state, changes: { ...state.changes, [repoId]: nextList } }
    }

    case 'FINISH_MESSAGE': {
      const conv = state.conversations[action.conversationId]
      if (!conv) return state
      const now = Date.now()
      const updated: Conversation = touch({
        ...conv,
        messages: conv.messages.map((m) => {
          if (m.id !== action.messageId) return m
          const tokens = Math.max(1, Math.round(m.content.length / 4))
          return {
            ...m,
            streaming: false,
            durationMs: now - m.createdAt,
            tokens
          }
        })
      })
      return {
        ...state,
        conversations: { ...state.conversations, [action.conversationId]: updated }
      }
    }

    case 'FAIL_MESSAGE': {
      const conv = state.conversations[action.conversationId]
      if (!conv) return state
      const updated: Conversation = {
        ...conv,
        messages: conv.messages.map((m) =>
          m.id === action.messageId ? { ...m, streaming: false, error: action.error } : m
        )
      }
      return {
        ...state,
        conversations: { ...state.conversations, [action.conversationId]: updated }
      }
    }

    case 'SET_VIEW':
      return { ...state, view: action.view }

    default:
      return state
  }
}
