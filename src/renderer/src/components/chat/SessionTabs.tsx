import { useEffect, useRef, useState } from "react";
import { Plus, History, Check, Hash, AtSign, X } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import { emit } from "../../lib/appEvents";
import {
  providersService,
  type ProvidersState,
} from "../../services/providersService";
import {
  CONTEXT_CATEGORY_IDS,
  contextWindowForModel,
  type ContextCategoryId,
  type ContextUsageSnapshot,
} from "../../../../shared/contextUsage";
import "./SessionTabs.css";

const LEGACY_CONTEXT_LIMIT = 128_000;
const CATEGORY_KEYS = {
  systemPrompt: "context.systemPrompt",
  toolDefinitions: "context.toolDefinitions",
  projectRules: "context.projectRules",
  skills: "context.skills",
  memory: "context.memory",
  conversation: "context.conversation",
  toolResults: "context.toolResults",
} as const;

function formatTokens(value: number): string {
  const amount = Math.max(0, Math.round(value));
  if (amount >= 1_000_000) {
    const digits = amount >= 10_000_000 ? 0 : 1;
    return `${(amount / 1_000_000).toFixed(digits).replace(/\.0$/, "")}M`;
  }
  if (amount >= 1_000) {
    const digits = amount >= 100_000 ? 0 : 1;
    return `${(amount / 1_000).toFixed(digits).replace(/\.0$/, "")}K`;
  }
  return amount.toLocaleString();
}

function legacyUsage(
  messages: Array<{ content: string; tokens?: number }>,
  model: string,
  contextWindow: number,
): ContextUsageSnapshot {
  const conversationTokens = messages.reduce(
    (sum, message) =>
      sum + (message.tokens ?? Math.max(0, Math.ceil(message.content.length / 4))),
    0,
  );
  return {
    model,
    contextWindow,
    inputTokens: conversationTokens,
    outputTokens: 0,
    totalInputTokens: conversationTokens,
    totalTokens: conversationTokens,
    cachedInputTokens: 0,
    measured: false,
    spendingMeasured: false,
    categories: CONTEXT_CATEGORY_IDS.map((id) => ({
      id,
      tokens: id === "conversation" ? conversationTokens : 0,
    })),
    updatedAt: Date.now(),
  };
}

