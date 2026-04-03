/**
 * Granular reverse-smear wet tap: ring buffer read with backward emphasis.
 */
class ReverseWetProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ring = new Float32Array(96000)
    this.w = 0
  }

  process(inputs, outputs) {
    const inCh = inputs[0]?.[0]
    const outCh = outputs[0]?.[0]
    if (!inCh || !outCh) return true
    const B = this.ring.length
    const D = Math.min(B - 2, 8000)
    const win = 48
    for (let i = 0; i < inCh.length; i++) {
      this.ring[this.w] = inCh[i]
      const base = (this.w - D + B) % B
      let sum = 0
      for (let k = 0; k < win; k++) {
        sum += this.ring[(base - k + B) % B]
      }
      outCh[i] = (sum / win) * 0.85
      this.w = (this.w + 1) % B
    }
    return true
  }
}

registerProcessor('reverse-wet-processor', ReverseWetProcessor)
