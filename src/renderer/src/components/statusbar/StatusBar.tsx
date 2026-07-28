import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { useApp } from '../../state/AppContext'

export function StatusBar(): JSX.Element {
  const { state } = useApp()
  const activeRepo =
    state.repositories.find((repository) => repository.id === state.activeRepositoryId) ?? null
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBranch(null)
    if (!activeRepo?.path) return
    void window.api.github.status(activeRepo.path).then((status) => {
      if (!cancelled && status.isRepo) setBranch(status.branch ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [activeRepo?.path])

  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        {branch && (
          <span className="statusbar__item statusbar__branch">
            <GitBranch size={12} />
            {activeRepo ? `${activeRepo.name.split('/').pop()} / ${branch}` : branch}
          </span>
        )}
      </div>
      <div className="statusbar__spacer" />
    </footer>
  )
}