export function SessionTabs(): JSX.Element {
  const {
    state,
    activeConversation,
    createConversation,
    selectConversation,
  } = useApp();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{
    id: string;
    contextWindow: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (contextRef.current && !contextRef.current.contains(target)) {
        setContextOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setContextOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setContextOpen(false);
    setMenuOpen(false);
  }, [state.activeConversationId]);

  useEffect(() => {
    let mounted = true;
    const applyProviderState = (providerState: ProvidersState): void => {
      if (!mounted) return;
      const provider = providerState.providers.find(
        (candidate) => candidate.id === providerState.activeId,
      );
      const modelId = providerState.activeModel ?? provider?.models[0]?.id ?? "";
      const model = provider?.models.find((candidate) => candidate.id === modelId);
      setSelectedModel(
        modelId
          ? {
              id: modelId,
              contextWindow: contextWindowForModel(
                modelId,
                model?.contextWindow,
              ),
            }
          : null,
      );
    };
    const unsubscribe = providersService.subscribe(applyProviderState);
    void providersService.get().then(applyProviderState).catch(() => undefined);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const sessions = (activeRepo?.conversationIds ?? [])
    .map((id) => state.conversations[id])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const contextUsage =
    activeConversation?.contextUsage ??
    legacyUsage(
      activeConversation?.messages ?? [],
      selectedModel?.id ?? "—",
      selectedModel?.contextWindow ?? LEGACY_CONTEXT_LIMIT,
    );
  const contextWindow = Math.max(
    1,
    selectedModel?.contextWindow ?? contextUsage.contextWindow,
  );
  const used = Math.max(0, contextUsage.inputTokens);
  const totalInputTokens = Math.max(
    0,
    contextUsage.totalInputTokens ?? used,
  );
  const totalOutputTokens = Math.max(0, contextUsage.outputTokens ?? 0);
  const totalSpent = Math.max(
    totalInputTokens + totalOutputTokens,
    contextUsage.totalTokens ?? totalInputTokens + totalOutputTokens,
  );
  const cachedInputTokens = Math.max(
    0,
    contextUsage.cachedInputTokens ?? 0,
  );
  const spendingMeasured =
    contextUsage.spendingMeasured ?? contextUsage.measured;
  const fraction = used / contextWindow;
  const ringFraction = Math.max(0, Math.min(1, fraction));
  const percent = Math.max(0, Math.round(fraction * 100));
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const ctxTitle = `${percent}% · ${used.toLocaleString()} / ${contextWindow.toLocaleString()}`;
  const categoryTokens = new Map<ContextCategoryId, number>(
    contextUsage.categories.map((category) => [category.id, category.tokens]),
  );
  const categories = CONTEXT_CATEGORY_IDS.map((id) => ({
    id,
    tokens: categoryTokens.get(id) ?? 0,
  }));

  const activeTitle = activeConversation?.title ?? t("sessions.title");

  return (
    <div className="stabs">
      <div className="stabs__left">
        <div className="stabs__ctx-wrap" ref={contextRef}>
          <button
            className="stabs__ctx"
            type="button"
            data-tip={ctxTitle}
            aria-label={t("context.title")}
            aria-haspopup="dialog"
            aria-expanded={contextOpen}
            aria-controls="session-context-usage"
            onClick={() => {
              setContextOpen((value) => !value);
              setMenuOpen(false);
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle className="stabs__ctx-track" cx="8" cy="8" r={radius} />
              <circle
                className="stabs__ctx-fill"
                cx="8"
                cy="8"
                r={radius}
                strokeDasharray={`${circumference * ringFraction} ${circumference}`}
              />
            </svg>
          </button>

          {contextOpen && (
            <section
              id="session-context-usage"
              className="stabs__context-popover"
              role="dialog"
              aria-label={t("context.title")}
            >
              <div className="stabs__context-head">
                <h2>{t("context.title")}</h2>
                <button
                  className="stabs__context-close"
                  type="button"
                  aria-label={t("context.close")}
                  onClick={() => setContextOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="stabs__context-summary">
                <span>{t("context.used", { percent })}</span>
                <strong>
                  {t("context.tokens", {
                    used: formatTokens(used),
                    limit: formatTokens(contextWindow),
                  })}
                </strong>
              </div>

              <div className="stabs__context-stats">
                <div className="stabs__context-stat">
                  <span>{t("context.modelMaximum")}</span>
                  <strong>{formatTokens(contextWindow)}</strong>
                </div>
                <div className="stabs__context-stat">
                  <span>
                    {spendingMeasured
                      ? t("context.actualSpent")
                      : t("context.estimatedSpent")}
                  </span>
                  <strong>{formatTokens(totalSpent)}</strong>
                </div>
                <div className="stabs__context-spend-detail">
                  {t("context.spentBreakdown", {
                    input: formatTokens(totalInputTokens),
                    output: formatTokens(totalOutputTokens),
                  })}
                  {cachedInputTokens > 0
                    ? ` · ${t("context.cached", {
                        tokens: formatTokens(cachedInputTokens),
                      })}`
                    : ""}
                </div>
              </div>

              <div className="stabs__context-bar" aria-hidden="true">
                {categories.map((category) =>
                  category.tokens > 0 ? (
                    <span
                      key={category.id}
                      data-category={category.id}
                      style={{
                        width: `${Math.max(
                          0.35,
                          (category.tokens / contextWindow) * 100,
                        )}%`,
                      }}
                    />
                  ) : null,
                )}
              </div>

              <div className="stabs__context-categories">
                {categories.map((category) => (
                  <div className="stabs__context-row" key={category.id}>
                    <span
                      className="stabs__context-dot"
                      data-category={category.id}
                      aria-hidden="true"
                    />
                    <span className="stabs__context-name">
                      {t(CATEGORY_KEYS[category.id])}
                    </span>
                    <span className="stabs__context-value">
                      {formatTokens(category.tokens)}
                    </span>
                  </div>
                ))}
              </div>

            </section>
          )}
        </div>

        <button
          className="stabs__action"
          type="button"
          aria-label={t("chat.mentionFile")}
          data-tip={t("chat.mentionFile")}
          onClick={() => emit("composer:insert", { text: "#" })}
        >
          <Hash size={14} />
        </button>
        <button
          className="stabs__action"
          type="button"
          aria-label="Mention"
          data-tip="Mention"
          onClick={() => emit("composer:insert", { text: "@" })}
        >
          <AtSign size={14} />
        </button>
      </div>

      <div className="stabs__actions">
        <button
          className="stabs__action"
          type="button"
          aria-label={t("sessions.new")}
          data-tip={t("sessions.new")}
          onClick={() => createConversation(state.activeRepositoryId)}
        >
          <Plus size={14} />
        </button>
        <div className="stabs__history-wrap" ref={menuRef}>
          <button
            className="stabs__sessions-btn"
            type="button"
            aria-label={t("sessions.title")}
            data-tip={activeTitle}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((value) => !value);
              setContextOpen(false);
            }}
          >
            <History size={14} />
            <span className="stabs__sessions-label">{activeTitle}</span>
          </button>
          {menuOpen && (
            <div className="stabs__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="stabs__menu-item"
                onClick={() => {
                  createConversation(state.activeRepositoryId);
                  setMenuOpen(false);
                }}
              >
                <Plus size={13} />
                <span className="stabs__menu-label">{t("sessions.new")}</span>
              </button>
              <div className="stabs__menu-sep" />
              {sessions.length === 0 ? (
                <div className="stabs__menu-empty">
                  {t("sessions.emptyNoSessions")}
                </div>
              ) : (
                sessions.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    role="menuitem"
                    className="stabs__menu-item"
                    onClick={() => {
                      selectConversation(conv.id);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="stabs__menu-label">{conv.title}</span>
                    {conv.id === state.activeConversationId && (
                      <Check size={13} />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
