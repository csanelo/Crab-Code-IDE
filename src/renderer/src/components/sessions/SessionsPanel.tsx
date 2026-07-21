import { useMemo, useState } from "react";
import {
  Search,
  ArrowLeftRight,
  ChevronRight,
  Sparkles,
  Server,
  Pin,
  MessageSquare,
} from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import type { Conversation } from "../../domain/types";
import { ContextMenu, type MenuItem } from "../sidebar/ContextMenu";
import { CommandPalette, type PaletteItem } from "../palette/CommandPalette";
import { McpModal } from "../mcp/McpModal";
import { PlusIcon } from "./PlusIcon";
import { relativeTime } from "../../utils/relativeTime";
import {
  emit as emitAppEvent,
  queueSettingsSection,
} from "../../lib/appEvents";
import "./SessionsPanel.css";

interface MenuState {
  x: number;
  y: number;
  id: string;
}

interface SortMenuState {
  x: number;
  y: number;
}

type SortMode = "updated" | "created" | "alpha";

interface CustomItem {
  key: "skills" | "mcp";
  icon: typeof Sparkles;
  badge: number | null;
  action: "mcp" | "skills";
}

const CUSTOMIZATIONS: CustomItem[] = [
  { key: "skills", icon: Sparkles, badge: null, action: "skills" },
  { key: "mcp", icon: Server, badge: null, action: "mcp" },
];

const CUSTOM_LABELS: Record<
  CustomItem["key"],
  import("../../i18n/translations").TKey
> = {
  skills: "sessions.skills",
  mcp: "sessions.mcpServers",
};

