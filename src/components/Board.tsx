import { useEffect, useRef, useState } from 'react'
import { Frame, Play, uid } from '../model'
import { Snapshot } from '../animation'
import { View, ViewOptions, drawScene, hitTest, makeView, rotationHandle, toWorld } from '../render'

export type Tool = 'move' | 'arrow' | 'erase'

interface Props {
  play: Play
  frameIndex: number
  snapshot: Snapshot
  next: Snapshot | null
  editable: boolean
  selectedId: string | null
  tool: Tool
  arrowColor: string
  options: ViewOptions
  autoFace: boolean
  warnIds: Set<string>
  onSelect: (id: string | null) => void
  onBegin: () => void
  onLive: (play: Play) => void
  onEnd: () => void
  onToggleDepth: (id: string) => void
}

type Drag =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'rotate'; id: string }
  | { kind: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | null

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function Board(props: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View | null>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [drag, setDrag] = useState<Drag>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    c.style.width = `${size.w}px`
    c.style.height = `${size.h}px`
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    const v = makeView(props.play.pool, props.options.orientation, size.w, size.h)
    viewRef.current = v
    drawScene(ctx, v, props.play, props.snapshot, {
      ...props.options,
      selectedId: props.editable ? props.selectedId : null,
      warnIds: props.warnIds,
      next: props.editable ? props.next : null,
      draftArrow: drag?.kind === 'arrow' ? { ...drag, color: props.arrowColor } : null,
    })
  })

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as [number, number]
  }

  const mutateFrame = (fn: (f: Frame) => void) => {
    const p = propsRef.current
    const play: Play = { ...p.play, frames: p.play.frames.slice() }
    const f: Frame = { ...play.frames[p.frameIndex], players: { ...play.frames[p.frameIndex].players }, arrows: play.frames[p.frameIndex].arrows.slice() }
    fn(f)
    play.frames[p.frameIndex] = f
    p.onLive(play)
  }

  const onDown = (e: React.PointerEvent) => {
    const p = propsRef.current
    const v = viewRef.current
    if (!v || !p.editable) return
    const [sx, sy] = point(e)
    const [wx, wy] = toWorld(v, sx, sy)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (p.tool === 'arrow') {
      p.onBegin()
      setDrag({ kind: 'arrow', x1: wx, y1: wy, x2: wx, y2: wy })
      return
    }
    if (p.tool === 'erase') {
      const f = p.play.frames[p.frameIndex]
      const hit = f.arrows.find((a) => distToSegment(wx, wy, a.x1, a.y1, a.x2, a.y2) < 0.6)
      if (hit) {
        p.onBegin()
        mutateFrame((fr) => (fr.arrows = fr.arrows.filter((a) => a.id !== hit.id)))
        p.onEnd()
      }
      return
    }
    // Rotation handle of the selected player
    if (p.selectedId && p.selectedId !== 'puck') {
      const st = p.snapshot.players[p.selectedId]
      if (st) {
        const [hx, hy] = rotationHandle(v, st, p.options)
        if (Math.hypot(sx - hx, sy - hy) < 14) {
          p.onBegin()
          setDrag({ kind: 'rotate', id: p.selectedId })
          return
        }
      }
    }
    const id = hitTest(v, p.play, p.snapshot, sx, sy, p.options)
    p.onSelect(id)
    if (id) {
      const pos = id === 'puck' ? p.snapshot.puck : p.snapshot.players[id]
      p.onBegin()
      setDrag({ kind: 'move', id, dx: pos.x - wx, dy: pos.y - wy })
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const v = viewRef.current
    if (!v || !drag) return
    const [sx, sy] = point(e)
    const [wx, wy] = toWorld(v, sx, sy)
    const p = propsRef.current
    const pool = p.play.pool
    if (drag.kind === 'arrow') {
      setDrag({ ...drag, x2: wx, y2: wy })
      return
    }
    if (drag.kind === 'rotate') {
      mutateFrame((f) => {
        const s = f.players[drag.id]
        f.players[drag.id] = { ...s, heading: Math.atan2(wx - s.x, wy - s.y) }
      })
      return
    }
    const nx = Math.min(v.maxX - 0.3, Math.max(v.minX + 0.3, wx + drag.dx))
    const ny = Math.min(v.maxY - 0.3, Math.max(v.minY + 0.3, wy + drag.dy))
    if (drag.id === 'puck') {
      mutateFrame((f) => (f.puck = { x: Math.min(pool.width, Math.max(0, nx)), y: Math.min(pool.length, Math.max(0, ny)) }))
      return
    }
    mutateFrame((f) => {
      const s = f.players[drag.id]
      const ns = { ...s, x: nx, y: ny }
      const prevFrame = p.play.frames[p.frameIndex - 1]
      const from = prevFrame?.players[drag.id]
      if (p.autoFace && from && Math.hypot(nx - from.x, ny - from.y) > 0.6) ns.heading = Math.atan2(nx - from.x, ny - from.y)
      f.players[drag.id] = ns
    })
  }

  const onUp = () => {
    const p = propsRef.current
    if (drag?.kind === 'arrow') {
      if (Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1) > 0.5) {
        mutateFrame((f) => f.arrows.push({ id: uid(), x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2, color: p.arrowColor }))
      }
    }
    if (drag) p.onEnd()
    setDrag(null)
  }

  const onDouble = (e: React.MouseEvent) => {
    const p = propsRef.current
    const v = viewRef.current
    if (!v || !p.editable || p.tool !== 'move') return
    const r = canvas.current!.getBoundingClientRect()
    const id = hitTest(v, p.play, p.snapshot, e.clientX - r.left, e.clientY - r.top, p.options)
    if (id && id !== 'puck') p.onToggleDepth(id)
  }

  return (
    <div className="board" ref={wrap}>
      <canvas
        ref={canvas}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDouble}
        style={{ cursor: props.tool === 'arrow' ? 'crosshair' : props.tool === 'erase' ? 'not-allowed' : drag ? 'grabbing' : 'default' }}
        aria-label="Underwater hockey pool"
      />
    </div>
  )
}
