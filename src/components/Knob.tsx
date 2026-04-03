import { useCallback, useRef, useState } from 'react'

type Props = {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  /** 0..1 for display rotation */
  format?: (v: number) => string
}

export function Knob({ label, value, min, max, onChange, format }: Props) {
  const startRef = useRef({ y: 0, val: 0 })
  const [dragging, setDragging] = useState(false)

  const norm = (max - min) > 0 ? (value - min) / (max - min) : 0
  const deg = -135 + norm * 270

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      startRef.current = { y: e.clientY, val: value }
      setDragging(true)
    },
    [value]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const dy = startRef.current.y - e.clientY
      const range = max - min
      const next = Math.min(max, Math.max(min, startRef.current.val + dy * (range / 150)))
      onChange(next)
    },
    [max, min, onChange]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }, [])

  const text = format ? format(value) : value.toFixed(2)

  return (
    <div className={`knob ${dragging ? 'knob--drag' : ''}`}>
      <div
        className="knob__dial"
        style={{ transform: `rotate(${deg}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <span className="knob__tick" />
      </div>
      <span className="knob__value">{text}</span>
      <span className="knob__label">{label}</span>
    </div>
  )
}
