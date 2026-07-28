import { useEffect, useRef, useState } from "react";
import { Plus, History, Check, Hash, AtSign } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import { emit } from "../../lib/appEvents";
import "./SessionTabs.css";

const CONTEXT_LIMIT = 128000;

export function SessionTabs(): JSX.Element {
  const {
    state,
    activeConversation,
    createConversation,
    selectConversation,
  } = useApp();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const sessions = (activeRepo?.conversationIds ?? [])
    .map((id) => state.conversations[id])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const used = (activeConversation?.messages ?? []).reduce(
    (sum, m) => sum + (m.tokens ?? Math.round(m.content.length / 4)),
    0,
  );
  const pct = Math.max(0, Math.min(1, used / CONTEXT_LIMIT));
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const ctxTitle = `${Math.round(pct * 100)}% · ${used.toLocaleString()} / ${CONTEXT_LIMIT.toLocaleString()}`;

  const activeTitle = activeConversation?.title ?? t("sessions.title");

  return (
    <div className="stabs">
      <div className="stabs__left">
        <span className="stabs__ctx" data-tip={ctxTitle} aria-label={ctxTitle}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle className="stabs__ctx-track" cx="8" cy="8" r={radius} />
            <circle
              className="stabs__ctx-fill"
              cx="8"
              cy="8"
              r={radius}
              strokeDasharray={`${circumference * pct} ${circumference}`}
            />
          </svg>
        </span>
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
            onClick={() => setMenuOpen((v) => !v)}
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
