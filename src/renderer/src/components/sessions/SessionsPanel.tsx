import { useMemo, useState } from "react";
import { Pin, Plus } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import type { Conversation } from "../../domain/types";
import { ContextMenu, type MenuItem } from "../sidebar/ContextMenu";
import { relativeTime } from "../../utils/relativeTime";
import { SessionChatIcon } from "../icons/WorkspaceIcons";
import "./SessionsPanel.css";

interface MenuState {
  x: number;
  y: number;
  id: string;
}

interface SessionGroup {
  label: string;
  chats: Conversation[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function SessionsPanel(): JSX.Element {
  const {
    state,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation,
  } = useApp();
  const t = useT();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const groups = useMemo<SessionGroup[]>(() => {
    const repo = state.repositories.find(
      (item) => item.id === state.activeRepositoryId,
    );
    if (!repo) return [];

    const chats = repo.conversationIds
      .map((id) => state.conversations[id])
      .filter((conversation): conversation is Conversation => Boolean(conversation))
      .sort((a, b) => {
        const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        return pinDelta || b.updatedAt - a.updatedAt;
      });

    const now = Date.now();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();
    const thirtyDaysAgo = now - 30 * DAY_MS;

    const today: SessionGroup = {
      label: "Today",
      chats: chats.filter((chat) => chat.updatedAt >= todayStart),
    };
    const olderGroups: SessionGroup[] = [
      {
        label: "Past 30 days",
        chats: chats.filter(
          (chat) => chat.updatedAt < todayStart && chat.updatedAt >= thirtyDaysAgo,
        ),
      },
      {
        label: "Older",
        chats: chats.filter((chat) => chat.updatedAt < thirtyDaysAgo),
      },
    ];
    return [today, ...olderGroups.filter((group) => group.chats.length > 0)];
  }, [
    state.repositories,
    state.conversations,
    state.activeRepositoryId,
  ]);

  const hasSessions = groups.some((group) => group.chats.length > 0);

  const menuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    const chat = state.conversations[menu.id];
    if (!chat) return [];
    return [
      {
        label: chat.pinned ? t("sessions.unpin") : t("sessions.pin"),
        onClick: () => togglePinConversation(chat.id),
      },
      {
        label: t("sessions.rename"),
        shortcut: "F2",
        onClick: () => setRenamingId(chat.id),
      },
      { separator: true },
      {
        label: t("sessions.delete"),
        danger: true,
        onClick: () => deleteConversation(chat.id),
      },
    ];
  }, [menu, state.conversations, togglePinConversation, deleteConversation, t]);

  const createNewChat = (): void => {
    createConversation(state.activeRepositoryId);
  };

  return (
    <aside className="sessions">
      <div className="sessions__body">
        {groups.length === 0 ? (
          <div className="sessions__empty-state">
            <SessionChatIcon size={21} className="sessions__empty-icon" />
            <span>No session</span>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.label} className="sessions__group">
                <div className="sessions__group-head">
                  <div className="sessions__group-label">{group.label}</div>
                  {group.label === "Today" && (
                    <button
                      className="sessions__group-add"
                      type="button"
                      aria-label={t("sessions.new")}
                      data-tip={t("sessions.new")}
                      onClick={createNewChat}
                    >
                      <Plus size={15} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                {group.chats.map((conversation) => (
                  <SessionRow
                    key={conversation.id}
                    conv={conversation}
                    active={conversation.id === state.activeConversationId}
                    renaming={renamingId === conversation.id}
                    t={t}
                    onSelect={() => selectConversation(conversation.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({
                        x: event.clientX,
                        y: event.clientY,
                        id: conversation.id,
                      });
                    }}
                    onRename={(title) => {
                      const nextTitle = title.trim();
                      if (nextTitle) renameConversation(conversation.id, nextTitle);
                      setRenamingId(null);
                    }}
                    onCancelRename={() => setRenamingId(null)}
                  />
                ))}
              </section>
            ))}
            {!hasSessions && (
              <div className="sessions__empty-state">
            <SessionChatIcon size={21} className="sessions__empty-icon" />
            <span>No session</span>
          </div>
            )}
          </>
        )}
      </div>


      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          variant="plain"
          className="ctx-menu--narrow"
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}

function SessionRow({
  conv,
  active,
  renaming,
  t,
  onSelect,
  onContextMenu,
  onRename,
  onCancelRename,
}: {
  conv: Conversation;
  active: boolean;
  renaming: boolean;
  t: import("../../i18n").Translate;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
}): JSX.Element {
  const streaming = conv.messages.some((message) => message.streaming);

  if (renaming) {
    return (
      <div className="session session--renaming">
        <input
          className="session__rename"
          defaultValue={conv.title}
          autoFocus
          onFocus={(event) => event.target.select()}
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onRename((event.target as HTMLInputElement).value);
            }
            if (event.key === "Escape") onCancelRename();
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`session${active ? " session--active" : ""}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <SessionChatIcon size={20} className="session__icon" />
      <span className="session__title">{conv.title}</span>
      {conv.pinned && <Pin size={13} className="session__pin" />}
      {streaming ? (
        <span className="session__spinner" aria-hidden="true" />
      ) : (
        <span className="session__time">{relativeTime(conv.updatedAt, t)}</span>
      )}
    </button>
  );
}
