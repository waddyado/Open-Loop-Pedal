import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'openLoopPedal.timelineHeightPx'
const DEFAULT_PX = 220
const MIN_PX = 100
const MIN_PEDAL_PX = 160

function readStored(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(n) && n >= MIN_PX) return n
  } catch {
    /* ignore */
  }
  return DEFAULT_PX
}

function maxHeightPx(): number {
  return Math.max(MIN_PX + 40, window.innerHeight - MIN_PEDAL_PX)
}

function clamp(h: number): number {
  return Math.round(Math.max(MIN_PX, Math.min(maxHeightPx(), h)))
}

export function useTimelinePaneHeight(): {
  footerHeightPx: number
  timelineMaxPx: number
  splitterHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void
    onDoubleClick: () => void
  }
} {
  const [footerHeightPx, setFooterHeightPx] = useState(readStored)
  const heightRef = useRef(footerHeightPx)
  heightRef.current = footerHeightPx

  const dragRef = useRef<{
    active: boolean
    startY: number
    startH: number
    pointerId: number
    target: HTMLDivElement | null
  } | null>(null)

  useEffect(() => {
    const onResize = () => setFooterHeightPx((h) => clamp(h))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const persist = useCallback((h: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(h))
    } catch {
      /* ignore */
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startH: footerHeightPx,
      pointerId: e.pointerId,
      target: el,
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [footerHeightPx])

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d?.active) return
      if (e.pointerId !== d.pointerId) return
      d.target?.releasePointerCapture(e.pointerId)
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      persist(heightRef.current)
    },
    [persist]
  )

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d?.active || e.pointerId !== d.pointerId) return
    const delta = e.clientY - d.startY
    const next = clamp(d.startH - delta)
    heightRef.current = next
    setFooterHeightPx(next)
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e)
    },
    [endDrag]
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e)
    },
    [endDrag]
  )

  const onDoubleClick = useCallback(() => {
    const h = clamp(DEFAULT_PX)
    heightRef.current = h
    setFooterHeightPx(h)
    persist(h)
  }, [persist])

  return {
    footerHeightPx,
    timelineMaxPx: maxHeightPx(),
    splitterHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onDoubleClick,
    },
  }
}
