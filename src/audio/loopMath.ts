/** MVP: beats per measure = numerator; denominator is stored for display / future compound meter. */
export function secondsPerBeat(bpm: number): number {
  return 60 / Math.max(20, Math.min(300, bpm))
}

export function loopDurationSeconds(bpm: number, timeSigNumerator: number, measures: number): number {
  const spb = secondsPerBeat(bpm)
  const beats = Math.max(1, measures) * Math.max(1, timeSigNumerator)
  return beats * spb
}

export function getBarBeat(
  elapsedInLoopSec: number,
  bpm: number,
  timeSigNumerator: number
): { bar: number; beat: number; withinBar: number } {
  const spb = secondsPerBeat(bpm)
  const beatFloat = elapsedInLoopSec / spb
  const totalBeat = Math.floor(beatFloat) + 1
  const bar = Math.floor((totalBeat - 1) / timeSigNumerator) + 1
  const beat = ((totalBeat - 1) % timeSigNumerator) + 1
  const withinBar = beatFloat - Math.floor(beatFloat)
  return { bar, beat, withinBar }
}

export function nextBeatTime(audioContextTime: number, bpm: number): number {
  const spb = secondsPerBeat(bpm)
  const n = Math.ceil(audioContextTime / spb)
  return n * spb
}

export function beatsFromDuration(durationSec: number, bpm: number): number {
  return durationSec / secondsPerBeat(bpm)
}

/** Master loop length in measures: max of each track's loop, or session default when there are no tracks. */
export function masterLoopMeasures(
  tracks: { loopMeasures: number }[],
  sessionDefaultMeasures: number
): number {
  if (tracks.length === 0) return Math.max(1, sessionDefaultMeasures)
  return Math.max(1, ...tracks.map((t) => Math.max(1, t.loopMeasures)))
}
