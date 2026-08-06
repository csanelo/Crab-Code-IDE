import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  appReducer,
  loadState,
  newConversation,
  newRepository,
  type AppState,
} from "./index";
import { parseState, saveState, STORAGE_KEY } from "./persistence";
import type {
  AgentSessionSnapshot,
  Conversation,
  ID,
  View,
} from "../domain/types";
import { createId } from "../domain/ids";
import { agentService } from "../services/agentService";
import { projectService } from "../services/projectService";
import { providersService } from "../services/providersService";
import { on as onAppEvent, emit } from "../lib/appEvents";
import { getAccessLevel } from "../lib/agentAccess";
import { getEditMode } from "../lib/agentEditMode";
import { playSound } from "../lib/sounds";
import { terminalKnowledgeContext } from "../lib/terminalKnowledge";

interface AppContextValue {
  state: AppState;
  activeConversation: Conversation | null;
  createConversation: (repositoryId: ID | null) => void;
  selectConversation: (id: ID) => void;
  deleteConversation: (id: ID) => void;
  clearConversation: (id: ID) => void;
  renameConversation: (id: ID, title: string) => void;
  togglePinConversation: (id: ID) => void;
  clearChanges: (repositoryId: ID) => void;
  removeChange: (repositoryId: ID, path: string) => void;
  recordChange: (
    repositoryId: ID,
    change: import("../domain/types").FileChange,
  ) => void;
  stopMessage: () => void;
  openProject: () => Promise<void>;
  openProjectFromFolder: (
    repository: import("../domain/types").Repository,
  ) => void;
  selectProject: (id: ID) => void;
  deleteProject: (id: ID) => void;
  renameProject: (id: ID, name: string) => void;
  togglePinProject: (id: ID) => void;
  revealProject: (id: ID) => void;
  setView: (view: View) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  sendMessage: (
    content: string,
    attachments?: import("../domain/types").Attachment[],
    agentContent?: string,
    webEnabled?: boolean,
  ) => void;
  continueAgent: (agentContent: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);
  const disposers = useRef<Map<string, () => void>>(new Map());
  const activeRequests = useRef<Map<string, string>>(new Map());

  const [back, setBack] = useState<View[]>([]);
  const [forward, setForward] = useState<View[]>([]);
  const skipHistory = useRef(false);
  const prevView = useRef<View>(state.view);

  useEffect(() => {
    if (skipHistory.current) {
      skipHistory.current = false;
      prevView.current = state.view;
      return;
    }
    if (state.view !== prevView.current) {
      setBack((b) => [...b, prevView.current]);
      setForward([]);
      prevView.current = state.view;
    }
  }, [state.view]);

  const goBack = useCallback(() => {
    setBack((b) => {
      if (b.length === 0) return b;
      const next = b.slice(0, -1);
      const target = b[b.length - 1];
      setForward((f) => [...f, prevView.current]);
      skipHistory.current = true;
      dispatch({ type: "SET_VIEW", view: target });
      return next;
    });
  }, []);

  const goForward = useCallback(() => {
    setForward((f) => {
      if (f.length === 0) return f;
      const next = f.slice(0, -1);
      const target = f[f.length - 1];
      setBack((b) => [...b, prevView.current]);
      skipHistory.current = true;
      dispatch({ type: "SET_VIEW", view: target });
      return next;
    });
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const handle = window.setTimeout(() => saveState(state), 400);
    return () => window.clearTimeout(handle);
  }, [state]);

