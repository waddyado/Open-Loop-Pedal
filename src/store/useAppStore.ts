import { create } from 'zustand'
import { loopDurationSeconds, masterLoopMeasures } from '@/audio/loopMath'
import { cloneEffectSections, defaultEffectSections, type EffectSectionsState } from '@/store/effectTypes'

export type { EffectSectionsState, ModKind } from '@/store/effectTypes'

export type TransportState = 'stopped' | 'playing' | 'recording' | 'countdown'

export type RecordPlaybackIncludeMode = 'all' | 'custom'

export type TrackMeta = {
  id: string
  name: string
  muted: boolean
  solo: boolean
  volume: number
  pan: number
  loopMeasures: number
  peaks: number[]
  hasAudio: boolean
  effects: EffectSectionsState
  /** When record playback mode is “custom”, this track is included in backing during record. */
  includeInRecordPlayback: boolean
}

export type AppState = {
  sessionName: string
  bpm: number
  timeSigNumerator: number
  timeSigDenominator: number
  measures: number
  transport: TransportState
  countdownBeatsLeft: number
  recordCountdownBeats: 0 | 1 | 2 | 4
  metronomeEnabled: boolean
  masterVolume: number
  /** Live input monitoring (mic → selected track FX → speakers). Use headphones. */
  monitoringEnabled: boolean
  /** Hear other tracks as backing while recording a new take. */
  playTracksWhileRecording: boolean
  /** With backing on: include all eligible tracks, or only those with includeInRecordPlayback. */
  recordPlaybackIncludeMode: RecordPlaybackIncludeMode
  inputDeviceId: string
  outputDeviceId: string
  selectedTrackId: string | null
  tracks: TrackMeta[]
  globalEffects: EffectSectionsState
  inputError: string | null
  inputAvailable: boolean
  displayBar: number
  displayBeat: number
  /** Basename of the save folder for the session last saved/loaded (for sidebar highlight). */
  activeSaveFolderKey: string | null

  setSessionName: (n: string) => void
  setBpm: (b: number) => void
  setTimeSig: (num: number, den: number) => void
  setMeasures: (m: number) => void
  setTransport: (t: TransportState) => void
  setCountdownBeatsLeft: (n: number) => void
  setRecordCountdownBeats: (n: 0 | 1 | 2 | 4) => void
  setMetronome: (on: boolean) => void
  setMasterVolume: (v: number) => void
  setMonitoring: (on: boolean) => void
  setPlayTracksWhileRecording: (on: boolean) => void
  setRecordPlaybackIncludeMode: (m: RecordPlaybackIncludeMode) => void
  setInputDeviceId: (id: string) => void
  setOutputDeviceId: (id: string) => void
  toggleSelectTrack: (id: string) => void
  clearTrackSelection: () => void
  setInputError: (e: string | null) => void
  setInputAvailable: (v: boolean) => void
  setDisplayBarBeat: (bar: number, beat: number) => void
  setActiveSaveFolderKey: (folderKey: string | null) => void
  /** Clear tracks/clips and session identity; restore default loop + FX settings. Keeps I/O device IDs. */
  resetToNewLoop: () => void

  createTrack: () => string
  deleteTrack: (id: string) => void
  renameTrack: (id: string, name: string) => void
  setTrackMuted: (id: string, m: boolean) => void
  setTrackSolo: (id: string, s: boolean) => void
  setTrackVolume: (id: string, v: number) => void
  setTrackPan: (id: string, p: number) => void
  setTrackLoopMeasures: (id: string, m: number) => void
  setTrackPeaks: (id: string, peaks: number[]) => void
  setTrackHasAudio: (id: string, has: boolean) => void
  setTrackIncludeInRecordPlayback: (id: string, on: boolean) => void
  updateTrackFromLoad: (tracks: TrackMeta[]) => void

  patchGlobalEffects: (section: keyof EffectSectionsState, partial: Partial<EffectSectionsState[keyof EffectSectionsState]>) => void
  patchTrackEffects: (
    trackId: string,
    section: keyof EffectSectionsState,
    partial: Partial<EffectSectionsState[keyof EffectSectionsState]>
  ) => void

  getLoopDurationSec: () => number
  getMasterLoopMeasures: () => number
  getActiveEffects: () => EffectSectionsState
}

function uid(): string {
  return `t_${Math.random().toString(36).slice(2, 11)}`
}

const defaultTrack = (loopMeasures: number): TrackMeta => ({
  id: uid(),
  name: 'Track',
  muted: false,
  solo: false,
  volume: 1,
  pan: 0,
  loopMeasures: Math.max(1, Math.min(64, loopMeasures)),
  peaks: [],
  hasAudio: false,
  effects: defaultEffectSections(),
  includeInRecordPlayback: true,
})

