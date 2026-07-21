import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { appReducer, loadState, newConversation, newRepository, type AppState } from './index'
import { saveState } from './persistence'
import type { Conversation, ID, View } from '../domain/types'
import { createId } from '../domain/ids'
import { agentService } from '../services/agentService'
import { projectService } from '../services/projectService'
import { emit, on as onAppEvent } from '../lib/appEvents'
import { getAccessLevel } from '../lib/agentAccess'
import { getEditMode } from '../lib/agentEditMode'
import { playSound } from '../lib/sounds'

interface AppContextValue {
  state: AppState
  activeConversation: Conversation | null
  createConversation: (repositoryId: ID | null) => void
  selectConversation: (id: ID) => void
  deleteConversation: (id: ID) => void
  clearConversation: (id: ID) => void
  renameConversation: (id: ID, title: string) => void
  togglePinConversation: (id: ID) => void
  clearChanges: (repositoryId: ID) => void
  removeChange: (repositoryId: ID, path: string) => void
  recordChange: (repositoryId: ID, change: import('../domain/types').FileChange) => void
  stopMessage: () => void
  openProject: () => Promise<void>
  openProjectFromFolder: (repository: import('../domain/types').Repository) => void
  selectProject: (id: ID) => void
  deleteProject: (id: ID) => void
  renameProject: (id: ID, name: string) => void
  togglePinProject: (id: ID) => void
  revealProject: (id: ID) => void
  setView: (view: View) => void
  goBack: () => void
  goForward: () => void
  canGoBack: boolean
  canGoForward: boolean
  sendMessage: (
    content: string,
    attachments?: import('../domain/types').Attachment[],
    agentContent?: string,
    webEnabled?: boolean
  ) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState)
  const disposers = useRef<Map<string, () => void>>(new Map())
  const activeRequests = useRef<Map<string, string>>(new Map())

  const [back, setBack] = useState<View[]>([])
  const [forward, setForward] = useState<View[]>([])
  const skipHistory = useRef(false)
  const prevView = useRef<View>(state.view)

  useEffect(() => {
    if (skipHistory.current) {
      skipHistory.current = false
      prevView.current = state.view
      return
    }
    if (state.view !== prevView.current) {
      setBack((b) => [...b, prevView.current])
      setForward([])
      prevView.current = state.view
    }
  }, [state.view])

  const goBack = useCallback(() => {
    setBack((b) => {
      if (b.length === 0) return b
      const next = b.slice(0, -1)
      const target = b[b.length - 1]
      setForward((f) => [...f, prevView.current])
      skipHistory.current = true
      dispatch({ type: 'SET_VIEW', view: target })
      return next
    })
  }, [])

  const goForward = useCallback(() => {
    setForward((f) => {
      if (f.length === 0) return f
      const next = f.slice(0, -1)
      const target = f[f.length - 1]
      setBack((b) => [...b, prevView.current])
      skipHistory.current = true
      dispatch({ type: 'SET_VIEW', view: target })
      return next
    })
  }, [])

  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    const handle = window.setTimeout(() => saveState(state), 400)
    return () => window.clearTimeout(handle)
  }, [state])

  useEffect(() => {
    const flush = (): void => saveState(stateRef.current)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])

  useEffect(() => {
    const map = disposers.current
    return () => {
      map.forEach((dispose) => dispose())
      map.clear()
    }
  }, [])

  useEffect(() => {
    return onAppEvent('github:auth', () => {
      void window.api.github.getAuth().then((auth) => {
        if (auth.connected) return
        const active = state.repositories.find((r) => r.id === state.activeRepositoryId)
        if (active?.source !== 'github') return
        const fallback = state.repositories.find(
          (r) => r.id !== active.id && r.source !== 'github'
        )
        if (fallback) dispatch({ type: 'SELECT_PROJECT', id: fallback.id })
      })
    })
  }, [state.repositories, state.activeRepositoryId])

  const activeConversation = state.activeConversationId
    ? (state.conversations[state.activeConversationId] ?? null)
    : null

  const value = useMemo<AppContextValue>(() => {
    function sendMessage(
      content: string,
      attachments?: import('../domain/types').Attachment[],
      agentContent?: string,
      webEnabled = false
    ): void {
      const trimmed = content.trim()
      if (!trimmed && (!attachments || attachments.length === 0)) return

      let conversationId = state.activeConversationId
      let baseMessages: Conversation['messages'] = []

      if (conversationId && state.conversations[conversationId]) {
        baseMessages = state.conversations[conversationId].messages
      } else {
        const repositoryId = state.activeRepositoryId ?? state.repositories[0]?.id ?? null
        const conv = newConversation(repositoryId)
        conversationId = conv.id
        dispatch({ type: 'ADD_CONVERSATION', conversation: conv })
      }

      const targetId = conversationId

      const userMessageId = createId('msg_')
      const assistantMessageId = createId('msg_')

      dispatch({
        type: 'ADD_MESSAGE',
        conversationId: targetId,
        messageId: userMessageId,
        role: 'user',
        content: trimmed,
        attachments: attachments && attachments.length ? attachments : undefined
      })
      dispatch({
        type: 'ADD_MESSAGE',
        conversationId: targetId,
        messageId: assistantMessageId,
        role: 'assistant',
        content: '',
        streaming: true
      })

      const history = [
        ...baseMessages.map((m) => ({ ...m })),
        {
          id: userMessageId,
          role: 'user' as const,
          content: (agentContent ?? trimmed).trim(),
          createdAt: Date.now(),
          attachments: attachments && attachments.length ? attachments : undefined
        }
      ]

      const requestId = createId('req_')
      const repo = state.repositories.find((r) => r.id === (state.activeRepositoryId ?? ''))
      const cwd = repo?.path ?? null
      const access = getAccessLevel()
      const editMode = getEditMode()
      const dispose = agentService.send(requestId, history, cwd, access, editMode, webEnabled, {
        onChunk: (chunk) =>
          dispatch({ type: 'APPEND_CHUNK', conversationId: targetId, messageId: assistantMessageId, chunk }),
        onTool: (tool) => {
          dispatch({
            type: 'TOOL_EVENT',
            conversationId: targetId,
            messageId: assistantMessageId,
            repositoryId: state.activeRepositoryId ?? null,
            tool
          })
          if (tool.status === 'done' && tool.mutated) {
            emit('fs:changed', undefined)
            const meta = tool.meta
            if (meta?.path && (tool.name === 'edit_file' || tool.name === 'write_file')) {
              const rel = meta.path
              const absPath =
                cwd && !/^([a-zA-Z]:[\\/]|\/|ssh:\/\/)/.test(rel)
                  ? `${cwd}${cwd.includes('\\') ? '\\' : '/'}${rel.replace(/[\\/]/g, cwd.includes('\\') ? '\\' : '/')}`
                  : rel
              emit('editor:agentEdit', { path: absPath })
            }
          }
        },
        onDone: () => {
          dispatch({ type: 'FINISH_MESSAGE', conversationId: targetId, messageId: assistantMessageId })
          disposers.current.get(requestId)?.()
          disposers.current.delete(requestId)
          activeRequests.current.delete(targetId)
          void playSound('success')
        },
        onError: (message) => {
          dispatch({ type: 'FAIL_MESSAGE', conversationId: targetId, messageId: assistantMessageId, error: message })
          disposers.current.get(requestId)?.()
          disposers.current.delete(requestId)
          activeRequests.current.delete(targetId)
        }
      })
      disposers.current.set(requestId, dispose)
      activeRequests.current.set(targetId, requestId)
    }

    function stopMessage(): void {
      const targetId = state.activeConversationId
      if (!targetId) return
      const requestId = activeRequests.current.get(targetId)
      if (!requestId) return
      window.api.agent.abort(requestId)
      void playSound('stopped')
      const conv = state.conversations[targetId]
      const last = conv?.messages[conv.messages.length - 1]
      if (last && last.streaming) {
        dispatch({ type: 'FINISH_MESSAGE', conversationId: targetId, messageId: last.id })
      }
      disposers.current.get(requestId)?.()
      disposers.current.delete(requestId)
      activeRequests.current.delete(targetId)
    }

    async function openProject(): Promise<void> {
      const picked = await projectService.openDialog()
      if (!picked) return
      const repo = newRepository(picked.name, picked.path)
      dispatch({ type: 'OPEN_PROJECT', repository: repo })
    }

    function revealProject(id: ID): void {
      const repo = state.repositories.find((r) => r.id === id)
      if (repo?.path) void projectService.reveal(repo.path)
    }

    return {
      state,
      activeConversation,
      createConversation: (repositoryId) =>
        dispatch({ type: 'CREATE_CONVERSATION', repositoryId }),
      selectConversation: (id) => dispatch({ type: 'SELECT_CONVERSATION', id }),
      deleteConversation: (id) => dispatch({ type: 'DELETE_CONVERSATION', id }),
      clearConversation: (id) => dispatch({ type: 'CLEAR_CONVERSATION', id }),
      renameConversation: (id, title) => dispatch({ type: 'RENAME_CONVERSATION', id, title }),
      togglePinConversation: (id) => dispatch({ type: 'TOGGLE_PIN_CONVERSATION', id }),
      clearChanges: (repositoryId) => dispatch({ type: 'CLEAR_CHANGES', repositoryId }),
      removeChange: (repositoryId, path) =>
        dispatch({ type: 'REMOVE_CHANGE', repositoryId, path }),
      recordChange: (repositoryId, change) =>
        dispatch({ type: 'RECORD_CHANGE', repositoryId, change }),
      stopMessage,
      openProject,
      openProjectFromFolder: (repository) =>
        dispatch({ type: 'OPEN_PROJECT', repository }),
      selectProject: (id) => dispatch({ type: 'SELECT_PROJECT', id }),
      deleteProject: (id) => dispatch({ type: 'DELETE_PROJECT', id }),
      renameProject: (id, name) => dispatch({ type: 'RENAME_PROJECT', id, name }),
      togglePinProject: (id) => dispatch({ type: 'TOGGLE_PIN_PROJECT', id }),
      revealProject,
      setView: (view) => dispatch({ type: 'SET_VIEW', view }),
      goBack,
      goForward,
      canGoBack: back.length > 0,
      canGoForward: forward.length > 0,
      sendMessage
    }
  }, [state, activeConversation, back.length, forward.length, goBack, goForward])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
