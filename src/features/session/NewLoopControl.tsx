import { useCallback, useState } from 'react'
import { NewLoopConfirmModal } from '@/components/NewLoopConfirmModal'
import { performNewLoopReset } from '@/features/session/newLoopSession'
import { sessionHasRecordedAudio } from '@/features/session/sessionProgress'
import { useAppStore } from '@/store/useAppStore'

export function NewLoopControl() {
  const tracks = useAppStore((s) => s.tracks)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const startNewLoop = useCallback(() => {
    performNewLoopReset()
    setConfirmOpen(false)
  }, [])

  const onNewLoopClick = useCallback(() => {
    if (sessionHasRecordedAudio(tracks)) {
      setConfirmOpen(true)
      return
    }
    startNewLoop()
  }, [tracks, startNewLoop])

  return (
    <>
      <div className="new-loop-control">
        <button type="button" className="btn btn--small new-loop-control__btn" onClick={onNewLoopClick}>
          New Loop
        </button>
        <p className="new-loop-control__hint">Start an empty session. You&apos;ll be asked to confirm if any track has recorded audio.</p>
      </div>
      <NewLoopConfirmModal open={confirmOpen} onCancel={() => setConfirmOpen(false)} onConfirm={startNewLoop} />
    </>
  )
}
