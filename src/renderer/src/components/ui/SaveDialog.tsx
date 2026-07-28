import { useEffect, useRef } from 'react'
import './SaveDialog.css'

interface SaveDialogProps {
  title: string
  message: string
  hint: string
  saveLabel: string
  discardLabel: string
  cancelLabel: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

/** Asks what to do with unsaved changes before a file or window closes. */
export function SaveDialog({
  title,
  message,
  hint,
  saveLabel,
  discardLabel,
  cancelLabel,
  onSave,
  onDiscard,
  onCancel
}: SaveDialogProps): JSX.Element {
  const saveRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    saveRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onSave])

  return (
    <div className="savedlg__backdrop" onMouseDown={onCancel}>
      <div
        className="savedlg"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="savedlg__title">{title}</div>
        <div className="savedlg__message">{message}</div>
        <div className="savedlg__hint">{hint}</div>
        <div className="savedlg__row">
          <button
            type="button"
            className="savedlg__btn savedlg__btn--ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <div className="savedlg__spacer" />
          <button
            type="button"
            className="savedlg__btn"
            onClick={onDiscard}
          >
            {discardLabel}
          </button>
          <button
            ref={saveRef}
            type="button"
            className="savedlg__btn savedlg__btn--primary"
            onClick={onSave}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
