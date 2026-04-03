import { audioEngine } from '@/audio/AudioEngine'
import { useAppStore } from '@/store/useAppStore'

/** Stop transport/recording, tear down track audio graph, reset session state to app defaults. Preserves I/O device selection. */
export function performNewLoopReset(): void {
  audioEngine.cancelCountdown()
  audioEngine.discardRecordingCapture()
  audioEngine.stopMetronome()
  audioEngine.stopSources()
  audioEngine.resetAllTracksForSession()

  useAppStore.getState().resetToNewLoop()

  const s = useAppStore.getState()
  audioEngine.setLoopParams(s.bpm, s.timeSigNumerator, s.getMasterLoopMeasures())
  audioEngine.setMasterVolume(s.masterVolume)
  audioEngine.setMonitoring(s.monitoringEnabled)
  audioEngine.setMicRouting(s.selectedTrackId, s.monitoringEnabled)
  audioEngine.syncEffectChains(s.globalEffects, s.tracks)
}
