import type { EffectSectionsState } from '@/store/effectTypes'

function distortionCurve(amount: number): Float32Array {
  const k = 2 + amount * 40
  const n = 256
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x))
  }
  return curve
}

function makeImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(rate * duration))
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

export type SectionedFxNodes = {
  input: GainNode
  toneLow: BiquadFilterNode
  toneMid: BiquadFilterNode
  toneHigh: BiquadFilterNode
  modDry: GainNode
  modDelay: DelayNode
  modFb: GainNode
  modLFO: OscillatorNode
  modLFOGain: GainNode
  modDelayWet: GainNode
  modMerge: GainNode
  ap1: BiquadFilterNode
  ap2: BiquadFilterNode
  ap3: BiquadFilterNode
  phaserWet: GainNode
  phaserLFO: OscillatorNode
  phaserLFOGain: GainNode
  waveshaper: WaveShaperNode
  odTone: BiquadFilterNode
  odOut: GainNode
  dly: DelayNode
  dlyFb: GainNode
  dlyDry: GainNode
  dlyWetNorm: GainNode
  dlyWetRev: GainNode
  dlyRevNode: AudioWorkletNode | null
  dlyMerge: GainNode
  convolver: ConvolverNode
  verbDry: GainNode
  verbWet: GainNode
  verbMerge: GainNode
  output: GainNode
}

export function buildSectionedFxChain(ctx: AudioContext, reverseWorklet: AudioWorkletNode | null): SectionedFxNodes {
  const input = ctx.createGain()
  input.gain.value = 1

  const toneLow = ctx.createBiquadFilter()
  toneLow.type = 'lowshelf'
  toneLow.frequency.value = 200
  toneLow.gain.value = 0

  const toneMid = ctx.createBiquadFilter()
  toneMid.type = 'peaking'
  toneMid.frequency.value = 1000
  toneMid.Q.value = 1
  toneMid.gain.value = 0

  const toneHigh = ctx.createBiquadFilter()
  toneHigh.type = 'highshelf'
  toneHigh.frequency.value = 4000
  toneHigh.gain.value = 0

  const modDry = ctx.createGain()
  const modDelay = ctx.createDelay(0.05)
  modDelay.delayTime.value = 0.01
  const modFb = ctx.createGain()
  modFb.gain.value = 0
  const modLFO = ctx.createOscillator()
  modLFO.type = 'sine'
  modLFO.frequency.value = 1
  const modLFOGain = ctx.createGain()
  modLFOGain.gain.value = 0.002
  const modDelayWet = ctx.createGain()
  const modMerge = ctx.createGain()

  const ap1 = ctx.createBiquadFilter()
  ap1.type = 'allpass'
  ap1.frequency.value = 400
  ap1.Q.value = 0.7
  const ap2 = ctx.createBiquadFilter()
  ap2.type = 'allpass'
  ap2.frequency.value = 600
  ap2.Q.value = 0.7
  const ap3 = ctx.createBiquadFilter()
  ap3.type = 'allpass'
  ap3.frequency.value = 800
  ap3.Q.value = 0.7
  const phaserWet = ctx.createGain()

  const phaserLFO = ctx.createOscillator()
  phaserLFO.type = 'sine'
  phaserLFO.frequency.value = 0.4
  const phaserLFOGain = ctx.createGain()
  phaserLFOGain.gain.value = 280

  const waveshaper = ctx.createWaveShaper()
  waveshaper.curve = distortionCurve(0.05)
  waveshaper.oversample = '2x'
  const odTone = ctx.createBiquadFilter()
  odTone.type = 'peaking'
  odTone.frequency.value = 2000
  odTone.Q.value = 0.8
  odTone.gain.value = 0
  const odOut = ctx.createGain()
  odOut.gain.value = 1

  const dly = ctx.createDelay(2)
  dly.delayTime.value = 0.2
  const dlyFb = ctx.createGain()
  const dlyDry = ctx.createGain()
  const dlyWetNorm = ctx.createGain()
  const dlyWetRev = ctx.createGain()
  const dlyMerge = ctx.createGain()

  const convolver = ctx.createConvolver()
  convolver.buffer = makeImpulseResponse(ctx, 2.2, 3)
  const verbDry = ctx.createGain()
  const verbWet = ctx.createGain()
  const verbMerge = ctx.createGain()
  const output = ctx.createGain()

  input.connect(toneLow)
  toneLow.connect(toneMid)
  toneMid.connect(toneHigh)

  toneHigh.connect(modDry)
  modDry.connect(modMerge)

  toneHigh.connect(modDelay)
  modDelay.connect(modDelayWet)
  modDelayWet.connect(modMerge)
  modDelay.connect(modFb)
  modFb.connect(modDelay)

  modLFO.connect(modLFOGain)
  modLFOGain.connect(modDelay.delayTime)

  toneHigh.connect(ap1)
  ap1.connect(ap2)
  ap2.connect(ap3)
  ap3.connect(phaserWet)
  phaserWet.connect(modMerge)

  phaserLFO.connect(phaserLFOGain)
  phaserLFOGain.connect(ap1.frequency)
  phaserLFOGain.connect(ap2.frequency)
  phaserLFOGain.connect(ap3.frequency)

  modLFO.start()
  phaserLFO.start()

  modMerge.connect(waveshaper)
  waveshaper.connect(odTone)
  odTone.connect(odOut)

  odOut.connect(dlyDry)
  odOut.connect(dly)
  dly.connect(dlyWetNorm)
  dly.connect(dlyFb)
  dlyFb.connect(dly)

  dlyDry.connect(dlyMerge)
  dlyWetNorm.connect(dlyMerge)
  dlyWetRev.connect(dlyMerge)

  if (reverseWorklet) {
    odOut.connect(reverseWorklet)
    reverseWorklet.connect(dlyWetRev)
  }

  dlyMerge.connect(verbDry)
  dlyMerge.connect(convolver)
  convolver.connect(verbWet)
  verbDry.connect(verbMerge)
  verbWet.connect(verbMerge)
  verbMerge.connect(output)

  return {
    input,
    toneLow,
    toneMid,
    toneHigh,
    modDry,
    modDelay,
    modFb,
    modLFO,
    modLFOGain,
    modDelayWet,
    modMerge,
    ap1,
    ap2,
    ap3,
    phaserWet,
    phaserLFO,
    phaserLFOGain,
    waveshaper,
    odTone,
    odOut,
    dly,
    dlyFb,
    dlyDry,
    dlyWetNorm,
    dlyWetRev,
    dlyRevNode: reverseWorklet,
    dlyMerge,
    convolver,
    verbDry,
    verbWet,
    verbMerge,
    output,
  }
}

