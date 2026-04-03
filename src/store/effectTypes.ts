export type ModKind = 'flanger' | 'phaser' | 'chorus'

export type ToneSectionState = {
  bypass: boolean
  lowDb: number
  midDb: number
  highDb: number
  tiltDb: number
}

export type ModSectionState = {
  bypass: boolean
  kind: ModKind
  rate: number
  depth: number
  mix: number
}

export type OverdriveSectionState = {
  bypass: boolean
  drive: number
  tone: number
  level: number
}

export type DelaySectionState = {
  bypass: boolean
  time: number
  feedback: number
  mix: number
  reverse: boolean
}

export type ReverbSectionState = {
  bypass: boolean
  decay: number
  size: number
  mix: number
}

export type EffectSectionsState = {
  tone: ToneSectionState
  modulation: ModSectionState
  overdrive: OverdriveSectionState
  delay: DelaySectionState
  reverb: ReverbSectionState
}

export function defaultEffectSections(): EffectSectionsState {
  return {
    tone: { bypass: true, lowDb: 0, midDb: 0, highDb: 0, tiltDb: 0 },
    modulation: { bypass: true, kind: 'chorus', rate: 0.4, depth: 0.35, mix: 0.35 },
    overdrive: { bypass: true, drive: 0.15, tone: 0.5, level: 0.75 },
    delay: { bypass: true, time: 0.25, feedback: 0.35, mix: 0.3, reverse: false },
    reverb: { bypass: true, decay: 0.45, size: 0.4, mix: 0.22 },
  }
}

export function cloneEffectSections(s: EffectSectionsState): EffectSectionsState {
  return structuredClone(s)
}

export function coerceEffectSections(raw: unknown): EffectSectionsState {
  const d = defaultEffectSections()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as EffectSectionsState
  return {
    tone: { ...d.tone, ...r.tone },
    modulation: { ...d.modulation, ...r.modulation },
    overdrive: { ...d.overdrive, ...r.overdrive },
    delay: { ...d.delay, ...r.delay },
    reverb: { ...d.reverb, ...r.reverb },
  }
}