export function SessionsPanel(): JSX.Element {
  const {
    state,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePinConversation,
    selectProject,
    setView,
  } = useApp();
  const t = useT();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sortMenu, setSortMenu] = useState<SortMenuState | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mcpOpen, setMcpOpen] = useState(false);

  const groups = useMemo(() => {
    const repo = state.repositories.find(
      (r) => r.id === state.activeRepositoryId,
    );
    if (!repo) return [];
    const chats = repo.conversationIds
      .map((id) => state.conversations[id])
      .filter((c): c is Conversation => Boolean(c))
      .sort((a, b) => {
        const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinDelta !== 0) return pinDelta;
        if (sortMode === "created") return b.createdAt - a.createdAt;
        if (sortMode === "alpha") return a.title.localeCompare(b.title);
        return b.updatedAt - a.updatedAt;
      });
    if (chats.length === 0) return [];
    return [{ repo, chats }];
  }, [
    state.repositories,
    state.conversations,
    state.activeRepositoryId,
    sortMode,
  ]);

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

  const sortItems: MenuItem[] = useMemo(
    () => [
      {
        label:
          sortMode === "updated"
            ? `✓ ${t("sessions.sortUpdated")}`
            : t("sessions.sortUpdated"),
        onClick: () => setSortMode("updated"),
      },
      {
        label:
          sortMode === "created"
            ? `✓ ${t("sessions.sortCreated")}`
            : t("sessions.sortCreated"),
        onClick: () => setSortMode("created"),
      },
      {
        label:
          sortMode === "alpha"
            ? `✓ ${t("sessions.sortAlpha")}`
            : t("sessions.sortAlpha"),
        onClick: () => setSortMode("alpha"),
      },
    ],
    [sortMode, t],
  );

  const searchItems: PaletteItem<{ id: string; repoId: string }>[] =
    useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return [];
      const out: PaletteItem<{ id: string; repoId: string }>[] = [];
      for (const repo of state.repositories) {
        for (const id of repo.conversationIds) {
          const conv = state.conversations[id];
          if (!conv) continue;
          if (
            conv.title.toLowerCase().includes(q) ||
            conv.messages.some((m) => m.content.toLowerCase().includes(q))
          ) {
            out.push({
              id: conv.id,
              title: conv.title,
              subtitle: repo.name,
              data: { id: conv.id, repoId: repo.id },
            });
          }
        }
      }
      return out.slice(0, 200);
    }, [searchQuery, state.repositories, state.conversations]);

  return (
    <aside className="sessions">
      <header className="sessions__header">
        <h2 className="sessions__title">{t("sessions.title")}</h2>
        <div className="sessions__header-actions">
          <button
            className="sessions__icon sessions__icon--plus"
            type="button"
            aria-label={t("sessions.new")}
            title={t("sessions.newHint")}
            onClick={() => createConversation(state.activeRepositoryId)}
          >
            <PlusIcon size={20} />
          </button>
          <button
            className="sessions__icon"
            type="button"
            aria-label={t("sessions.sort")}
            title={t("sessions.sort")}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setSortMenu({ x: r.left, y: r.bottom + 4 });
            }}
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            className="sessions__icon"
            type="button"
            aria-label={t("sessions.search")}
            title={t("sessions.searchHint")}
            onClick={() => {
              setSearchOpen(true);
              setSearchQuery("");
            }}
          >
            <Search size={14} />
          </button>
        </div>
      </header>

      <div className="sessions__body">
        {groups.length === 0 ? (
          <div className="sessions__skeleton" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sessions__skel-row">
                <span className="sessions__skel-dot" />
                <span className="sessions__skel-bar" />
              </div>
            ))}
          </div>
        ) : (
          groups.map(({ repo, chats }) => (
            <section key={repo.id} className="sessions__group">
              <div className="sessions__group-label">{repo.name}</div>
              {chats.map((conv) => (
                <SessionRow
                  key={conv.id}
                  conv={conv}
                  active={conv.id === state.activeConversationId}
                  renaming={renamingId === conv.id}
                  t={t}
                  onSelect={() => selectConversation(conv.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, id: conv.id });
                  }}
                  onRename={(title) => {
                    const t2 = title.trim();
                    if (t2) renameConversation(conv.id, t2);
                    setRenamingId(null);
                  }}
                  onCancelRename={() => setRenamingId(null)}
                />
              ))}
            </section>
          ))
        )}
      </div>

      <div className="sessions__footer">
        <button
          className="sessions__custom-head"
          type="button"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((v) => !v)}
        >
          <ChevronRight
            size={14}
            className={`sessions__custom-chevron${customOpen ? " sessions__custom-chevron--open" : ""}`}
          />
          <span>{t("sessions.customizations")}</span>
        </button>
        <div
          className={`sessions__custom-wrap${customOpen ? " sessions__custom-wrap--open" : ""}`}
        >
          <div className="sessions__custom-list">
            {CUSTOMIZATIONS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  className="sessions__custom"
                  type="button"
                  onClick={() => {
                    if (c.action === "mcp") setMcpOpen(true);
                    else if (c.action === "skills") {
                      queueSettingsSection("skills");
                      setView("settings");
                      emitAppEvent("settings:section", { section: "skills" });
                    }
                  }}
                >
                  <Icon size={14} className="sessions__custom-icon" />
                  <span className="sessions__custom-label">
                    {t(CUSTOM_LABELS[c.key])}
                  </span>
                  {c.badge !== null && (
                    <span className="sessions__custom-badge">{c.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
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

      {sortMenu && (
        <ContextMenu
          x={sortMenu.x}
          y={sortMenu.y}
          items={sortItems}
          variant="plain"
          className="ctx-menu--narrow"
          onClose={() => setSortMenu(null)}
        />
      )}

      {searchOpen && (
        <CommandPalette<{ id: string; repoId: string }>
          placeholder={t("sessions.searchPlaceholder")}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          items={searchItems.map((i) => ({
            ...i,
            icon: <MessageSquare size={14} />,
          }))}
          empty={
            searchQuery.trim()
              ? t("sessions.nothingFound")
              : t("sessions.enterQuery")
          }
          onSelect={(item) => {
            if (item.data) {
              if (item.data.repoId !== state.activeRepositoryId)
                selectProject(item.data.repoId);
              selectConversation(item.data.id);
            }
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {mcpOpen && <McpModal onClose={() => setMcpOpen(false)} />}
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
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
}): JSX.Element {
  const streaming = conv.messages.some((m) => m.streaming);
  if (renaming) {
    return (
      <div className="session">
        <input
          className="session__rename"
          defaultValue={conv.title}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              onRename((e.target as HTMLInputElement).value);
            if (e.key === "Escape") onCancelRename();
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
      <div className="session__row">
        <span className="session__dot" aria-hidden="true" />
        <span className="session__title">{conv.title}</span>
        {conv.pinned && <Pin size={11} className="session__pin" />}
      </div>
      <div className="session__meta">
        <Sparkles size={11} className="session__meta-icon" />
        <span>{relativeTime(conv.updatedAt, t)}</span>
        {streaming && <span className="session__spinner" aria-hidden="true" />}
      </div>
    </button>
  );
}
