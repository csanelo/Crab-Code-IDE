import type { AppState } from './appReducer'

export const STORAGE_KEY = 'sreda.app.v3'

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

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.repositories || !parsed.conversations) return null
    if (parsed.activeRepositoryId === undefined) {
      parsed.activeRepositoryId = parsed.repositories[0]?.id ?? null
    }
    if (!parsed.changes) parsed.changes = {}

    // Conversations are durable records. A session may temporarily be detached
    // when its project is removed, then restored when the same folder reopens.
    const repositoryPaths = new Map(
      parsed.repositories.map((repo) => [repo.id, repo.path] as const),
    )
    for (const conversation of Object.values(parsed.conversations)) {
      if (conversation.repositoryPath === undefined) {
        conversation.repositoryPath = conversation.repositoryId
          ? (repositoryPaths.get(conversation.repositoryId) ?? null)
          : null
      }
    }
    const cleanedConversations = parsed.conversations

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
    return null
  }
}

export function loadState(): AppState {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY)) ?? seedState()
  } catch {
    return seedState()
  }
}

export function saveState(state: AppState): void {
  try {
    // The workspace/session data is shared by the IDE and Agent windows.
    // View navigation stays local so one window cannot force the other into Settings.
    const sharedState: AppState = { ...state, view: 'chat' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState))
  } catch {
    // Persistence is best-effort.
  }
}