export const useAppStore = create<AppState>((set, get) => ({
  sessionName: 'Untitled session',
  bpm: 120,
  timeSigNumerator: 4,
  timeSigDenominator: 4,
  measures: 4,
  transport: 'stopped',
  countdownBeatsLeft: 0,
  recordCountdownBeats: 2,
  metronomeEnabled: false,
  masterVolume: 0.85,
  monitoringEnabled: false,
  playTracksWhileRecording: false,
  recordPlaybackIncludeMode: 'all',
  inputDeviceId: '',
  outputDeviceId: '',
  selectedTrackId: null,
  tracks: [],
  globalEffects: defaultEffectSections(),
  inputError: null,
  inputAvailable: false,
  displayBar: 1,
  displayBeat: 1,
  activeSaveFolderKey: null,

  setSessionName: (sessionName) => set({ sessionName }),
  setBpm: (bpm) => set({ bpm }),
  setTimeSig: (timeSigNumerator, timeSigDenominator) => set({ timeSigNumerator, timeSigDenominator }),
  setMeasures: (measures) => set({ measures: Math.max(1, Math.min(64, measures)) }),
  setTransport: (transport) => set({ transport }),
  setCountdownBeatsLeft: (countdownBeatsLeft) => set({ countdownBeatsLeft }),
  setRecordCountdownBeats: (recordCountdownBeats) => set({ recordCountdownBeats }),
  setMetronome: (metronomeEnabled) => set({ metronomeEnabled }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setMonitoring: (monitoringEnabled) => set({ monitoringEnabled }),
  setPlayTracksWhileRecording: (playTracksWhileRecording) => set({ playTracksWhileRecording }),
  setRecordPlaybackIncludeMode: (recordPlaybackIncludeMode) => set({ recordPlaybackIncludeMode }),
  setInputDeviceId: (inputDeviceId) => set({ inputDeviceId }),
  setOutputDeviceId: (outputDeviceId) => set({ outputDeviceId }),

  toggleSelectTrack: (id) =>
    set((s) => ({
      selectedTrackId: s.selectedTrackId === id ? null : id,
    })),
  clearTrackSelection: () => set({ selectedTrackId: null }),

  setInputError: (inputError) => set({ inputError }),
  setInputAvailable: (inputAvailable) => set({ inputAvailable }),
  setDisplayBarBeat: (displayBar, displayBeat) => set({ displayBar, displayBeat }),
  setActiveSaveFolderKey: (activeSaveFolderKey) => set({ activeSaveFolderKey }),

  resetToNewLoop: () =>
    set({
      sessionName: 'Untitled session',
      bpm: 120,
      timeSigNumerator: 4,
      timeSigDenominator: 4,
      measures: 4,
      transport: 'stopped',
      countdownBeatsLeft: 0,
      recordCountdownBeats: 2,
      metronomeEnabled: false,
      masterVolume: 0.85,
      monitoringEnabled: false,
      playTracksWhileRecording: false,
      recordPlaybackIncludeMode: 'all',
      selectedTrackId: null,
      tracks: [],
      globalEffects: defaultEffectSections(),
      inputError: null,
      displayBar: 1,
      displayBeat: 1,
      activeSaveFolderKey: null,
    }),

  createTrack: () => {
    const def = get().measures
    const t = defaultTrack(def)
    t.effects = cloneEffectSections(defaultEffectSections())
    const n = get().tracks.length + 1
    t.name = `Track ${n}`
    set((s) => ({ tracks: [...s.tracks, t] }))
    return t.id
  },
  deleteTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((x) => x.id !== id),
      selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
    })),
  renameTrack: (id, name) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, name } : x)),
    })),
  setTrackMuted: (id, muted) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, muted } : x)),
    })),
  setTrackSolo: (id, solo) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, solo } : x)),
    })),
  setTrackVolume: (id, volume) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, volume } : x)),
    })),
  setTrackPan: (id, pan) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, pan } : x)),
    })),
  setTrackLoopMeasures: (id, loopMeasures) =>
    set((s) => ({
      tracks: s.tracks.map((x) =>
        x.id === id ? { ...x, loopMeasures: Math.max(1, Math.min(64, Math.round(loopMeasures))) } : x
      ),
    })),
  setTrackPeaks: (id, peaks) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, peaks } : x)),
    })),
  setTrackHasAudio: (id, hasAudio) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, hasAudio } : x)),
    })),
  setTrackIncludeInRecordPlayback: (id, includeInRecordPlayback) =>
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, includeInRecordPlayback } : x)),
    })),
  updateTrackFromLoad: (tracks) => set({ tracks }),

  patchGlobalEffects: (section, partial) =>
    set((s) => ({
      globalEffects: {
        ...s.globalEffects,
        [section]: { ...s.globalEffects[section], ...partial },
      },
    })),
  patchTrackEffects: (trackId, section, partial) =>
    set((s) => ({
      tracks: s.tracks.map((x) =>
        x.id === trackId
          ? {
              ...x,
              effects: {
                ...x.effects,
                [section]: { ...x.effects[section], ...partial },
              },
            }
          : x
      ),
    })),

  getLoopDurationSec: () => {
    const { bpm, timeSigNumerator, measures, tracks } = get()
    const m = masterLoopMeasures(tracks, measures)
    return loopDurationSeconds(bpm, timeSigNumerator, m)
  },
  getMasterLoopMeasures: () => {
    const { measures, tracks } = get()
    return masterLoopMeasures(tracks, measures)
  },
  getActiveEffects: () => {
    const { selectedTrackId, tracks, globalEffects } = get()
    if (!selectedTrackId) return globalEffects
    const t = tracks.find((x) => x.id === selectedTrackId)
    return t?.effects ?? globalEffects
  },
}))
