import { buildSectionedFxChain, applyEffectSections, type SectionedFxNodes } from '@/audio/effects/buildSectionedFxChain'
import { getBarBeat, loopDurationSeconds, nextBeatTime, secondsPerBeat } from '@/audio/loopMath'
import type { EffectSectionsState } from '@/store/effectTypes'
import type { TrackMeta } from '@/store/useAppStore'

type TrackChain = {
  preMerger: GainNode
  fx: SectionedFxNodes
  reverseNode: AudioWorkletNode
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private recorderNode: AudioWorkletNode | null = null
  /** Zero-gain tap to destination so the mic→recorder graph is always pulled (required for capture when monitoring is off). */
  private recordPullSink: GainNode | null = null
  private monitorGate: GainNode | null = null
  private mergeBus: GainNode | null = null
  private globalFx: SectionedFxNodes | null = null
  private globalReverseNode: AudioWorkletNode | null = null
  private masterGain: GainNode | null = null
  private workletReady = false
  private workletLoadPromise: Promise<void> | null = null

  private trackChains = new Map<string, TrackChain>()
  private trackGains = new Map<string, GainNode>()
  private trackPans = new Map<string, StereoPannerNode>()
  private trackBuffers = new Map<string, AudioBuffer>()
  private activeSources: AudioBufferSourceNode[] = []

  private recordChunks: Float32Array[] = []
  private acceptRecordChunks = false

  private loopPhaseStartTime: number | null = null
  private metronomeOn = false
  private metronomeTimer: ReturnType<typeof setInterval> | null = null
  private countInToken = 0
  private countInRaf = 0
  private bpmRef = 120
  private sigNumRef = 4
  private measuresRef = 4

  private micRouteSelection: string | null = null
  private micRouteMonitoring = false

  getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate: 48000 })
    return this.ctx
  }

  async resume(): Promise<AudioContext> {
    const ctx = this.getContext()
    if (ctx.state === 'suspended') await ctx.resume()
    await this.ensureGraph()
    await this.ensureWorklets()
    return ctx
  }

  private async ensureGraph(): Promise<void> {
    const ctx = this.getContext()
    if (this.masterGain) return

    await this.ensureWorklets()

    this.mergeBus = ctx.createGain()
    this.mergeBus.gain.value = 1

    this.monitorGate = ctx.createGain()
    this.monitorGate.gain.value = 0

    this.recordPullSink = ctx.createGain()
    this.recordPullSink.gain.value = 0
    this.recordPullSink.connect(ctx.destination)

    this.globalReverseNode = new AudioWorkletNode(ctx, 'reverse-wet-processor')
    this.globalFx = buildSectionedFxChain(ctx, this.globalReverseNode)

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 0.85

    this.mergeBus.connect(this.globalFx.input)
    this.globalFx.output.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)
  }

  setMicRouting(selectedTrackId: string | null, monitoring: boolean): void {
    this.micRouteSelection = selectedTrackId
    this.micRouteMonitoring = monitoring
    this.applyMicRouting()
  }

  private applyMicRouting(): void {
    if (!this.monitorGate) return
    try {
      this.monitorGate.disconnect()
    } catch {
      /* noop */
    }
    if (this.micRouteMonitoring && this.micRouteSelection) {
      const ch = this.trackChains.get(this.micRouteSelection)
      if (ch) this.monitorGate.connect(ch.preMerger)
    }
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const ctx = this.getContext() as AudioContext & { setSinkId?: (id: string) => Promise<void> }
    if (!ctx.setSinkId) return
    try {
      await ctx.setSinkId(deviceId || '')
    } catch {
      /* ignore */
    }
  }

  private async ensureWorklets(): Promise<void> {
    const ctx = this.getContext()
    if (this.workletReady) return
    if (!this.workletLoadPromise) {
      this.workletLoadPromise = (async () => {
        await ctx.audioWorklet.addModule(new URL('audio-worklets/recorder-processor.js', window.location.href).href)
        await ctx.audioWorklet.addModule(new URL('audio-worklets/reverse-wet-processor.js', window.location.href).href)
        this.workletReady = true
      })()
    }
    try {
      await this.workletLoadPromise
    } finally {
      this.workletLoadPromise = null
    }
  }

  private attachRecorderChain(): void {
    const ctx = this.getContext()
    if (!this.micSource || !this.monitorGate) return
    if (this.recorderNode) {
      this.recorderNode.disconnect()
      this.recorderNode.port.onmessage = null
    }
    this.recorderNode = new AudioWorkletNode(ctx, 'recorder-processor', { numberOfInputs: 1, numberOfOutputs: 1 })
    this.recorderNode.port.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'chunk' && e.data.buffer && this.acceptRecordChunks) {
        const f = new Float32Array(e.data.buffer as ArrayBuffer)
        this.recordChunks.push(new Float32Array(f))
      }
    }
    this.micSource.disconnect()
    this.micSource.connect(this.recorderNode)
    this.recorderNode.connect(this.monitorGate)
    if (this.recordPullSink) this.recorderNode.connect(this.recordPullSink)
    this.applyMicRouting()
  }

  async openMicrophone(deviceId: string): Promise<void> {
    await this.resume()
    await this.ensureGraph()
    this.closeMicrophone()
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.micStream = stream
    const ctx = this.getContext()
    this.micSource = ctx.createMediaStreamSource(stream)
    this.attachRecorderChain()
  }

  closeMicrophone(): void {
    if (this.recorderNode) {
      this.recorderNode.disconnect()
      this.recorderNode.port.onmessage = null
      this.recorderNode = null
    }
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop())
      this.micStream = null
    }
    if (this.monitorGate) {
      try {
        this.monitorGate.disconnect()
      } catch {
        /* noop */
      }
    }
  }

  setMonitoring(on: boolean, level = 0.85): void {
    if (this.monitorGate) this.monitorGate.gain.value = on ? level : 0
    this.applyMicRouting()
  }

  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v))
  }

  syncEffectChains(globalFx: EffectSectionsState, tracks: TrackMeta[]): void {
    if (this.globalFx) applyEffectSections(this.globalFx, globalFx)
    for (const t of tracks) {
      const ch = this.trackChains.get(t.id)
      if (ch) applyEffectSections(ch.fx, t.effects)
    }
  }

  setLoopParams(bpm: number, sigNum: number, measures: number): void {
    this.bpmRef = bpm
    this.sigNumRef = sigNum
    this.measuresRef = measures
  }

  getLoopDurationSec(bpm: number, sigNum: number, measures: number): number {
    return loopDurationSeconds(bpm, sigNum, measures)
  }

  getPhaseInLoop(): number {
    const ctx = this.ctx
    if (!ctx || this.loopPhaseStartTime === null) return 0
    const L = loopDurationSeconds(this.bpmRef, this.sigNumRef, this.measuresRef)
    const elapsed = ctx.currentTime - this.loopPhaseStartTime
    const m = elapsed % L
    return m >= 0 ? m : 0
  }

  getDisplayBarBeat(): { bar: number; beat: number } {
    const phase = this.getPhaseInLoop()
    return getBarBeat(phase, this.bpmRef, this.sigNumRef)
  }

  setTrackBuffer(trackId: string, buffer: AudioBuffer | null): void {
    if (buffer) this.trackBuffers.set(trackId, buffer)
    else this.trackBuffers.delete(trackId)
  }

  getTrackBuffer(trackId: string): AudioBuffer | null {
    return this.trackBuffers.get(trackId) ?? null
  }

  ensureTrackRouting(trackId: string): void {
    void this.ensureGraph()
    const ctx = this.getContext()
    if (!this.mergeBus) return
    if (this.trackChains.has(trackId)) {
      if (!this.trackGains.has(trackId)) {
        const ch = this.trackChains.get(trackId)!
        const gain = ctx.createGain()
        gain.gain.value = 1
        const pan = ctx.createStereoPanner()
        pan.pan.value = 0
        gain.connect(pan)
        pan.connect(ch.preMerger)
        this.trackGains.set(trackId, gain)
        this.trackPans.set(trackId, pan)
      }
      return
    }

    const reverseNode = new AudioWorkletNode(ctx, 'reverse-wet-processor')
    const fx = buildSectionedFxChain(ctx, reverseNode)
    const preMerger = ctx.createGain()
    preMerger.gain.value = 1

    const gain = ctx.createGain()
    gain.gain.value = 1
    const pan = ctx.createStereoPanner()
    pan.pan.value = 0
    gain.connect(pan)
    pan.connect(preMerger)
    preMerger.connect(fx.input)
    fx.output.connect(this.mergeBus)

    this.trackChains.set(trackId, { preMerger, fx, reverseNode })
    this.trackGains.set(trackId, gain)
    this.trackPans.set(trackId, pan)
    this.applyMicRouting()
  }

  /** Remove every track graph and clip from the previous session before loading another project. */
  resetAllTracksForSession(): void {
    this.stopSources()
    const ids = new Set<string>([...this.trackChains.keys(), ...this.trackBuffers.keys()])
    for (const id of ids) this.removeTrackRouting(id)
  }

  removeTrackRouting(trackId: string): void {
    const ch = this.trackChains.get(trackId)
    if (ch) {
      try {
        ch.fx.output.disconnect()
        ch.preMerger.disconnect()
        ch.reverseNode.disconnect()
      } catch {
        /* noop */
      }
      this.trackChains.delete(trackId)
    }
    const g = this.trackGains.get(trackId)
    const p = this.trackPans.get(trackId)
    g?.disconnect()
    p?.disconnect()
    this.trackGains.delete(trackId)
    this.trackPans.delete(trackId)
    this.trackBuffers.delete(trackId)
    this.applyMicRouting()
  }

  updateTrackMix(tracks: TrackMeta[]): void {
    const anySolo = tracks.some((t) => t.solo)
    for (const t of tracks) {
      const g = this.trackGains.get(t.id)
      const p = this.trackPans.get(t.id)
      if (!g || !p) continue
      let eff = t.volume
      if (t.muted) eff = 0
      else if (anySolo && !t.solo) eff = 0
      g.gain.value = eff
      p.pan.value = Math.max(-1, Math.min(1, t.pan))
    }
  }

  stopSources(): void {
    for (const s of this.activeSources) {
      try {
        s.stop()
        s.disconnect()
      } catch {
        /* noop */
      }
    }
    this.activeSources = []
    this.loopPhaseStartTime = null
  }

  markLoopOriginAt(audioContextTime: number): void {
    this.loopPhaseStartTime = audioContextTime
  }

  startPlayback(tracks: TrackMeta[], bpm: number, sigNum: number, measures: number): void {
    const ctx = this.getContext()
    void this.ensureGraph()
    this.stopSources()
    this.bpmRef = bpm
    this.sigNumRef = sigNum
    this.measuresRef = measures
    const now = ctx.currentTime
    this.loopPhaseStartTime = now
    const anySolo = tracks.some((t) => t.solo)

    for (const t of tracks) {
      if (!t.hasAudio) continue
      const buf = this.trackBuffers.get(t.id)
      if (!buf) continue
      if (t.muted) continue
      if (anySolo && !t.solo) continue
      this.ensureTrackRouting(t.id)
      const g = this.trackGains.get(t.id)
      if (!g) continue
      g.gain.value = t.volume
      const p = this.trackPans.get(t.id)
      if (p) p.pan.value = t.pan
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.connect(g)
      src.start(now)
      this.activeSources.push(src)
    }
  }

  /**
   * Loop other tracks while recording so you can hear backing parts. Never plays `recordingTrackId` (avoids stale loop under the take).
   */
  startBackingDuringRecord(
    tracks: TrackMeta[],
    recordingTrackId: string,
    opts: { enabled: boolean; includeMode: 'all' | 'custom' }
  ): void {
    if (!opts.enabled) return
    const ctx = this.getContext()
    const anySolo = tracks.some((t) => t.solo)
    const now = ctx.currentTime

    for (const t of tracks) {
      if (t.id === recordingTrackId) continue
      if (!t.hasAudio) continue
      const buf = this.trackBuffers.get(t.id)
      if (!buf) continue
      if (t.muted) continue
      if (anySolo && !t.solo) continue
      if (opts.includeMode === 'custom' && !t.includeInRecordPlayback) continue

      this.ensureTrackRouting(t.id)
      const g = this.trackGains.get(t.id)
      if (!g) continue
      g.gain.value = t.volume
      const p = this.trackPans.get(t.id)
      if (p) p.pan.value = t.pan
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.connect(g)
      src.start(now)
      this.activeSources.push(src)
    }
  }

  startRecordingCapture(): void {
    this.acceptRecordChunks = true
    this.recordChunks = []
    this.recorderNode?.port.postMessage({ type: 'start' })
  }

  /**
   * Stop the worklet, wait for the final render quantum and any in-flight chunk messages, then return copies of captured blocks.
   */
  stopRecordingCaptureAsync(): Promise<Float32Array[]> {
    return new Promise((resolve) => {
      const port = this.recorderNode?.port
      if (!port) {
        this.acceptRecordChunks = false
        this.recordChunks = []
        resolve([])
        return
      }
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        this.acceptRecordChunks = false
        const out = this.recordChunks.map((c) => new Float32Array(c))
        this.recordChunks = []
        if (import.meta.env.DEV) {
          let n = 0
          for (const c of out) n += c.length
          console.debug('[olp] recording drain', { blocks: out.length, samples: n })
        }
        resolve(out)
      }
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'stopped') {
          port.removeEventListener('message', onMsg)
          finish()
        }
      }
      port.addEventListener('message', onMsg)
      port.postMessage({ type: 'stop' })
      window.setTimeout(() => {
        port.removeEventListener('message', onMsg)
        finish()
      }, 320)
    })
  }

  /** Cancel capture without returning audio (e.g. transport stop before finalize). */
  discardRecordingCapture(): void {
    this.acceptRecordChunks = false
    this.recorderNode?.port.postMessage({ type: 'stop' })
    this.recordChunks = []
  }

  buildLoopAudioBuffer(samples: Float32Array, sampleRate: number, loopSeconds: number): AudioBuffer {
    const ctx = this.getContext()
    const loopSamples = Math.max(1, Math.round(loopSeconds * sampleRate))
    const ch = ctx.createBuffer(1, loopSamples, sampleRate)
    const d = ch.getChannelData(0)
    const n = Math.min(samples.length, loopSamples)
    d.set(samples.subarray(0, n))
    if (n < loopSamples) d.fill(0, n)
    return ch
  }

  playClick(time: number, accent: boolean): void {
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = accent ? 1800 : 1100
    g.gain.value = 0.0001
    osc.connect(g).connect(ctx.destination)
    const t0 = time
    g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, t0 + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
    osc.start(t0)
    osc.stop(t0 + 0.07)
  }

  startMetronome(bpm: number, timeSigNum: number): void {
    this.stopMetronome()
    if (!this.metronomeOn) return
    this.bpmRef = bpm
    const ctx = this.getContext()
    const spb = secondsPerBeat(bpm)
    let next = nextBeatTime(ctx.currentTime, bpm)
    const tick = () => {
      if (!this.metronomeOn) return
      const now = ctx.currentTime
      while (next <= now + 0.05) {
        const beatIndex = Math.round(next / spb) % timeSigNum
        this.playClick(next, beatIndex === 0)
        next += spb
      }
    }
    this.metronomeTimer = setInterval(tick, 40)
    tick()
  }

  stopMetronome(): void {
    if (this.metronomeTimer) clearInterval(this.metronomeTimer)
    this.metronomeTimer = null
  }

  setMetronomeEnabled(on: boolean): void {
    this.metronomeOn = on
    if (!on) this.stopMetronome()
  }

  cancelCountdown(): void {
    if (this.countInRaf) {
      cancelAnimationFrame(this.countInRaf)
      this.countInRaf = 0
    }
    this.countInToken++
  }

  startCountIn(options: {
    beats: number
    bpm: number
    onUIBeatsRemaining: (remainingAfterCompletedClicks: number) => void
    onRecordStart: (anchorAudioTime: number) => void
  }): void {
    this.cancelCountdown()
    const ctx = this.getContext()
    const spb = secondsPerBeat(options.bpm)
    const beats = Math.max(0, Math.floor(options.beats))

    if (beats === 0) {
      options.onRecordStart(ctx.currentTime)
      return
    }

    const myToken = this.countInToken
    const t0 = nextBeatTime(ctx.currentTime, options.bpm)
    const tRecord = t0 + beats * spb

    for (let i = 0; i < beats; i++) {
      this.playClick(t0 + i * spb, true)
    }

    let lastUiRemaining = -1
    let recordFired = false

    const tick = () => {
      if (myToken !== this.countInToken) return
      const t = ctx.currentTime

      if (!recordFired && t >= tRecord - 0.0005) {
        recordFired = true
        this.countInRaf = 0
        options.onRecordStart(tRecord)
        return
      }

      let completed = 0
      for (let i = 0; i < beats; i++) {
        if (t >= t0 + i * spb) completed = i + 1
      }
      const remaining = Math.max(0, beats - completed)
      if (remaining !== lastUiRemaining) {
        lastUiRemaining = remaining
        options.onUIBeatsRemaining(remaining)
      }

      this.countInRaf = requestAnimationFrame(tick)
    }

    this.countInRaf = requestAnimationFrame(tick)
  }

  dispose(): void {
    this.cancelCountdown()
    this.stopMetronome()
    this.stopSources()
    this.closeMicrophone()
  }
}

export const audioEngine = new AudioEngine()
