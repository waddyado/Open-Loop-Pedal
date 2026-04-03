import { useEffect, useState } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { loopDurationSeconds, masterLoopMeasures } from '@/audio/loopMath'
import { TrackRow } from '@/features/tracks/TrackRow'
import { useAppStore } from '@/store/useAppStore'

export function TimelineFooter() {
  const tracks = useAppStore((s) => s.tracks)
  const bpm = useAppStore((s) => s.bpm)
  const sigN = useAppStore((s) => s.timeSigNumerator)
  const sigD = useAppStore((s) => s.timeSigDenominator)
  const sessionMeasures = useAppStore((s) => s.measures)
  const transport = useAppStore((s) => s.transport)
  const createTrack = useAppStore((s) => s.createTrack)

  const [masterPhase01, setMasterPhase01] = useState(0)
  const masterM = masterLoopMeasures(tracks, sessionMeasures)
  const L = loopDurationSeconds(bpm, sigN, masterM)
  const masterBeats = masterM * sigN

  useEffect(() => {
    let raf = 0
    let alive = true
    const tick = () => {
      if (!alive) return
      if (transport === 'playing' || transport === 'recording') {
        const ph = audioEngine.getPhaseInLoop()
        setMasterPhase01(L > 0 ? ph / L : 0)
      } else {
        setMasterPhase01(0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [transport, L])

  return (
    <footer className="timeline-footer">
      <div className="timeline-footer__head">
        <h2 className="timeline-footer__title">Loop timeline</h2>
        <span className="timeline-footer__meta">
          Master: {masterM} bars · {sigN}/{sigD} @ {bpm} BPM · {L.toFixed(2)}s
          <span className="timeline-footer__resize-hint">
            {' '}
            · Longest track sets master length · shorter tracks repeat inside it · Drag bar above to resize timeline
          </span>
        </span>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const id = createTrack()
            void audioEngine.resume().then(() => audioEngine.ensureTrackRouting(id))
          }}
        >
          + New track
        </button>
      </div>
      <div className="timeline-footer__ruler" aria-hidden>
        {Array.from({ length: masterBeats }, (_, i) => (
          <span key={i} className="timeline-footer__beat" style={{ flex: 1 }}>
            {(i % sigN === 0 ? `M${Math.floor(i / sigN) + 1}` : '') || '·'}
          </span>
        ))}
      </div>
      <div className="timeline-footer__lanes">
        {tracks.length === 0 ? (
          <div className="timeline-footer__empty">
            <p>No tracks yet. Add a track, arm it, set its bar length, then press Record.</p>
            <p className="timeline-footer__empty-sub">
              Sidebar &quot;Loop measures&quot; is the default for new tracks. Each row can use a shorter loop inside the master grid.
            </p>
          </div>
        ) : (
          tracks.map((t) => <TrackRow key={t.id} track={t} masterPhase01={masterPhase01} />)
        )}
      </div>
    </footer>
  )
}
