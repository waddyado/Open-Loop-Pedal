class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.recording = false
    this.port.onmessage = (e) => {
      if (e.data?.type === 'start') this.recording = true
      if (e.data?.type === 'stop') {
        this.recording = false
        this.pendingStopAck = true
      }
    }
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (input.length > 0 && output.length > 0) {
      const ch0 = input[0]
      const out0 = output[0]
      if (ch0 && out0 && ch0.length) {
        out0.set(ch0)
        if (this.recording) {
          const buf = new Float32Array(ch0.length)
          buf.set(ch0)
          this.port.postMessage({ type: 'chunk', buffer: buf.buffer }, [buf.buffer])
        }
      }
    }
    if (this.pendingStopAck) {
      this.pendingStopAck = false
      this.port.postMessage({ type: 'stopped' })
    }
    return true
  }
}

registerProcessor('recorder-processor', RecorderProcessor)
