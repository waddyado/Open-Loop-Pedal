import { EffectSectionsPanel } from '@/features/effects/EffectSectionsPanel'

export function Pedalboard() {
  return (
    <section className="pedalboard">
      <header className="pedalboard__brand">
        <h1 className="pedalboard__logo">Open Loop Pedal</h1>
        <p className="pedalboard__tag">Looping workstation · Per-track FX · Master bus</p>
      </header>
      <EffectSectionsPanel />
    </section>
  )
}
