import { useState, type ComponentType } from "react";
import { Folder, Github, Plus, Check, X } from "lucide-react";
import { useApp } from "../../state/AppContext";
import { useT } from "../../i18n";
import type { TKey } from "../../i18n/translations";
import { GithubPanel } from "../center/GithubPanel";
import { SshPanel } from "../center/SshPanel";

type RepoSource = "folder" | "github" | "ssh";
type SourceIcon = ComponentType<{ size?: number | string }>;

function SshGlyph({ size = 14 }: { size?: number | string }): JSX.Element {
  const pixels = typeof size === "number" ? size : 14;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: pixels,
        height: pixels,
        flexShrink: 0,
        fontFamily: "monospace",
        fontSize: Math.max(9, pixels - 3),
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-1px",
      }}
    >
      &gt;_
    </span>
  );
}

const REPO_SOURCES: { id: RepoSource; key: TKey; icon: SourceIcon }[] = [
  { id: "folder", key: "chat.source.folder", icon: Folder },
  { id: "github", key: "chat.source.github", icon: Github },
  { id: "ssh", key: "chat.source.ssh", icon: SshGlyph },
];

const SOURCE_ICON: Record<RepoSource, SourceIcon> = {
  folder: Folder,
  github: Github,
  ssh: SshGlyph,
};

export function ProjectSwitcher(): JSX.Element {
  const t = useT();
  const { state, selectProject, openProject, deleteProject } = useApp();
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null;
  const [projOpen, setProjOpen] = useState(false);
  const [repoSource, setRepoSource] = useState<RepoSource>("folder");
  const ChipIcon = SOURCE_ICON[(activeRepo?.source as RepoSource) ?? "folder"];

  return (
    <div className="titlebar__proj">
      <button
        type="button"
        className="titlebar__proj-btn"
        onClick={() => setProjOpen((v) => !v)}
        title={t("status.switchProject")}
      >
        <ChipIcon size={14} />
        <span className="titlebar__proj-ws">workspace</span>
        <span className="titlebar__proj-slash">/</span>
        <span className="titlebar__proj-name">
          {activeRepo ? activeRepo.name : t("status.noProject")}
        </span>
      </button>
      {projOpen && (
        <>
          <div
            className="titlebar__proj-backdrop"
            onClick={() => setProjOpen(false)}
          />
          <div className="titlebar__proj-menu" role="menu">
            <div className="ns__menu-tabs" role="tablist">
              {REPO_SOURCES.map((s) => {
                const TabIcon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={repoSource === s.id}
                    className={`ns__menu-tab${repoSource === s.id ? " ns__menu-tab--on" : ""}`}
                    onClick={() => setRepoSource(s.id)}
                  >
                    <TabIcon size={13} />
                    <span>{t(s.key)}</span>
                  </button>
                );
              })}
            </div>

            {repoSource === "folder" && (
              <>
                {state.repositories
                  .filter((repo) => (repo.source ?? "folder") === "folder")
                  .map((repo) => (
                    <div key={repo.id} className="ns__menu-row">
                      <button
                        type="button"
                        role="menuitem"
                        className="ns__menu-item ns__menu-item--main"
                        onClick={() => {
                          selectProject(repo.id);
                          setProjOpen(false);
                        }}
                      >
                        <Folder size={13} />
                        <span className="ns__menu-label">{repo.name}</span>
                        {repo.id === state.activeRepositoryId && (
                          <Check size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="ns__menu-remove"
                        aria-label={t("chat.removeProject", {
                          name: repo.name,
                        })}
                        title={t("chat.removeFromList")}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(repo.id);
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  role="menuitem"
                  className="ns__menu-item"
                  onClick={() => {
                    setProjOpen(false);
                    void openProject();
                  }}
                >
                  <Plus size={13} />
                  <span className="ns__menu-label">{t("chat.openFolder")}</span>
                </button>
              </>
            )}

            {repoSource === "github" && (
              <>
                {state.repositories
                  .filter((repo) => repo.source === "github")
                  .map((repo) => (
                    <div key={repo.id} className="ns__menu-row">
                      <button
                        type="button"
                        role="menuitem"
                        className="ns__menu-item ns__menu-item--main"
                        onClick={() => {
                          selectProject(repo.id);
                          setProjOpen(false);
                        }}
                      >
                        <Github size={13} />
                        <span className="ns__menu-label">{repo.name}</span>
                        {repo.id === state.activeRepositoryId && (
                          <Check size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="ns__menu-remove"
                        aria-label={t("chat.removeProject", {
                          name: repo.name,
                        })}
                        title={t("chat.removeFromList")}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(repo.id);
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                <GithubPanel onOpened={() => setProjOpen(false)} />
              </>
            )}

            {repoSource === "ssh" && (
              <>
                {state.repositories
                  .filter((repo) => repo.source === "ssh")
                  .map((repo) => (
                    <div key={repo.id} className="ns__menu-row">
                      <button
                        type="button"
                        role="menuitem"
                        className="ns__menu-item ns__menu-item--main"
                        onClick={() => {
                          selectProject(repo.id);
                          setProjOpen(false);
                        }}
                      >
                        <SshGlyph size={13} />
                        <span className="ns__menu-label">{repo.name}</span>
                        {repo.id === state.activeRepositoryId && (
                          <Check size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="ns__menu-remove"
                        aria-label={t("chat.removeProject", {
                          name: repo.name,
                        })}
                        title={t("chat.removeFromList")}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(repo.id);
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                <SshPanel onOpened={() => setProjOpen(false)} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
