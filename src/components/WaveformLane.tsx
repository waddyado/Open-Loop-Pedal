import { useEffect, useRef } from 'react'

type Props = {
  peaks: number[]
  /** Normalized position within this lane's loop (0..1). */
  phase01: number
  beatsInLoop: number
  className?: string
}

export function WaveformLane({ peaks, phase01, beatsInLoop, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    if (w === 0 || h === 0) return
    c.width = w * dpr
    c.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#1a1a22'
    ctx.fillRect(0, 0, w, h)

    const mid = h / 2
    const beatW = w / Math.max(1, beatsInLoop)
    ctx.strokeStyle = '#2a2a38'
    ctx.lineWidth = 1
    for (let i = 0; i <= beatsInLoop; i++) {
      const x = i * beatW
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    if (peaks.length > 0) {
      ctx.strokeStyle = '#6eb5ff'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      const step = w / peaks.length
      for (let i = 0; i < peaks.length; i++) {
        const x = i * step + step / 2
        const amp = peaks[i] * (h * 0.42)
        ctx.moveTo(x, mid - amp)
        ctx.lineTo(x, mid + amp)
      }
      ctx.stroke()
    } else {
      ctx.fillStyle = '#4a4a5a'
      ctx.font = '11px system-ui'
      ctx.fillText('No audio', 8, mid + 4)
    }

    const playX = ((phase01 % 1) + 1) % 1 * w
    ctx.strokeStyle = '#ff6b4a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playX, 0)
    ctx.lineTo(playX, h)
    ctx.stroke()
  }, [peaks, phase01, beatsInLoop])

  return <canvas ref={canvasRef} className={className ?? 'waveform-lane'} />
}
