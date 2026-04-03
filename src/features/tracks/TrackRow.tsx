import { WaveformLane } from '@/components/WaveformLane'
import { audioEngine } from '@/audio/AudioEngine'
import { loopDurationSeconds, masterLoopMeasures } from '@/audio/loopMath'
import type { TrackMeta } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'
import { useMemo } from 'react'

type Props = {
  track: TrackMeta
  /** Phase 0..1 within the master loop (all tracks share transport). */
  masterPhase01: number
}

export function TrackRow({ track, masterPhase01 }: Props) {
  const renameTrack = useAppStore((s) => s.renameTrack)
  const setMuted = useAppStore((s) => s.setTrackMuted)
  const setSolo = useAppStore((s) => s.setTrackSolo)
  const setVolume = useAppStore((s) => s.setTrackVolume)
  const setPan = useAppStore((s) => s.setTrackPan)
  const setLoopMeasures = useAppStore((s) => s.setTrackLoopMeasures)
  const toggleSelectTrack = useAppStore((s) => s.toggleSelectTrack)
  const selectedTrackId = useAppStore((s) => s.selectedTrackId)
  const deleteTrack = useAppStore((s) => s.deleteTrack)
  const setIncludeRecPlay = useAppStore((s) => s.setTrackIncludeInRecordPlayback)
  const recordPlaybackIncludeMode = useAppStore((s) => s.recordPlaybackIncludeMode)
  const bpm = useAppStore((s) => s.bpm)
  const sigN = useAppStore((s) => s.timeSigNumerator)
  const sessionMeasures = useAppStore((s) => s.measures)
  const allTracks = useAppStore((s) => s.tracks)

  const selected = selectedTrackId === track.id

  const { lanePhase01, beatsInTrack } = useMemo(() => {
    const masterM = masterLoopMeasures(allTracks, sessionMeasures)
    const Lm = loopDurationSeconds(bpm, sigN, masterM)
    const Lt = loopDurationSeconds(bpm, sigN, track.loopMeasures)
    const tSec = masterPhase01 * Lm
    const inTrack = Lt > 1e-9 ? ((tSec % Lt) + Lt) % Lt : 0
    const lanePhase01 = Lt > 1e-9 ? inTrack / Lt : 0
    const beatsInTrack = Math.max(1, track.loopMeasures) * sigN
    return { lanePhase01, beatsInTrack }
  }, [allTracks, sessionMeasures, bpm, sigN, track.loopMeasures, masterPhase01])

  return (
    <div className={`track-row ${selected ? 'track-row--selected' : ''}`}>
      <div
        className="track-row__controls"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          className="track-row__name"
          value={track.name}
          onChange={(e) => renameTrack(track.id, e.target.value)}
          aria-label="Track name"
        />
        <div className="track-row__btn-row">
          <button type="button" className={`btn btn--tiny ${track.muted ? 'btn--active' : ''}`} onClick={() => setMuted(track.id, !track.muted)}>
            M
          </button>
          <button type="button" className={`btn btn--tiny ${track.solo ? 'btn--active' : ''}`} onClick={() => setSolo(track.id, !track.solo)}>
            S
          </button>
        </div>
        <label className="track-row__field">
          <span className="track-row__field-label">Bars</span>
          <input
            className="track-row__bars-input"
            type="number"
            min={1}
            max={64}
            value={track.loopMeasures}
            onChange={(e) => setLoopMeasures(track.id, Number(e.target.value) || 1)}
            title="This track’s loop length in measures (repeats inside the master loop)"
          />
        </label>
        <label className="track-row__slider-label">
          Vol
          <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => setVolume(track.id, Number(e.target.value))} />
        </label>
        <label className="track-row__slider-label">
          Pan
          <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => setPan(track.id, Number(e.target.value))} />
        </label>
        <label
          className={`track-row__rec-play ${recordPlaybackIncludeMode !== 'custom' ? 'track-row__rec-play--dim' : ''}`}
          title="When ‘Custom’ backing mode is on, include this track during record. Ignored in ‘All eligible’ mode."
        >
          <input
            type="checkbox"
            checked={track.includeInRecordPlayback}
            disabled={recordPlaybackIncludeMode !== 'custom'}
            onChange={(e) => setIncludeRecPlay(track.id, e.target.checked)}
          />
          <span>Rec play</span>
        </label>
        <button
          type="button"
          className="btn btn--tiny btn--danger"
          onClick={() => {
            audioEngine.removeTrackRouting(track.id)
            deleteTrack(track.id)
          }}
        >
          Del
        </button>
      </div>
      <button
        type="button"
        className="track-row__body"
        onClick={() => toggleSelectTrack(track.id)}
        aria-pressed={selected}
        aria-label={`Select track ${track.name}`}
      >
        <WaveformLane peaks={track.peaks} phase01={lanePhase01} beatsInLoop={beatsInTrack} />
      </button>
    </div>
  )
}
