import { BODY, Play, PoolConfig, TeamId, subBox, inPool } from './model'
import { DrawState, Snapshot } from './animation'

export type Orientation = 'landscape' | 'portrait'
export type PlayerStyle = 'body' | 'token'

export interface ViewOptions {
  orientation: Orientation
  style: PlayerStyle
  sizeScale: number
  showGrid: boolean
  showNames: boolean
  showPaths: boolean
  watermark?: string
}

export interface View {
  orientation: Orientation
  scale: number
  ox: number
  oy: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const MARGIN_SIDE = 4.2
const MARGIN_END = 1.2

export function makeView(pool: PoolConfig, orientation: Orientation, cw: number, ch: number, pad = 12): View {
  const minX = -MARGIN_SIDE
  const maxX = pool.width + MARGIN_SIDE
  const minY = -MARGIN_END
  const maxY = pool.length + MARGIN_END
  const worldW = orientation === 'landscape' ? maxY - minY : maxX - minX
  const worldH = orientation === 'landscape' ? maxX - minX : maxY - minY
  const scale = Math.min((cw - pad * 2) / worldW, (ch - pad * 2) / worldH)
  const ox = (cw - worldW * scale) / 2
  const oy = (ch - worldH * scale) / 2
  return { orientation, scale, ox, oy, minX, maxX, minY, maxY }
}

export function toScreen(v: View, x: number, y: number): [number, number] {
  if (v.orientation === 'landscape') return [v.ox + (y - v.minY) * v.scale, v.oy + (x - v.minX) * v.scale]
  return [v.ox + (x - v.minX) * v.scale, v.oy + (v.maxY - y) * v.scale]
}

export function toWorld(v: View, sx: number, sy: number): [number, number] {
  if (v.orientation === 'landscape') return [(sy - v.oy) / v.scale + v.minX, (sx - v.ox) / v.scale + v.minY]
  return [(sx - v.ox) / v.scale + v.minX, v.maxY - (sy - v.oy) / v.scale]
}

export const TEAM_COLORS: Record<TeamId, { fill: string; dark: string; text: string; stick: string; outline: string }> = {
  white: { fill: '#f8fafc', dark: '#cbd5e1', text: '#0f172a', stick: '#ffffff', outline: '#0f172a' },
  black: { fill: '#111827', dark: '#030712', text: '#f8fafc', stick: '#0b0b0b', outline: '#f8fafc' },
}

const HAND = '#f59e0b'

function poly(ctx: CanvasRenderingContext2D, v: View, pts: [number, number][]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    const [sx, sy] = toScreen(v, x, y)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  })
  ctx.closePath()
}

