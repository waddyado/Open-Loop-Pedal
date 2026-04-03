import { useEffect } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { masterLoopMeasures } from '@/audio/loopMath'
import { useAppStore } from '@/store/useAppStore'

/** Keeps Web Audio graph in sync with store; call once near app root. */
export function useAudioEngineSync(): void {
  const bpm = useAppStore((s) => s.bpm)
  const sigN = useAppStore((s) => s.timeSigNumerator)
  const measures = useAppStore((s) => s.measures)
  const masterVolume = useAppStore((s) => s.masterVolume)
  const monitoring = useAppStore((s) => s.monitoringEnabled)
  const selectedTrackId = useAppStore((s) => s.selectedTrackId)
  const globalEffects = useAppStore((s) => s.globalEffects)
  const tracks = useAppStore((s) => s.tracks)
  const metronomeEnabled = useAppStore((s) => s.metronomeEnabled)
  const transport = useAppStore((s) => s.transport)
  const outputDeviceId = useAppStore((s) => s.outputDeviceId)

  useEffect(() => {
    const masterM = masterLoopMeasures(tracks, measures)
    audioEngine.setLoopParams(bpm, sigN, masterM)
  }, [bpm, sigN, measures, tracks])

  useEffect(() => {
    void audioEngine.resume().then(() => {
      audioEngine.setMasterVolume(masterVolume)
    })
  }, [masterVolume])

  useEffect(() => {
    void audioEngine.resume().then(() => {
      audioEngine.setMonitoring(monitoring)
      audioEngine.setMicRouting(selectedTrackId, monitoring)
    })
  }, [monitoring, selectedTrackId])

  useEffect(() => {
    void audioEngine.resume().then(() => {
      audioEngine.syncEffectChains(globalEffects, tracks)
    })
  }, [globalEffects, tracks])

  useEffect(() => {
    audioEngine.setMetronomeEnabled(metronomeEnabled)
    if (metronomeEnabled && (transport === 'playing' || transport === 'recording')) {
      void audioEngine.resume().then(() => audioEngine.startMetronome(bpm, sigN))
    } else {
      audioEngine.stopMetronome()
    }
  }, [metronomeEnabled, transport, bpm, sigN])

  useEffect(() => {
    void audioEngine.resume().then(() => {
      void audioEngine.setOutputDevice(outputDeviceId)
    })
  }, [outputDeviceId])

  useEffect(() => {
    void audioEngine.resume().then(() => {
      audioEngine.updateTrackMix(tracks)
    })
  }, [tracks])

  useEffect(() => {
    let raf = 0
    let alive = true
    const tick = () => {
      if (!alive) return
      const t = useAppStore.getState().transport
      if (t === 'playing' || t === 'recording') {
        const { bar, beat } = audioEngine.getDisplayBarBeat()
        useAppStore.getState().setDisplayBarBeat(bar, beat)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])
}
