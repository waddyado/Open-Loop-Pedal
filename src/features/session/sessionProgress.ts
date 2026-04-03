import { audioEngine } from '@/audio/AudioEngine'
import type { TrackMeta } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'

/**
 * True if the session has real recorded material: any track marked with audio,
 * or any non-empty clip registered in the audio engine (covers minor store/engine desync).
 */
export function sessionHasRecordedAudio(tracks?: TrackMeta[]): boolean {
  const list = tracks ?? useAppStore.getState().tracks
  for (const t of list) {
    const buf = audioEngine.getTrackBuffer(t.id)
    if (buf != null && buf.length > 0) return true
    if (t.hasAudio) return true
  }
  return false
}
