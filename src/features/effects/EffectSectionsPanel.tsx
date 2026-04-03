import { Knob } from '@/components/Knob'
import type { EffectSectionsState, ModKind } from '@/store/effectTypes'
import { useAppStore } from '@/store/useAppStore'

export function EffectSectionsPanel() {
  const selectedTrackId = useAppStore((s) => s.selectedTrackId)
  const trackName = useAppStore((s) => {
    if (!s.selectedTrackId) return ''
    return s.tracks.find((t) => t.id === s.selectedTrackId)?.name ?? ''
  })
  const active = useAppStore((s) => {
    if (!s.selectedTrackId) return s.globalEffects
    return s.tracks.find((t) => t.id === s.selectedTrackId)?.effects ?? s.globalEffects
  })
  const patchGlobal = useAppStore((s) => s.patchGlobalEffects)
  const patchTrack = useAppStore((s) => s.patchTrackEffects)

  const patch = (section: keyof EffectSectionsState, partial: Partial<EffectSectionsState[keyof EffectSectionsState]>) => {
    const id = useAppStore.getState().selectedTrackId
    if (id) patchTrack(id, section, partial)
    else patchGlobal(section, partial)
  }

  const scopeLabel = selectedTrackId ? `Track: ${trackName}` : 'Global effects'

  return (
    <div className="effect-sections">
      <p className="effect-sections__scope" role="status">
        Editing <strong>{scopeLabel}</strong>
      </p>
      <div className="effect-sections__grid">
        <ToneBlock s={active.tone} patch={patch} />
        <ModBlock s={active.modulation} patch={patch} />
        <OverdriveBlock s={active.overdrive} patch={patch} />
        <DelayBlock s={active.delay} patch={patch} />
        <ReverbBlock s={active.reverb} patch={patch} />
      </div>
    </div>
  )
}

type PatchFn = (section: keyof EffectSectionsState, partial: Partial<EffectSectionsState[keyof EffectSectionsState]>) => void

function ToneBlock({ s, patch }: { s: EffectSectionsState['tone']; patch: PatchFn }) {
  return (
    <section className={`effect-section ${s.bypass ? 'effect-section--bypass' : ''}`}>
      <header className="effect-section__head">
        <h3 className="effect-section__title">Tone</h3>
        <label className="effect-section__bypass">
          <input type="checkbox" checked={s.bypass} onChange={(e) => patch('tone', { bypass: e.target.checked })} />
          <span>Bypass</span>
        </label>
      </header>
      <p className="effect-section__sub">Low · mid · high · tilt</p>
      <div className="effect-section__knobs">
        <Knob label="Low" value={s.lowDb} min={-12} max={12} onChange={(v) => patch('tone', { lowDb: v })} format={(x) => `${x > 0 ? '+' : ''}${x.toFixed(0)} dB`} />
        <Knob label="Mid" value={s.midDb} min={-12} max={12} onChange={(v) => patch('tone', { midDb: v })} format={(x) => `${x > 0 ? '+' : ''}${x.toFixed(0)} dB`} />
        <Knob label="High" value={s.highDb} min={-12} max={12} onChange={(v) => patch('tone', { highDb: v })} format={(x) => `${x > 0 ? '+' : ''}${x.toFixed(0)} dB`} />
        <Knob label="Tilt" value={s.tiltDb} min={-12} max={12} onChange={(v) => patch('tone', { tiltDb: v })} format={(x) => `${x > 0 ? '+' : ''}${x.toFixed(0)} dB`} />
      </div>
    </section>
  )
}