function arrowLine(ctx: CanvasRenderingContext2D, v: View, x1: number, y1: number, x2: number, y2: number, color: string, width: number, dashed = false) {
  const [a, b] = toScreen(v, x1, y1)
  const [c, d] = toScreen(v, x2, y2)
  const ang = Math.atan2(d - b, c - a)
  const head = Math.max(8, width * 3.2)
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  if (dashed) ctx.setLineDash([width * 2, width * 2])
  ctx.beginPath()
  ctx.moveTo(a, b)
  ctx.lineTo(c - Math.cos(ang) * head * 0.6, d - Math.sin(ang) * head * 0.6)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(c, d)
  ctx.lineTo(c - Math.cos(ang - 0.45) * head, d - Math.sin(ang - 0.45) * head)
  ctx.lineTo(c - Math.cos(ang + 0.45) * head, d - Math.sin(ang + 0.45) * head)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawPool(ctx: CanvasRenderingContext2D, v: View, pool: PoolConfig, opts: ViewOptions) {
  const W = pool.width
  const L = pool.length
  const s = v.scale
  // Deck
  const [dx0, dy0] = toScreen(v, v.minX, v.minY)
  const [dx1, dy1] = toScreen(v, v.maxX, v.maxY)
  ctx.fillStyle = '#d6dde5'
  ctx.fillRect(Math.min(dx0, dx1), Math.min(dy0, dy1), Math.abs(dx1 - dx0), Math.abs(dy1 - dy0))

  // Water
  const [px0, py0] = toScreen(v, 0, 0)
  const [px1, py1] = toScreen(v, W, L)
  const rx = Math.min(px0, px1)
  const ry = Math.min(py0, py1)
  const rw = Math.abs(px1 - px0)
  const rh = Math.abs(py1 - py0)
  const g = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh)
  g.addColorStop(0, '#1d78b5')
  g.addColorStop(1, '#155e93')
  ctx.fillStyle = g
  ctx.fillRect(rx, ry, rw, rh)

  // Bottom tiles / metre grid
  if (opts.showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'
    ctx.lineWidth = 1
    for (let x = 1; x < W; x++) {
      const [a, b] = toScreen(v, x, 0)
      const [c, d] = toScreen(v, x, L)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke()
    }
    for (let y = 1; y < L; y++) {
      const [a, b] = toScreen(v, 0, y)
      const [c, d] = toScreen(v, W, y)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke()
    }
  }

  // Centre line and quarter marks
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1.5, s * 0.08)
  ctx.setLineDash([s * 0.5, s * 0.35])
  {
    const [a, b] = toScreen(v, 0, L / 2)
    const [c, d] = toScreen(v, W, L / 2)
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  for (const q of [L / 4, (3 * L) / 4]) {
    const [a, b] = toScreen(v, 0, q)
    const [c, d] = toScreen(v, W, q)
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke()
  }
  // Centre spot
  {
    const [cx, cy] = toScreen(v, W / 2, L / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill()
  }

  // Pool walls
  ctx.strokeStyle = '#0b2a40'
  ctx.lineWidth = Math.max(2, s * 0.12)
  ctx.strokeRect(rx, ry, rw, rh)

  // Goals: a 3 m metal tray against each end wall
  const gw = pool.goalWidth
  const gd = 0.45
  for (const [y0, y1, team] of [[0, gd, 'white'], [L - gd, L, 'black']] as [number, number, TeamId][]) {
    poly(ctx, v, [[W / 2 - gw / 2, y0], [W / 2 + gw / 2, y0], [W / 2 + gw / 2, y1], [W / 2 - gw / 2, y1]])
    ctx.fillStyle = '#9aa7b4'
    ctx.fill()
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = Math.max(1.5, s * 0.06)
    ctx.stroke()
    // gutter slot
    poly(ctx, v, [[W / 2 - gw / 2 + 0.1, (y0 + y1) / 2 - 0.06], [W / 2 + gw / 2 - 0.1, (y0 + y1) / 2 - 0.06], [W / 2 + gw / 2 - 0.1, (y0 + y1) / 2 + 0.06], [W / 2 - gw / 2 + 0.1, (y0 + y1) / 2 + 0.06]])
    ctx.fillStyle = '#475569'
    ctx.fill()
    const [lx, ly] = toScreen(v, W / 2, team === 'white' ? -0.6 : L + 0.6)
    ctx.save()
    ctx.translate(lx, ly)
    if (v.orientation === 'landscape') ctx.rotate(team === 'white' ? -Math.PI / 2 : Math.PI / 2)
    label(ctx, `${team === 'white' ? 'White' : 'Black'} goal`, 0, 0, Math.max(10, s * 0.42), '#334155')
    ctx.restore()
  }

  // Sub boxes
  for (const team of ['white', 'black'] as TeamId[]) {
    const b = subBox(pool, team)
    poly(ctx, v, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]])
    ctx.fillStyle = team === 'white' ? 'rgba(255,255,255,0.55)' : 'rgba(17,24,39,0.18)'
    ctx.fill()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
    const lxw = pool.subSide === 'left' ? b.x - 0.65 : b.x + b.w + 0.65
    const [tx, ty] = toScreen(v, lxw, b.y + b.h / 2)
    ctx.save()
    ctx.translate(tx, ty)
    if (v.orientation === 'portrait') ctx.rotate(-Math.PI / 2)
    label(ctx, `${team === 'white' ? 'White' : 'Black'} subs`, 0, 0, Math.max(9, s * 0.36), '#334155')
    ctx.restore()
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `600 ${size}px system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

export interface PlayerLike {
  id: string
  team: TeamId
  number: number
  name: string
  stickHand: 'L' | 'R'
}

function local(st: DrawState, f: number, r: number): [number, number] {
  const fx = Math.sin(st.heading)
  const fy = Math.cos(st.heading)
  const rx = Math.cos(st.heading)
  const ry = -Math.sin(st.heading)
  return [st.x + fx * f + rx * r, st.y + fy * f + ry * r]
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  v: View,
  p: PlayerLike,
  st: DrawState,
  opts: ViewOptions,
  selected: boolean,
  warn: boolean,
  bench = false,
) {
  const k = opts.sizeScale
  const c = TEAM_COLORS[p.team]
  const s = v.scale
  const up = st.depthLevel < 0.5 && !bench
  const alpha = bench ? 0.85 : 0.5 + 0.5 * st.depthLevel
  const hand = p.stickHand === 'R' ? 1 : -1
  const [cx, cy] = toScreen(v, st.x, st.y)

  ctx.save()
  if (opts.style === 'body') {
    const len = BODY.length * k
    const sh = (BODY.shoulders / 2) * k
    const fin = BODY.finLength * k
    const headR = (BODY.head / 2) * k * 1.15
    const top = len * 0.28 // shoulder line; the position point sits mid torso
    const hips = -len * 0.22
    const feet = -len * 0.6

    // Shadow on the pool floor for players on the bottom
    if (st.depthLevel > 0.3 && !bench) {
      ctx.globalAlpha = 0.25 * st.depthLevel
      const off = (pt: [number, number]): [number, number] => [pt[0] + 0.14, pt[1] - 0.14]
      poly(ctx, v, [
        off(local(st, top + headR * 2, 0)),
        off(local(st, top, sh * 1.1)),
        off(local(st, feet - fin * 0.6, sh * 0.5)),
        off(local(st, feet - fin * 0.6, -sh * 0.5)),
        off(local(st, top, -sh * 1.1)),
      ])
      ctx.fillStyle = '#04263d'
      ctx.fill()
    }
    ctx.globalAlpha = alpha

    // Fins
    for (const side of [-1, 1]) {
      poly(ctx, v, [
        local(st, feet, side * 0.06 * k),
        local(st, feet, side * 0.16 * k),
        local(st, feet - fin, side * 0.24 * k),
        local(st, feet - fin, side * 0.02 * k),
      ])
      ctx.fillStyle = c.dark
      ctx.fill()
      ctx.strokeStyle = c.outline
      ctx.lineWidth = 1
      ctx.stroke()
    }
    // Legs
    poly(ctx, v, [
      local(st, hips, -sh * 0.8),
      local(st, hips, sh * 0.8),
      local(st, feet, sh * 0.45),
      local(st, feet, -sh * 0.45),
    ])
    ctx.fillStyle = c.fill
    ctx.fill()
    ctx.strokeStyle = c.outline
    ctx.lineWidth = Math.max(1, s * 0.035)
    ctx.stroke()
    // Torso
    poly(ctx, v, [
      local(st, top, -sh),
      local(st, top, sh),
      local(st, hips, sh * 0.8),
      local(st, hips, -sh * 0.8),
    ])
    ctx.fill()
    ctx.stroke()

    // Free arm, tucked along the body
    const free = -hand
    {
      const [a, b] = toScreen(v, ...local(st, top - 0.05, free * sh))
      const [e, f] = toScreen(v, ...local(st, top - 0.45 * k, free * (sh + 0.08 * k)))
      ctx.strokeStyle = c.outline
      ctx.lineWidth = Math.max(2, s * 0.11 * k)
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
      ctx.strokeStyle = c.fill
      ctx.lineWidth = Math.max(1, s * 0.07 * k)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
    }
    // Stick arm, reaching forward
    const handPt = local(st, top + 0.5 * k, hand * (sh + 0.12 * k))
    {
      const [a, b] = toScreen(v, ...local(st, top - 0.05, hand * sh))
      const [e, f] = toScreen(v, ...handPt)
      ctx.strokeStyle = c.outline
      ctx.lineWidth = Math.max(2, s * 0.11 * k)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
      ctx.strokeStyle = c.fill
      ctx.lineWidth = Math.max(1, s * 0.07 * k)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
    }
    // Stick: up to 35 cm, angled slightly in front of the hand
    {
      const tip = local(st, top + 0.5 * k + BODY.stick * k * 0.85, hand * (sh + 0.12 * k) - hand * BODY.stick * k * 0.5)
      const [a, b] = toScreen(v, ...handPt)
      const [e, f] = toScreen(v, ...tip)
      ctx.lineCap = 'round'
      ctx.strokeStyle = p.team === 'white' ? '#0f172a' : '#e2e8f0'
      ctx.lineWidth = Math.max(3, s * 0.1 * k)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
      ctx.strokeStyle = c.stick
      ctx.lineWidth = Math.max(2, s * 0.06 * k)
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(e, f); ctx.stroke()
    }
    // Glove on the stick hand
    {
      const [hx, hy] = toScreen(v, ...handPt)
      ctx.fillStyle = HAND
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(hx, hy, Math.max(3, s * 0.08 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    // Head with cap
    {
      const [hx, hy] = toScreen(v, ...local(st, top + headR * 0.9, 0))
      ctx.fillStyle = c.fill
      ctx.strokeStyle = c.outline
      ctx.lineWidth = Math.max(1, s * 0.035)
      ctx.beginPath(); ctx.arc(hx, hy, Math.max(3, s * headR), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      // Snorkel on the left side of the head
      const [sx1, sy1] = toScreen(v, ...local(st, top + headR, -headR * 0.9))
      const [sx2, sy2] = toScreen(v, ...local(st, top - headR * 0.6, -headR * 1.2))
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = Math.max(1.5, s * 0.05)
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke()
    }
    // Number on the back
    {
      const [nx, ny] = toScreen(v, ...local(st, (top + hips) / 2, 0))
      ctx.globalAlpha = 1
      ctx.font = `800 ${Math.max(9, s * 0.42 * k)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = c.text
      ctx.fillText(String(p.number), nx, ny)
    }
  } else {
    // Token style
    const r = Math.max(8, s * 0.42 * k)
    ctx.globalAlpha = alpha
    ctx.fillStyle = c.fill
    ctx.strokeStyle = c.outline
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    // facing pointer
    const tipW = local(st, 0.42 * k + 0.25 * k, 0)
    const [tx, ty] = toScreen(v, ...tipW)
    const ang = Math.atan2(ty - cy, tx - cx)
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(cx + Math.cos(ang - 0.5) * r, cy + Math.sin(ang - 0.5) * r)
    ctx.lineTo(cx + Math.cos(ang + 0.5) * r, cy + Math.sin(ang + 0.5) * r)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    // stick hand marker
    const handW = local(st, 0.35 * k, hand * 0.45 * k)
    const stickW = local(st, 0.35 * k + 0.32 * k, hand * 0.45 * k - hand * 0.15 * k)
    const [hx, hy] = toScreen(v, ...handW)
    const [kx, ky] = toScreen(v, ...stickW)
    ctx.strokeStyle = p.team === 'white' ? '#0f172a' : '#e2e8f0'
    ctx.lineWidth = Math.max(3, s * 0.1 * k)
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke()
    ctx.strokeStyle = c.stick
    ctx.lineWidth = Math.max(2, s * 0.06 * k)
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke()
    ctx.fillStyle = HAND
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(3, r * 0.25), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    ctx.font = `800 ${r * 0.95}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = c.text
    ctx.fillText(String(p.number), cx, cy + 1)
  }

  ctx.globalAlpha = 1
  // Up at the surface: ripple rings and an UP tag
  if (up) {
    const r = Math.max(12, s * 0.62 * k)
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    tag(ctx, 'UP', cx + r * 0.8, cy - r * 0.8, '#0ea5e9', '#ffffff')
  }
  if (warn) {
    const r = Math.max(16, s * 1.0 * k)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  }
  if (selected) {
    const r = Math.max(18, s * 1.1 * k)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    // rotation handle
    const [hx, hy] = rotationHandle(v, st, opts)
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy)
    ctx.strokeStyle = 'rgba(250,204,21,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#facc15'
    ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#713f12'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  if (opts.showNames && p.name) {
    const off = Math.max(18, s * 1.1 * opts.sizeScale)
    ctx.font = `600 ${Math.max(10, s * 0.34)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(p.name, cx, cy + off)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(p.name, cx, cy + off)
  }
  ctx.restore()
}

