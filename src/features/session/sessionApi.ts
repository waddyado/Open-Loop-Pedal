import { audioEngine } from '@/audio/AudioEngine'
import { computePeaks } from '@/utils/peaks'
import { encodeWavMono, decodeWavToAudioBuffer } from '@/utils/wav'
import { cloneEffectSections, coerceEffectSections, type EffectSectionsState } from '@/store/effectTypes'
import type { TrackMeta } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'

export type SessionFileV2 = {
  version: 2
  sessionName: string
  bpm: number
  timeSigNumerator: number
  timeSigDenominator: number
  measures: number
  metronomeEnabled: boolean
  recordCountdownBeats: 0 | 1 | 2 | 4
  masterVolume: number
  monitoringEnabled: boolean
  playTracksWhileRecording?: boolean
  recordPlaybackIncludeMode?: 'all' | 'custom'
  globalEffects: EffectSectionsState
  tracks: Array<
    Omit<TrackMeta, 'peaks'> & {
      peaks?: number[]
      audioFile?: string
      effects?: EffectSectionsState
    }
  >
}

/** Electron IPC often delivers file bytes as Uint8Array; decodeAudioData needs a real ArrayBuffer. */
export function ipcPayloadToArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data.slice(0)
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  }
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView
    return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)
  }
  throw new Error('Invalid audio binary from save (expected ArrayBuffer or TypedArray)')
}

export type SaveListItem = {
  folderName: string
  sessionName: string
  mtimeMs: number
  trackCount: number
  bpm: number | null
  timeSigNumerator: number | null
  timeSigDenominator: number | null
  broken?: boolean
}

function api() {
  const a = window.openLoopPedal
  if (!a) throw new Error('Session I/O is only available in the desktop app.')
  return a
}

export async function listSavedSessions(): Promise<SaveListItem[]> {
  return api().listSaves()
}

export async function saveCurrentSession(saveName: string): Promise<void> {
  const s = useAppStore.getState()
  const name = saveName.trim() || 'Untitled'
  const audioFiles: { name: string; data: ArrayBuffer }[] = []
  for (const t of s.tracks) {
    if (!t.hasAudio) continue
    const buf = audioEngine.getTrackBuffer(t.id)
    if (!buf) continue
    const ch = buf.getChannelData(0)
    const wav = encodeWavMono(new Float32Array(ch), buf.sampleRate)
    audioFiles.push({ name: `${t.id}.wav`, data: wav })
  }
  const payload: SessionFileV2 = {
    version: 2,
    sessionName: name,
    bpm: s.bpm,
    timeSigNumerator: s.timeSigNumerator,
    timeSigDenominator: s.timeSigDenominator,
    measures: s.measures,
    metronomeEnabled: s.metronomeEnabled,
    recordCountdownBeats: s.recordCountdownBeats,
    masterVolume: s.masterVolume,
    monitoringEnabled: s.monitoringEnabled,
    playTracksWhileRecording: s.playTracksWhileRecording,
    recordPlaybackIncludeMode: s.recordPlaybackIncludeMode,
    globalEffects: cloneEffectSections(s.globalEffects),
    tracks: s.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      muted: t.muted,
      solo: t.solo,
      volume: t.volume,
      pan: t.pan,
      loopMeasures: t.loopMeasures,
      hasAudio: t.hasAudio,
      peaks: t.peaks,
      effects: cloneEffectSections(t.effects),
      includeInRecordPlayback: t.includeInRecordPlayback,
      audioFile: t.hasAudio ? `${t.id}.wav` : undefined,
    })),
  }
  const { folderName } = await api().saveSessionInternal(name, JSON.stringify(payload, null, 2), audioFiles)
  useAppStore.getState().setActiveSaveFolderKey(folderName)
}

/**
 * Load a session from disk. `folderName` must be the on-disk folder basename (as returned by list saves).
 */