function ModBlock({ s, patch }: { s: EffectSectionsState['modulation']; patch: PatchFn }) {
  return (
    <section className={`effect-section ${s.bypass ? 'effect-section--bypass' : ''}`}>
      <header className="effect-section__head">
        <h3 className="effect-section__title">Modulation</h3>
        <label className="effect-section__bypass">
          <input type="checkbox" checked={s.bypass} onChange={(e) => patch('modulation', { bypass: e.target.checked })} />
          <span>Bypass</span>
        </label>
      </header>
      <label className="effect-section__select-label">
        Type
        <select
          className="effect-section__select"
          value={s.kind}
          onChange={(e) => patch('modulation', { kind: e.target.value as ModKind })}
        >
          <option value="flanger">Flanger</option>
          <option value="phaser">Phaser</option>
          <option value="chorus">Chorus</option>
        </select>
      </label>
      <div className="effect-section__knobs">
        <Knob label="Rate" value={s.rate} min={0} max={1} onChange={(v) => patch('modulation', { rate: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Depth" value={s.depth} min={0} max={1} onChange={(v) => patch('modulation', { depth: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Mix" value={s.mix} min={0} max={1} onChange={(v) => patch('modulation', { mix: v })} format={(x) => `${Math.round(x * 100)}%`} />
      </div>
    </section>
  )
}

function OverdriveBlock({ s, patch }: { s: EffectSectionsState['overdrive']; patch: PatchFn }) {
  return (
    <section className={`effect-section ${s.bypass ? 'effect-section--bypass' : ''}`}>
      <header className="effect-section__head">
        <h3 className="effect-section__title">Overdrive</h3>
        <label className="effect-section__bypass">
          <input type="checkbox" checked={s.bypass} onChange={(e) => patch('overdrive', { bypass: e.target.checked })} />
          <span>Bypass</span>
        </label>
      </header>
      <div className="effect-section__knobs">
        <Knob label="Drive" value={s.drive} min={0} max={1} onChange={(v) => patch('overdrive', { drive: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Tone" value={s.tone} min={0} max={1} onChange={(v) => patch('overdrive', { tone: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Level" value={s.level} min={0} max={1} onChange={(v) => patch('overdrive', { level: v })} format={(x) => `${Math.round(x * 100)}%`} />
      </div>
    </section>
  )
}

function DelayBlock({ s, patch }: { s: EffectSectionsState['delay']; patch: PatchFn }) {
  return (
    <section className={`effect-section ${s.bypass ? 'effect-section--bypass' : ''}`}>
      <header className="effect-section__head">
        <h3 className="effect-section__title">Delay</h3>
        <label className="effect-section__bypass">
          <input type="checkbox" checked={s.bypass} onChange={(e) => patch('delay', { bypass: e.target.checked })} />
          <span>Bypass</span>
        </label>
      </header>
      <label className="effect-section__toggle-row">
        <input type="checkbox" checked={s.reverse} onChange={(e) => patch('delay', { reverse: e.target.checked })} />
        <span>Reverse delay (wet)</span>
      </label>
      <div className="effect-section__knobs">
        <Knob label="Time" value={s.time} min={0} max={1} onChange={(v) => patch('delay', { time: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Fb" value={s.feedback} min={0} max={0.95} onChange={(v) => patch('delay', { feedback: v })} />
        <Knob label="Mix" value={s.mix} min={0} max={1} onChange={(v) => patch('delay', { mix: v })} format={(x) => `${Math.round(x * 100)}%`} />
      </div>
    </section>
  )
}

function ReverbBlock({ s, patch }: { s: EffectSectionsState['reverb']; patch: PatchFn }) {
  return (
    <section className={`effect-section ${s.bypass ? 'effect-section--bypass' : ''}`}>
      <header className="effect-section__head">
        <h3 className="effect-section__title">Reverb</h3>
        <label className="effect-section__bypass">
          <input type="checkbox" checked={s.bypass} onChange={(e) => patch('reverb', { bypass: e.target.checked })} />
          <span>Bypass</span>
        </label>
      </header>
      <div className="effect-section__knobs">
        <Knob label="Decay" value={s.decay} min={0} max={1} onChange={(v) => patch('reverb', { decay: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Size" value={s.size} min={0} max={1} onChange={(v) => patch('reverb', { size: v })} format={(x) => `${Math.round(x * 100)}%`} />
        <Knob label="Mix" value={s.mix} min={0} max={1} onChange={(v) => patch('reverb', { mix: v })} format={(x) => `${Math.round(x * 100)}%`} />
      </div>
    </section>
  )
}