export function rotationHandle(v: View, st: DrawState, opts: ViewOptions): [number, number] {
  const reach = (opts.style === 'body' ? BODY.length * 0.28 + 0.95 : 1.2) * opts.sizeScale
  return toScreen(v, ...local(st, reach, 0))
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string) {
  ctx.font = '700 9px system-ui, sans-serif'
  const w = ctx.measureText(text).width + 6
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - 7, w, 14, 4)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 0.5)
}

export function drawPuck(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, selected: boolean) {
  const [px, py] = toScreen(v, x, y)
  const r = Math.max(6, v.scale * 0.16)
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath(); ctx.arc(px + 2, py + 2, r, 0, Math.PI * 2); ctx.fill()
  const g = ctx.createRadialGradient(px - r / 3, py - r / 3, 1, px, py, r)
  g.addColorStop(0, '#fb923c')
  g.addColorStop(1, '#c2410c')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#431407'
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (selected) {
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

export interface SceneOptions extends ViewOptions {
  selectedId: string | null
  warnIds?: Set<string>
  next?: Snapshot | null
  draftArrow?: { x1: number; y1: number; x2: number; y2: number; color: string } | null
  caption?: string
}

export function drawScene(ctx: CanvasRenderingContext2D, v: View, play: Play, snap: Snapshot, opts: SceneOptions) {
  drawPool(ctx, v, play.pool, opts)

  // Planned movement to the next frame
  if (opts.showPaths && opts.next) {
    for (const p of play.players) {
      const a = snap.players[p.id]
      const b = opts.next.players[p.id]
      if (!a || !b) continue
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.3) continue
      const col = p.team === 'white' ? 'rgba(255,255,255,0.8)' : 'rgba(10,15,30,0.8)'
      arrowLine(ctx, v, a.x, a.y, b.x, b.y, col, Math.max(1.5, v.scale * 0.06), true)
    }
    const pa = snap.puck
    const pb = opts.next.puck
    if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > 0.3) arrowLine(ctx, v, pa.x, pa.y, pb.x, pb.y, 'rgba(251,146,60,0.9)', Math.max(1.5, v.scale * 0.07), true)
  }

  for (const a of snap.arrows) arrowLine(ctx, v, a.x1, a.y1, a.x2, a.y2, a.color, Math.max(2.5, v.scale * 0.11))
  if (opts.draftArrow) {
    const d = opts.draftArrow
    arrowLine(ctx, v, d.x1, d.y1, d.x2, d.y2, d.color, Math.max(2.5, v.scale * 0.11))
  }

  // Draw players at the surface last so they read as being above the others.
  const order = [...play.players].filter((p) => snap.players[p.id]).sort((a, b) => snap.players[b.id].depthLevel - snap.players[a.id].depthLevel)
  const downFirst = order.filter((p) => snap.players[p.id].depthLevel >= 0.5)
  const upLast = order.filter((p) => snap.players[p.id].depthLevel < 0.5)
  const draw = (p: (typeof order)[number]) =>
    drawPlayer(ctx, v, p, snap.players[p.id], opts, opts.selectedId === p.id, !!opts.warnIds?.has(p.id), !inPool(play.pool, snap.players[p.id]))
  downFirst.forEach(draw)
  drawPuck(ctx, v, snap.puck.x, snap.puck.y, opts.selectedId === 'puck')
  upLast.forEach(draw)

  if (opts.caption) {
    const cw = ctx.canvas.width
    ctx.save()
    ctx.font = '600 20px system-ui, sans-serif'
    const w = Math.min(cw - 40, ctx.measureText(opts.caption).width + 28)
    ctx.fillStyle = 'rgba(15,23,42,0.78)'
    ctx.beginPath(); ctx.roundRect((cw - w) / 2, 14, w, 36, 8); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.caption, cw / 2, 32, cw - 60)
    ctx.restore()
  }
  if (opts.watermark) {
    ctx.save()
    ctx.font = '700 16px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(15,23,42,0.55)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(opts.watermark, ctx.canvas.width - 14, ctx.canvas.height - 10)
    ctx.restore()
  }
}

/** Finds what is under the pointer: a player id, 'puck', or null. */
export function hitTest(v: View, play: Play, snap: Snapshot, sx: number, sy: number, opts: ViewOptions): string | null {
  const [px, py] = toScreen(v, snap.puck.x, snap.puck.y)
  if (Math.hypot(sx - px, sy - py) < Math.max(12, v.scale * 0.3)) return 'puck'
  let best: string | null = null
  let bestD = Infinity
  const reach = Math.max(16, v.scale * (opts.style === 'body' ? 0.95 : 0.55) * opts.sizeScale)
  for (const p of play.players) {
    const st = snap.players[p.id]
    if (!st) continue
    const [cx, cy] = toScreen(v, st.x, st.y)
    const d = Math.hypot(sx - cx, sy - cy)
    if (d < reach && d < bestD) {
      best = p.id
      bestD = d
    }
  }
  return best
}

export { inPool }