export async function loadSavedSession(folderName: string): Promise<void> {
  audioEngine.cancelCountdown()
  audioEngine.discardRecordingCapture()

  let sessionJson: string
  let audioBuffers: { id: string; data: ArrayBuffer }[]
  try {
    const res = await api().loadSessionInternal(folderName)
    sessionJson = res.sessionJson
    audioBuffers = res.audioBuffers.map((b) => ({
      id: b.id,
      data: ipcPayloadToArrayBuffer(b.data),
    }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Load failed'
    throw new Error(msg)
  }

  const data = JSON.parse(sessionJson) as SessionFileV2 & { version?: number; pedals?: unknown }
  const ctx = await audioEngine.resume()

  audioEngine.resetAllTracksForSession()

  useAppStore.getState().setTransport('stopped')
  useAppStore.getState().clearTrackSelection()
  useAppStore.getState().setActiveSaveFolderKey(folderName)

  useAppStore.getState().setSessionName(data.sessionName ?? folderName)
  useAppStore.getState().setBpm(data.bpm ?? 120)
  useAppStore.getState().setTimeSig(data.timeSigNumerator ?? 4, data.timeSigDenominator ?? 4)
  useAppStore.getState().setMeasures(data.measures ?? 4)
  useAppStore.getState().setMetronome(data.metronomeEnabled ?? false)
  useAppStore.getState().setRecordCountdownBeats(data.recordCountdownBeats ?? 2)
  useAppStore.getState().setMasterVolume(data.masterVolume ?? 0.85)
  useAppStore.getState().setMonitoring(data.monitoringEnabled ?? false)
  useAppStore.setState({
    playTracksWhileRecording: data.playTracksWhileRecording ?? false,
    recordPlaybackIncludeMode: data.recordPlaybackIncludeMode === 'custom' ? 'custom' : 'all',
  })

  useAppStore.setState({ globalEffects: coerceEffectSections(data.globalEffects) })

  const bufMap = new Map(audioBuffers.map((b) => [b.id, b.data]))
  const defLoop = data.measures ?? 4
  const tracks: TrackMeta[] = []

  for (const t of data.tracks ?? []) {
    const peaks = t.peaks?.length ? t.peaks : []
    const loopMeasures =
      typeof t.loopMeasures === 'number' ? Math.max(1, Math.min(64, t.loopMeasures)) : defLoop
    const effects = coerceEffectSections(t.effects)
    const rawBuf = bufMap.get(t.id)
    let hasAudio = false
    let decoded: AudioBuffer | null = null

    if (rawBuf && rawBuf.byteLength > 0) {
      try {
        decoded = await decodeWavToAudioBuffer(ctx, rawBuf)
        hasAudio = true
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[olp] WAV decode failed for track', t.id, err)
      }
    }

    if (decoded) {
      audioEngine.setTrackBuffer(t.id, decoded)
      const ch = decoded.getChannelData(0)
      const p = peaks.length ? peaks : computePeaks(ch, 200)
      tracks.push({
        id: t.id,
        name: t.name,
        muted: t.muted,
        solo: t.solo,
        volume: t.volume,
        pan: t.pan,
        loopMeasures,
        hasAudio,
        peaks: p,
        effects,
        includeInRecordPlayback: t.includeInRecordPlayback !== false,
      })
    } else {
      tracks.push({
        id: t.id,
        name: t.name,
        muted: t.muted,
        solo: t.solo,
        volume: t.volume,
        pan: t.pan,
        loopMeasures,
        hasAudio: false,
        peaks: t.peaks?.length ? t.peaks : [],
        effects,
        includeInRecordPlayback: t.includeInRecordPlayback !== false,
      })
    }
  }

  useAppStore.getState().updateTrackFromLoad(tracks)
  for (const t of tracks) {
    audioEngine.ensureTrackRouting(t.id)
  }
  audioEngine.updateTrackMix(tracks)
  audioEngine.syncEffectChains(useAppStore.getState().globalEffects, tracks)

  const s = useAppStore.getState()
  audioEngine.setMicRouting(s.selectedTrackId, s.monitoringEnabled)
  audioEngine.setMasterVolume(s.masterVolume)
}

export async function deleteSavedSession(folderName: string): Promise<void> {
  await api().deleteSessionInternal(folderName)
}
