import { useEffect, useState } from 'react'
import {
  GitBranch,
  FileCode,
  Loader2,
  ArrowUp,
  Coins,
  MessageSquare
} from 'lucide-react'
import { useApp } from '../../state/AppContext'
import { useT } from '../../i18n'
import { fileIcon } from '../files/iconMap'

export function StatusBar(): JSX.Element {
  const t = useT()
  const { state, activeConversation, clearChanges, removeChange } = useApp()
  const activeRepo =
    state.repositories.find((r) => r.id === state.activeRepositoryId) ?? null
  const isGithub = activeRepo?.source === 'github'
  const changes = activeRepo ? (state.changes[activeRepo.id] ?? []) : []
  const changeCount = changes.length

  const sessionMessages = activeConversation?.messages.length ?? 0
  const sessionTokens =
    activeConversation?.messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0) ?? 0

  const [branch, setBranch] = useState<string | null>(null)
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
      </div>
    </footer>
  )
}

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

