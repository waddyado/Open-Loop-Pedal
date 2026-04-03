import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function NewLoopConfirmModal({ open, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="olp-modal" role="dialog" aria-modal="true" aria-labelledby="olp-new-loop-title">
      <button type="button" className="olp-modal__backdrop" aria-label="Close dialog" onClick={onCancel} />
      <div className="olp-modal__panel">
        <h2 id="olp-new-loop-title" className="olp-modal__title">
          Create new loop?
        </h2>
        <p className="olp-modal__body">
          Are you sure you want to create a new loop? Your current progress will be lost.
        </p>
        <div className="olp-modal__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            Create New Loop
          </button>
        </div>
      </div>
    </div>
  )
}