  useEffect(() => {
    const flush = (): void => saveState(stateRef.current);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      const incoming = parseState(event.newValue);
      if (incoming) dispatch({ type: "SYNC_EXTERNAL_STATE", payload: incoming });
    };
    const syncOnFocus = (): void => {
      try {
        const incoming = parseState(localStorage.getItem(STORAGE_KEY));
        if (incoming) dispatch({ type: "SYNC_EXTERNAL_STATE", payload: incoming });
      } catch {
        // Keep the current in-memory state.
      }
    };
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("focus", syncOnFocus);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("focus", syncOnFocus);
    };
  }, []);

  useEffect(() => {
    const map = disposers.current;
    return () => {
      map.forEach((dispose) => dispose());
      map.clear();
    };
  }, []);

  useEffect(() => {
    const unsub = window.api.app.onAgentSessions((payload) => {
      dispatch({
        type: "SYNC_AGENT_SESSIONS",
        payload: payload as AgentSessionSnapshot,
      });
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    return onAppEvent("changes:remove", ({ path }) => {
      const repoId = state.activeRepositoryId;
      if (!repoId) return;
      const repoPath = state.repositories.find((r) => r.id === repoId)?.path;
      const rel = repoPath && path.startsWith(repoPath)
        ? path.slice(repoPath.length).replace(/^[\\/]/, "")
        : path;
      dispatch({ type: "REMOVE_CHANGE", repositoryId: repoId, path: rel });
      dispatch({ type: "REMOVE_CHANGE", repositoryId: repoId, path });
    });
  }, [state.activeRepositoryId, state.repositories]);

  useEffect(() => {
    return onAppEvent("github:auth", () => {
      void window.api.github.getAuth().then((auth) => {
        if (auth.connected) return;
        const active = state.repositories.find(
          (r) => r.id === state.activeRepositoryId,
        );
        if (active?.source !== "github") return;
        const fallback = state.repositories.find(
          (r) => r.id !== active.id && r.source !== "github",
        );
        if (fallback) dispatch({ type: "SELECT_PROJECT", id: fallback.id });
      });
    });
  }, [state.repositories, state.activeRepositoryId]);

  // Materialize complete global skill bundles as soon as a local project opens.
  // This keeps scripts, references, assets and manifests available before the
  // first agent request instead of waiting until SKILL.md is read.
  useEffect(() => {
    const active = state.repositories.find(
      (repository) => repository.id === state.activeRepositoryId,
    );
    if (!active?.path || active.source === "ssh") return;
    let cancelled = false;
    void window.api.skills.sync(active.path).then(() => {
      if (!cancelled) emit("fs:changed", { root: active.path });
    });
    return () => {
      cancelled = true;
    };
  }, [state.activeRepositoryId, state.repositories]);

  const activeConversation = state.activeConversationId
    ? (state.conversations[state.activeConversationId] ?? null)
    : null;

  const value = useMemo<AppContextValue>(() => {
    function sendMessage(
      content: string,
      attachments?: import("../domain/types").Attachment[],
      agentContent?: string,
      webEnabled = false,
      visibleUserMessage = true,
    ): void {
      const trimmed = content.trim();
      const requestedAgentContent = (agentContent ?? trimmed).trim();
      if (
        !trimmed &&
        !requestedAgentContent &&
        (!attachments || attachments.length === 0)
      )
        return;

      let conversationId = state.activeConversationId;
      let baseMessages: Conversation["messages"] = [];

      if (conversationId && state.conversations[conversationId]) {
        baseMessages = state.conversations[conversationId].messages;
      } else {
        const repositoryId =
          state.activeRepositoryId ?? state.repositories[0]?.id ?? null;
        const repositoryPath = repositoryId
          ? (state.repositories.find((r) => r.id === repositoryId)?.path ?? null)
          : null;
        const conv = newConversation(repositoryId, repositoryPath);
        conversationId = conv.id;
        dispatch({ type: "ADD_CONVERSATION", conversation: conv });
      }

      const targetId = conversationId;

      const previousRequestId = activeRequests.current.get(targetId);
      if (previousRequestId) {
        window.api.agent.abort(previousRequestId);
        disposers.current.get(previousRequestId)?.();
        disposers.current.delete(previousRequestId);
        activeRequests.current.delete(targetId);
        const previousLast = baseMessages[baseMessages.length - 1];
        if (previousLast?.streaming) {
          dispatch({
            type: "FINISH_MESSAGE",
            conversationId: targetId,
            messageId: previousLast.id,
          });
        }
      }

      const userMessageId = createId("msg_");
      const assistantMessageId = createId("msg_");

      if (visibleUserMessage) {
        dispatch({
          type: "ADD_MESSAGE",
          conversationId: targetId,
          messageId: userMessageId,
          role: "user",
          content: trimmed,
          attachments:
            attachments && attachments.length ? attachments : undefined,
        });
      }
      dispatch({
        type: "ADD_MESSAGE",
        conversationId: targetId,
        messageId: assistantMessageId,
        role: "assistant",
        content: "",
        streaming: true,
      });

      const repo = state.repositories.find(
        (r) => r.id === (state.activeRepositoryId ?? ""),
      );
      const cwd = repo?.path ?? null;
      const terminalContext = terminalKnowledgeContext(cwd);
      const effectiveAgentContent = terminalContext
        ? `${requestedAgentContent}\n\n${terminalContext}`
        : requestedAgentContent;

      const history = [
        ...baseMessages.map((m) => ({ ...m })),
        {
          id: userMessageId,
          role: "user" as const,
          content: effectiveAgentContent,
          createdAt: Date.now(),
          attachments:
            attachments && attachments.length ? attachments : undefined,
        },
      ];

      const requestId = createId("req_");
      const access = getAccessLevel();
      const editMode = getEditMode();
      const dispose = agentService.send(
        requestId,
        history,
        cwd,
        access,
        editMode,
        webEnabled,
        {
          onChunk: (chunk) =>
            dispatch({
              type: "APPEND_CHUNK",
              conversationId: targetId,
              messageId: assistantMessageId,
              chunk,
            }),
          onContextUsage: (usage) =>
            dispatch({
              type: "CONTEXT_USAGE",
              conversationId: targetId,
              usage,
            }),
          onAborted: () => {
            dispatch({
              type: "FINISH_MESSAGE",
              conversationId: targetId,
              messageId: assistantMessageId,
            });
            disposers.current.get(requestId)?.();
            disposers.current.delete(requestId);
            if (activeRequests.current.get(targetId) === requestId) {
              activeRequests.current.delete(targetId);
            }
          },
          onTool: (tool) => {
            dispatch({
              type: "TOOL_EVENT",
              conversationId: targetId,
              messageId: assistantMessageId,
              repositoryId: state.activeRepositoryId ?? null,
              tool,
            });
            if (tool.status === "done" && tool.mutated) {
              const meta = tool.meta;
              if (
                meta?.path &&
                (tool.name === "edit_file" || tool.name === "write_file")
              ) {
                const rel = meta.path;
                const absPath =
                  cwd && !/^([a-zA-Z]:[\\/]|\/|ssh:\/\/)/.test(rel)
                    ? `${cwd}${cwd.includes("\\") ? "\\" : "/"}${rel.replace(/[\\/]/g, cwd.includes("\\") ? "\\" : "/")}`
                    : rel;
                emit("editor:agentEdit", { path: absPath, before: meta.before, after: meta.after });
              }
            }
          },
          onDone: () => {
            dispatch({
              type: "FINISH_MESSAGE",
              conversationId: targetId,
              messageId: assistantMessageId,
            });
            disposers.current.get(requestId)?.();
            disposers.current.delete(requestId);
            if (activeRequests.current.get(targetId) === requestId) {
              activeRequests.current.delete(targetId);
            }
            void providersService.refresh();
            void playSound("success");
          },
          onError: (message) => {
            dispatch({
              type: "FAIL_MESSAGE",
              conversationId: targetId,
              messageId: assistantMessageId,
              error: message,
            });
            disposers.current.get(requestId)?.();
            disposers.current.delete(requestId);
            if (activeRequests.current.get(targetId) === requestId) {
              activeRequests.current.delete(targetId);
            }
            void providersService.refresh();
          },
        },
      );
      disposers.current.set(requestId, dispose);
      activeRequests.current.set(targetId, requestId);
    }

    function continueAgent(agentContent: string): void {
      // Terminal completion is an internal event. Give the model the complete
      // trace and create only its response — never add a fake user chat bubble.
      sendMessage("", undefined, agentContent, false, false);
    }

    function stopMessage(): void {
      const targetId = state.activeConversationId;
      if (!targetId) return;
      const requestId = activeRequests.current.get(targetId);
      const conv = state.conversations[targetId];
      const last = conv?.messages[conv.messages.length - 1];
      if (!requestId && !last?.streaming) return;
      if (requestId) {
        window.api.agent.abort(requestId);
        disposers.current.get(requestId)?.();
        disposers.current.delete(requestId);
        activeRequests.current.delete(targetId);
      }
      if (last?.streaming) {
        dispatch({
          type: "FINISH_MESSAGE",
          conversationId: targetId,
          messageId: last.id,
        });
      }
      void playSound("stopped");
    }

    async function openProject(): Promise<void> {
      const picked = await projectService.openDialog();
      if (!picked) return;
      const repo = newRepository(picked.name, picked.path);
      dispatch({ type: "OPEN_PROJECT", repository: repo });
    }

    function revealProject(id: ID): void {
      const repo = state.repositories.find((r) => r.id === id);
      if (repo?.path) void projectService.reveal(repo.path);
    }

    return {
      state,
      activeConversation,
      createConversation: (repositoryId) =>
        dispatch({ type: "CREATE_CONVERSATION", repositoryId }),
      selectConversation: (id) => dispatch({ type: "SELECT_CONVERSATION", id }),
      deleteConversation: (id) => dispatch({ type: "DELETE_CONVERSATION", id }),
      clearConversation: (id) => dispatch({ type: "CLEAR_CONVERSATION", id }),
      renameConversation: (id, title) =>
        dispatch({ type: "RENAME_CONVERSATION", id, title }),
      togglePinConversation: (id) =>
        dispatch({ type: "TOGGLE_PIN_CONVERSATION", id }),
      clearChanges: (repositoryId) =>
        dispatch({ type: "CLEAR_CHANGES", repositoryId }),
      removeChange: (repositoryId, path) =>
        dispatch({ type: "REMOVE_CHANGE", repositoryId, path }),
      recordChange: (repositoryId, change) =>
        dispatch({ type: "RECORD_CHANGE", repositoryId, change }),
      stopMessage,
      openProject,
      openProjectFromFolder: (repository) =>
        dispatch({ type: "OPEN_PROJECT", repository }),
      selectProject: (id) => dispatch({ type: "SELECT_PROJECT", id }),
      deleteProject: (id) => dispatch({ type: "DELETE_PROJECT", id }),
      renameProject: (id, name) =>
        dispatch({ type: "RENAME_PROJECT", id, name }),
      togglePinProject: (id) => dispatch({ type: "TOGGLE_PIN_PROJECT", id }),
      revealProject,
      setView: (view) => dispatch({ type: "SET_VIEW", view }),
      goBack,
      goForward,
      canGoBack: back.length > 0,
      canGoForward: forward.length > 0,
      sendMessage,
      continueAgent,
    };
  }, [
    state,
    activeConversation,
    back.length,
    forward.length,
    goBack,
    goForward,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
