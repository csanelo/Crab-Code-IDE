import type { AppState } from './appReducer'

const STORAGE_KEY = 'sreda.app.v3'

function seedState(): AppState {
  return {
    repositories: [],
    conversations: {},
    activeRepositoryId: null,
    activeConversationId: null,
    view: 'chat',
    changes: {}
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.repositories || !parsed.conversations) return seedState()
    if (parsed.activeRepositoryId === undefined) {
      parsed.activeRepositoryId = parsed.repositories[0]?.id ?? null
    }
    if (!parsed.changes) parsed.changes = {}

    const ownedIds = new Set<string>()
    for (const repo of parsed.repositories) {
      for (const id of repo.conversationIds) ownedIds.add(id)
    }
    const cleanedConversations: typeof parsed.conversations = {}
    for (const [id, conv] of Object.entries(parsed.conversations)) {
      if (ownedIds.has(id)) cleanedConversations[id] = conv
    }
    parsed.conversations = cleanedConversations

    if (
      parsed.activeRepositoryId &&
      !parsed.repositories.some((r) => r.id === parsed.activeRepositoryId)
    ) {
      parsed.activeRepositoryId = parsed.repositories[0]?.id ?? null
    }
    if (
      parsed.activeConversationId &&
      !cleanedConversations[parsed.activeConversationId]
    ) {
      parsed.activeConversationId = null
    }

    return parsed
  } catch {
    return seedState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
  }
}
