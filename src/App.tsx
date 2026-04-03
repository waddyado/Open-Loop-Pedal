import { useAudioEngineSync } from '@/hooks/useAudioEngine'
import { useTimelinePaneHeight } from '@/hooks/useTimelinePaneHeight'
import { Pedalboard } from '@/features/layout/Pedalboard'
import { Sidebar } from '@/features/layout/Sidebar'
import { TimelineFooter } from '@/features/layout/TimelineFooter'

export default function App() {
  useAudioEngineSync()
  const { footerHeightPx, timelineMaxPx, splitterHandlers } = useTimelinePaneHeight()

  return (
    <div className="app-shell">
      <Sidebar />
      <div
        className="app-shell__main"
        style={{ gridTemplateRows: `minmax(0, 1fr) var(--timeline-splitter, 6px) ${footerHeightPx}px` }}
      >
        <Pedalboard />
        <div
          className="timeline-splitter"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize loop timeline. Double-click to reset height."
          aria-valuenow={footerHeightPx}
          aria-valuemin={100}
          aria-valuemax={timelineMaxPx}
          {...splitterHandlers}
        />
        <TimelineFooter />
      </div>
    </div>
  )
}
