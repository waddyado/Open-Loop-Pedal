/** Downsample audio channel to normalized peak envelope for waveform UI. */
export function computePeaks(channelData: Float32Array, numBins: number): number[] {
  if (channelData.length === 0 || numBins <= 0) return []
  const peaks: number[] = []
  const block = Math.max(1, Math.floor(channelData.length / numBins))
  for (let i = 0; i < numBins; i++) {
    const start = i * block
    const end = Math.min(channelData.length, start + block)
    let m = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(channelData[j])
      if (v > m) m = v
    }
    peaks.push(m)
  }
  return peaks
}
