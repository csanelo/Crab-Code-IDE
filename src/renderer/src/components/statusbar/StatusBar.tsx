import { useEffect, useState } from 'react'
import {
  GitBranch,
  FileCode,
  AlertCircle,
  Loader2,
  ArrowUp,
  Folder,
  Github,
  TerminalSquare,
  Plus,
  Check,
  X,
  Coins,
  MessageSquare,
  Clock
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n/translations'
import { fileIcon } from '../files/iconMap'
import { GithubPanel } from '../center/GithubPanel'
import { SshPanel } from '../center/SshPanel'

type RepoSource = 'folder' | 'github' | 'ssh'

const REPO_SOURCES: { id: RepoSource; key: TKey; icon: typeof Folder }[] = [
  { id: 'folder', key: 'chat.source.folder', icon: Folder },
  { id: 'github', key: 'chat.source.github', icon: Github },
  { id: 'ssh', key: 'chat.source.ssh', icon: TerminalSquare }
]

const SOURCE_ICON: Record<RepoSource, typeof Folder> = {
  folder: Folder,
  github: Github,
  ssh: TerminalSquare
}

export function StatusBar(): JSX.Element {
  const t = useT()
  const { state, activeConversation, selectProject, openProject, deleteProject, clearChanges, removeChange } = useApp()
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null
  const isGithub = activeRepo?.source === 'github'
  const changes = activeRepo ? (state.changes[activeRepo.id] ?? []) : []
  const changeCount = changes.length

  const sessionMessages = activeConversation?.messages.length ?? 0
  const sessionTokens =
    activeConversation?.messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0) ?? 0

  const [uptime, setUptime] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const tick = (): void => setUptime(Date.now() - start)
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const [branch, setBranch] = useState<string | null>(null)
  const [projOpen, setProjOpen] = useState(false)
  const [repoSource, setRepoSource] = useState<RepoSource>('folder')
  const [commitOpen, setCommitOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBranch(null)
    if (!activeRepo?.path) return
    void window.api.github.status(activeRepo.path).then((s) => {
      if (!cancelled && s.isRepo) setBranch(s.branch ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [activeRepo?.path, changeCount])

  async function commit(paths?: string[]): Promise<void> {
    if (!activeRepo?.path) return
    setBusy(paths && paths.length === 1 ? paths[0] : '__all__')
    const res = await window.api.github.commitPush({
      path: activeRepo.path,
      message: message.trim() || 'Update from CrabCode',
      paths
    })
    setBusy(null)
    if (res.ok) {
      setMessage('')
      if (paths && paths.length === 1) {
        removeChange(activeRepo.id, paths[0])
      } else {
        clearChanges(activeRepo.id)
        setCommitOpen(false)
      }
    }
  }

  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <div className="statusbar__proj">
          <button
            type="button"
            className="statusbar__item statusbar__btn"
            onClick={() => setProjOpen((v) => !v)}
            title={t('status.switchProject')}
          >
            {(() => {
              const Icon = SOURCE_ICON[(activeRepo?.source as RepoSource) ?? 'folder']
              return <Icon size={12} />
            })()}
            {activeRepo ? activeRepo.name : t('status.noProject')}
          </button>
          {projOpen && (
            <>
              <div className="statusbar__backdrop" onClick={() => setProjOpen(false)} />
              <div className="statusbar__menu statusbar__menu--wide" role="menu">
                <div className="ns__menu-tabs" role="tablist">
                  {REPO_SOURCES.map((s) => {
                    const TabIcon = s.icon
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={repoSource === s.id}
                        className={`ns__menu-tab${repoSource === s.id ? ' ns__menu-tab--on' : ''}`}
                        onClick={() => setRepoSource(s.id)}
                      >
                        <TabIcon size={13} />
                        <span>{t(s.key)}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="ns__menu-sep" />

                {repoSource === 'folder' && (
                  <>
                    {state.repositories
                      .filter((repo) => (repo.source ?? 'folder') === 'folder')
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id)
                              setProjOpen(false)
                            }}
                          >
                            <Folder size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t('chat.removeProject', { name: repo.name })}
                            title={t('chat.removeFromList')}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteProject(repo.id)
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    <div className="ns__menu-sep" />
                    <button
                      type="button"
                      role="menuitem"
                      className="ns__menu-item"
                      onClick={() => {
                        setProjOpen(false)
                        void openProject()
                      }}
                    >
                      <Plus size={13} />
                      <span className="ns__menu-label">{t('chat.openFolder')}</span>
                    </button>
                  </>
                )}

                {repoSource === 'github' && (
                  <>
                    {state.repositories
                      .filter((repo) => repo.source === 'github')
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id)
                              setProjOpen(false)
                            }}
                          >
                            <Github size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t('chat.removeProject', { name: repo.name })}
                            title={t('chat.removeFromList')}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteProject(repo.id)
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    <GithubPanel onOpened={() => setProjOpen(false)} />
                  </>
                )}

                {repoSource === 'ssh' && (
                  <>
                    {state.repositories
                      .filter((repo) => repo.source === 'ssh')
                      .map((repo) => (
                        <div key={repo.id} className="ns__menu-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="ns__menu-item ns__menu-item--main"
                            onClick={() => {
                              selectProject(repo.id)
                              setProjOpen(false)
                            }}
                          >
                            <TerminalSquare size={13} />
                            <span className="ns__menu-label">{repo.name}</span>
                            {repo.id === state.activeRepositoryId && <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            className="ns__menu-remove"
                            aria-label={t('chat.removeProject', { name: repo.name })}
                            title={t('chat.removeFromList')}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteProject(repo.id)
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
        {branch && (
          <span className="statusbar__item statusbar__branch">
            <GitBranch size={12} />
            {activeRepo ? `${activeRepo.name.split('/').pop()} / ${branch}` : branch}
          </span>
        )}
        {changeCount > 0 && (
          <div className="statusbar__proj">
            <button
              type="button"
              className="statusbar__item statusbar__btn statusbar__item--accent"
              onClick={() => isGithub && setCommitOpen((v) => !v)}
              title={isGithub ? t('status.commitTitle') : undefined}
            >
              <FileCode size={12} />
              {t('status.changed', { n: changeCount })}
            </button>
            {commitOpen && isGithub && (
              <>
                <div className="statusbar__backdrop" onClick={() => setCommitOpen(false)} />
                <div className="statusbar__commit" role="menu">
                  <div className="statusbar__commit-files">
                    {changes.map((c) => {
                      const name = c.path.split(/[\\/]/).pop() ?? c.path
                      return (
                        <div key={c.path} className="statusbar__commit-row">
                          <img
                            src={fileIcon(name)}
                            alt=""
                            className="statusbar__commit-icon"
                            aria-hidden="true"
                          />
                          <span className="statusbar__commit-name" title={c.path}>
                            {name}
                          </span>
                          <button
                            type="button"
                            className="statusbar__commit-one"
                            disabled={busy !== null}
                            title={t('status.commitFile')}
                            onClick={() => void commit([c.path])}
                          >
                            {busy === c.path ? (
                              <Loader2 size={12} className="statusbar__spin" />
                            ) : (
                              <ArrowUp size={12} />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="statusbar__commit-bar">
                    <input
                      className="statusbar__commit-input"
                      type="text"
                      placeholder={t('github.commitPlaceholder')}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commit()
                        if (e.key === 'Escape') setCommitOpen(false)
                      }}
                    />
                    <button
                      type="button"
                      className="statusbar__commit-all"
                      disabled={busy !== null}
                      onClick={() => void commit()}
                    >
                      {busy === '__all__' ? (
                        <Loader2 size={13} className="statusbar__spin" />
                      ) : (
                        t('status.commitAll')
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="statusbar__spacer" />
      <div className="statusbar__group">
        {activeConversation && (
          <>
            <span className="statusbar__item" title={t('status.sessionTokens')}>
              <Coins size={12} />
              {formatCount(sessionTokens)}
            </span>
            <span className="statusbar__item" title={t('status.sessionMessages')}>
              <MessageSquare size={12} />
              {sessionMessages}
            </span>
          </>
        )}
        <span className="statusbar__item" title={t('status.uptime')}>
          <Clock size={12} />
          {formatUptime(uptime)}
        </span>
        <span className="statusbar__item">
          <AlertCircle size={12} />0
        </span>
        <span className="statusbar__item">CrabCode</span>
      </div>
    </footer>
  )
}

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

function formatUptime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
