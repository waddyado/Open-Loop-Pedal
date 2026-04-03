/** Encode mono Float32 PCM (-1..1) as 16-bit little-endian WAV. */
export function encodeWavMono(float32: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = float32.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buffer)

  function writeString(off: number, s: string) {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  v.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, numChannels, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, byteRate, true)
  v.setUint16(32, blockAlign, true)
  v.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  v.setUint32(40, dataSize, true)

  let o = 44
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    o += 2
  }
  return buffer
}

export async function decodeWavToAudioBuffer(
  ctx: BaseAudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> {
  return ctx.decodeAudioData(arrayBuffer.slice(0))
}