export function applyEffectSections(n: SectionedFxNodes, s: EffectSectionsState): void {
  const tB = s.tone.bypass
  n.toneLow.gain.value = tB ? 0 : s.tone.lowDb + s.tone.tiltDb * -0.5
  n.toneMid.gain.value = tB ? 0 : s.tone.midDb + s.tone.tiltDb * 0.35
  n.toneHigh.gain.value = tB ? 0 : s.tone.highDb + s.tone.tiltDb * 0.5

  const mB = s.modulation.bypass
  const mix = mB ? 0 : s.modulation.mix
  const rate = 0.15 + s.modulation.rate * 2.2
  const depth = 0.25 + s.modulation.depth * 1.1

  n.modLFO.frequency.value = rate * (s.modulation.kind === 'flanger' ? 2.2 : 1)
  n.phaserLFO.frequency.value = rate * 0.8
  n.phaserLFOGain.gain.value = 120 + depth * 380

  if (mB) {
    n.modDry.gain.value = 1
    n.modDelayWet.gain.value = 0
    n.phaserWet.gain.value = 0
    n.modFb.gain.value = 0
  } else if (s.modulation.kind === 'phaser') {
    n.modDry.gain.value = 1 - mix * 0.55
    n.modDelayWet.gain.value = 0
    n.phaserWet.gain.value = mix
    n.modFb.gain.value = 0
    n.modDelay.delayTime.value = 0.001
    n.modLFOGain.gain.value = 0.0001
  } else if (s.modulation.kind === 'flanger') {
    n.modDry.gain.value = 1 - mix * 0.5
    n.modDelayWet.gain.value = mix
    n.phaserWet.gain.value = 0
    n.modDelay.delayTime.value = 0.003 + 0.007 * depth
    n.modLFOGain.gain.value = 0.0005 + 0.0022 * depth
    n.modFb.gain.value = 0.55 * mix
  } else {
    n.modDry.gain.value = 1 - mix * 0.45
    n.modDelayWet.gain.value = mix
    n.phaserWet.gain.value = 0
    n.modDelay.delayTime.value = 0.014 + 0.02 * depth
    n.modLFOGain.gain.value = 0.001 + 0.0035 * depth
    n.modFb.gain.value = 0.22 * mix
  }

  const oB = s.overdrive.bypass
  n.waveshaper.curve = distortionCurve(oB ? 0.02 : 0.05 + s.overdrive.drive * 0.95)
  n.odOut.gain.value = oB ? 1 : Math.max(0.06, s.overdrive.level)
  n.odTone.frequency.value = 400 + s.overdrive.tone * 3200
  n.odTone.gain.value = oB ? 0 : (s.overdrive.tone - 0.5) * 10

  const dB = s.delay.bypass
  const maxMs = 0.95
  const t = dB ? 0.001 : 0.03 + s.delay.time * (maxMs - 0.03)
  n.dly.delayTime.value = t
  n.dlyFb.gain.value = dB ? 0 : Math.min(0.9, s.delay.feedback)
  const dm = dB ? 0 : s.delay.mix
  n.dlyDry.gain.value = 1 - dm * 0.55
  if (s.delay.reverse && !dB && n.dlyRevNode) {
    n.dlyWetNorm.gain.value = 0
    n.dlyWetRev.gain.value = dm
  } else {
    n.dlyWetNorm.gain.value = dm
    n.dlyWetRev.gain.value = 0
  }

  const rB = s.reverb.bypass
  const mixR = rB ? 0 : s.reverb.mix
  const sz = s.reverb.size
  const dec = s.reverb.decay
  n.verbWet.gain.value = mixR * (0.2 + sz * 0.45)
  n.verbDry.gain.value = rB ? 1 : 1 - mixR * 0.4
  if (!rB) {
    n.convolver.buffer = makeImpulseResponse(n.convolver.context as AudioContext, 0.8 + sz * 2.4, 1.5 + dec * 5)
  }
}
