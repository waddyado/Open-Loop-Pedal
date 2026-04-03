import { useCallback, useRef } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { loopDurationSeconds } from '@/audio/loopMath'
import { computePeaks } from '@/utils/peaks'
import { useAppStore } from '@/store/useAppStore'

export function TransportSection() {
  const transport = useAppStore((s) => s.transport)
  const selectedTrackId = useAppStore((s) => s.selectedTrackId)
  const tracks = useAppStore((s) => s.tracks)
  const setTransport = useAppStore((s) => s.setTransport)
  const recordCountdownBeats = useAppStore((s) => s.recordCountdownBeats)
  const setCountdownBeatsLeft = useAppStore((s) => s.setCountdownBeatsLeft)
  const setTrackHasAudio = useAppStore((s) => s.setTrackHasAudio)
  const setTrackPeaks = useAppStore((s) => s.setTrackPeaks)
  const setInputError = useAppStore((s) => s.setInputError)
  const countdownBeatsLeft = useAppStore((s) => s.countdownBeatsLeft)

  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordFinalizeDoneRef = useRef(false)

  const stopAll = useCallback(() => {
    audioEngine.cancelCountdown()
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    audioEngine.stopSources()
    audioEngine.discardRecordingCapture()
  }, [])

  const handleStart = useCallback(async () => {
    setInputError(null)
    await audioEngine.resume()
    const s = useAppStore.getState()
    audioEngine.syncEffectChains(s.globalEffects, s.tracks)
    audioEngine.setMasterVolume(s.masterVolume)
    audioEngine.setMonitoring(s.monitoringEnabled)
    audioEngine.setMicRouting(s.selectedTrackId, s.monitoringEnabled)
    const masterM = s.getMasterLoopMeasures()
    audioEngine.setLoopParams(s.bpm, s.timeSigNumerator, masterM)
    for (const t of s.tracks) {
      audioEngine.ensureTrackRouting(t.id)
    }
    audioEngine.updateTrackMix(s.tracks)
    audioEngine.startPlayback(s.tracks, s.bpm, s.timeSigNumerator, masterM)
    setTransport('playing')
  }, [setInputError, setTransport, tracks])

  const finalizeRecording = useCallback(
    async (trackId: string) => {
      if (recordFinalizeDoneRef.current) return
      recordFinalizeDoneRef.current = true
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }

      audioEngine.stopSources()
      const chunks = await audioEngine.stopRecordingCaptureAsync()

      let total = 0
      for (const c of chunks) total += c.length
      const merged = new Float32Array(total)
      let o = 0
      for (const c of chunks) {
        merged.set(c, o)
        o += c.length
      }

      const ctx = audioEngine.getContext()
      const st = useAppStore.getState()
      const track = st.tracks.find((x) => x.id === trackId)
      const m = track?.loopMeasures ?? st.measures
      const L = loopDurationSeconds(st.bpm, st.timeSigNumerator, m)
      const buffer = audioEngine.buildLoopAudioBuffer(merged, ctx.sampleRate, L)
      audioEngine.setTrackBuffer(trackId, buffer)
      setTrackHasAudio(trackId, true)
      const ch = buffer.getChannelData(0)
      setTrackPeaks(trackId, computePeaks(ch, 200))
      setTransport('stopped')
      useAppStore.getState().setDisplayBarBeat(1, 1)

      if (import.meta.env.DEV) {
        console.debug('[olp] recording finalized', { trackId, samples: total, loopSec: L })
      }
    },
    [setTrackHasAudio, setTrackPeaks, setTransport]
  )

  const beginRecording = useCallback(
    (loopAnchorAudioTime: number) => {
      const s = useAppStore.getState()
      const id = s.selectedTrackId
      if (!id) {
        setInputError('Select a track before recording.')
        setTransport('stopped')
        return
      }
      const track = s.tracks.find((x) => x.id === id)
      const loopM = track?.loopMeasures ?? s.measures
      setInputError(null)
      recordFinalizeDoneRef.current = false

      audioEngine.stopSources()
      setTransport('recording')
      audioEngine.ensureTrackRouting(id)
      const masterM = s.getMasterLoopMeasures()
      audioEngine.setLoopParams(s.bpm, s.timeSigNumerator, masterM)
      audioEngine.markLoopOriginAt(loopAnchorAudioTime)
      audioEngine.startRecordingCapture()

      audioEngine.startBackingDuringRecord(s.tracks, id, {
        enabled: s.playTracksWhileRecording,
        includeMode: s.recordPlaybackIncludeMode,
      })

      const L = loopDurationSeconds(s.bpm, s.timeSigNumerator, loopM)
      recordTimerRef.current = setTimeout(() => {
        recordTimerRef.current = null
        void finalizeRecording(id)
      }, L * 1000)
    },
    [finalizeRecording, setInputError, setTransport]
  )

  const handleStop = useCallback(() => {
    const st = useAppStore.getState()

    if (st.transport === 'countdown') {
      audioEngine.cancelCountdown()
      audioEngine.discardRecordingCapture()
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }
      setCountdownBeatsLeft(0)
      setTransport('stopped')
      useAppStore.getState().setDisplayBarBeat(1, 1)
      return
    }

    if (st.transport === 'recording') {
      const id = st.selectedTrackId
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current)
        recordTimerRef.current = null
      }
      if (id) void finalizeRecording(id)
      else {
        audioEngine.stopSources()
        audioEngine.discardRecordingCapture()
        setTransport('stopped')
      }
      return
    }

    stopAll()
    setTransport('stopped')
    useAppStore.getState().setDisplayBarBeat(1, 1)
  }, [finalizeRecording, setCountdownBeatsLeft, setTransport, stopAll])

  const handleRecord = useCallback(async () => {
    if (transport === 'recording' || transport === 'countdown') return
    setInputError(null)
    await audioEngine.resume()
    const s = useAppStore.getState()
    if (!s.selectedTrackId) {
      setInputError('Select a track before recording.')
      return
    }
    if (!s.inputAvailable) {
      setInputError('Microphone not available. Check device and permissions.')
      return
    }
    audioEngine.syncEffectChains(s.globalEffects, s.tracks)
    audioEngine.setMasterVolume(s.masterVolume)
    audioEngine.setMonitoring(s.monitoringEnabled)
    audioEngine.setMicRouting(s.selectedTrackId, s.monitoringEnabled)

    const n = s.recordCountdownBeats
    if (n > 0) {
      setTransport('countdown')
      setCountdownBeatsLeft(n)
      audioEngine.startCountIn({
        beats: n,
        bpm: s.bpm,
        onUIBeatsRemaining: (remaining) => {
          if (useAppStore.getState().transport !== 'countdown') return
          setCountdownBeatsLeft(remaining)
        },
        onRecordStart: (anchorAudioTime) => {
          setCountdownBeatsLeft(0)
          beginRecording(anchorAudioTime)
        },
      })
    } else {
      const ctx = audioEngine.getContext()
      beginRecording(ctx.currentTime)
    }
  }, [beginRecording, transport, setCountdownBeatsLeft, setInputError, setTransport])

  const playing = transport === 'playing'
  const recording = transport === 'recording'
  const countdown = transport === 'countdown'
  const selectedName = selectedTrackId ? tracks.find((t) => t.id === selectedTrackId)?.name ?? '(unknown)' : null

  const transportLabel =
    transport === 'stopped'
      ? 'Idle'
      : transport === 'playing'
        ? 'Playing'
        : transport === 'recording'
          ? 'Recording'
          : transport === 'countdown'
            ? `Count-in (${countdownBeatsLeft})`
            : transport

  return (
    <div className="transport-section">
      <div className="transport-section__status" role="status">
        <span className="transport-section__state">{transportLabel}</span>
        {selectedName ? (
          <span className="transport-section__target">
            Record / FX target: <strong>{selectedName}</strong>
          </span>
        ) : (
          <span className="transport-section__target transport-section__target--warn">No track selected — select a row to record</span>
        )}
      </div>
      <div className="transport-section__row">
        <button type="button" className="btn btn--primary" onClick={() => void handleStart()} disabled={playing || recording || countdown}>
          Start
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleStop} disabled={!playing && !recording && !countdown}>
          Stop
        </button>
        <button
          type="button"
          className={`btn btn--record ${recording ? 'btn--record-active' : ''}`}
          onClick={() => void handleRecord()}
          disabled={recording || countdown}
        >
          Record
        </button>
      </div>
      <p className="transport-section__hint">
        Start / Stop: loop playback. Record: one pass into the <strong>selected</strong> track (bars = that track&apos;s length). Stop during record saves
        whatever was captured so far.
        {recordCountdownBeats ? ` Count-in: ${recordCountdownBeats} beat(s).` : ''}
      </p>
    </div>
  )
}
