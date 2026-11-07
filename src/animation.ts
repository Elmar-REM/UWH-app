import { Frame, Play, PlayerState, SPEED_MS, inPool } from './model'

export const MIN_FRAME_SECONDS = 0.6

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

/** A player state ready to draw. depthLevel: 0 at the surface, 1 on the bottom. */
export interface DrawState extends PlayerState {
  depthLevel: number
}

export interface Snapshot {
  players: Record<string, DrawState>
  puck: { x: number; y: number }
  arrows: Frame['arrows']
  note: string
}

export function frameDuration(frame: Frame, index: number) {
  return index === 0 ? 0 : Math.max(MIN_FRAME_SECONDS, frame.duration)
}

export function totalDuration(play: Play) {
  return play.frames.reduce((sum, f, i) => sum + frameDuration(f, i), 0)
}

/** Start time (seconds) of every frame in the timeline. */
export function frameTimes(play: Play) {
  const times: number[] = []
  let t = 0
  play.frames.forEach((f, i) => {
    t += frameDuration(f, i)
    times.push(t)
  })
  return times
}

export function snapshotOfFrame(frame: Frame): Snapshot {
  const players: Record<string, DrawState> = {}
  for (const [id, s] of Object.entries(frame.players)) {
    players[id] = { ...s, depthLevel: s.depth === 'down' ? 1 : 0 }
  }
  return { players, puck: { ...frame.puck }, arrows: frame.arrows, note: frame.note }
}

/** Interpolated picture of the play at time t (seconds). */
export function snapshotAt(play: Play, t: number): Snapshot {
  const times = frameTimes(play)
  const frames = play.frames
  if (frames.length === 1 || t <= 0) return snapshotOfFrame(frames[0])
  let i = 1
  while (i < frames.length && times[i] < t) i++
  if (i >= frames.length) return snapshotOfFrame(frames[frames.length - 1])
  const a = frames[i - 1]
  const b = frames[i]
  const span = times[i] - times[i - 1]
  const raw = span <= 0 ? 1 : (t - times[i - 1]) / span
  const k = ease(Math.min(1, Math.max(0, raw)))
  const players: Record<string, DrawState> = {}
  for (const id of Object.keys(b.players)) {
    const sa = a.players[id] ?? b.players[id]
    const sb = b.players[id]
    const dx = sb.x - sa.x
    const dy = sb.y - sa.y
    const moving = Math.hypot(dx, dy) > 0.4
    // Swimmers face where they are going while moving, then turn to the planned heading.
    const travel = Math.atan2(dx, dy)
    let heading: number
    if (moving && k < 0.8) heading = lerpAngle(sa.heading, travel, Math.min(1, k * 4))
    else if (moving) heading = lerpAngle(travel, sb.heading, (k - 0.8) / 0.2)
    else heading = lerpAngle(sa.heading, sb.heading, k)
    const da = sa.depth === 'down' ? 1 : 0
    const db = sb.depth === 'down' ? 1 : 0
    players[id] = {
      x: sa.x + dx * k,
      y: sa.y + dy * k,
      heading,
      depth: k < 0.5 ? sa.depth : sb.depth,
      depthLevel: da + (db - da) * k,
    }
  }
  return {
    players,
    puck: { x: a.puck.x + (b.puck.x - a.puck.x) * k, y: a.puck.y + (b.puck.y - a.puck.y) * k },
    arrows: raw < 0.5 ? a.arrows : b.arrows,
    note: b.note,
  }
}

/** Seconds a frame needs so every player can make their move at their own speed. */
export function requiredSeconds(play: Play, index: number) {
  if (index === 0) return 0
  const a = play.frames[index - 1]
  const b = play.frames[index]
  let need = MIN_FRAME_SECONDS
  for (const p of play.players) {
    const sa = a.players[p.id]
    const sb = b.players[p.id]
    if (!sa || !sb) continue
    if (!inPool(play.pool, sa) && !inPool(play.pool, sb)) continue
    const d = Math.hypot(sb.x - sa.x, sb.y - sa.y)
    // Going up for air or diving back down costs time too.
    const vertical = sa.depth !== sb.depth ? play.pool.depth / 1.2 : 0
    need = Math.max(need, d / SPEED_MS[p.speed] + vertical)
  }
  return Math.round(need * 10) / 10
}

export interface Warning {
  frameIndex: number
  playerId: string
  kind: 'speed' | 'breath' | 'count'
  message: string
}

/** Checks the play for moves that are not physically realistic. */
export function analyse(play: Play): Warning[] {
  const out: Warning[] = []
  const label = (id: string) => {
    const p = play.players.find((q) => q.id === id)
    return p ? `${p.team === 'white' ? 'White' : 'Black'} #${p.number}${p.name ? ' ' + p.name : ''}` : id
  }
  play.frames.forEach((f, i) => {
    if (i > 0) {
      const a = play.frames[i - 1]
      const dur = frameDuration(f, i)
      for (const p of play.players) {
        const sa = a.players[p.id]
        const sb = f.players[p.id]
        if (!sa || !sb || (!inPool(play.pool, sa) && !inPool(play.pool, sb))) continue
        const d = Math.hypot(sb.x - sa.x, sb.y - sa.y)
        const v = d / dur
        if (v > SPEED_MS[p.speed] * 1.15) {
          out.push({
            frameIndex: i,
            playerId: p.id,
            kind: 'speed',
            message: `${label(p.id)} would swim ${v.toFixed(1)} m/s (${p.speed} is about ${SPEED_MS[p.speed]} m/s)`,
          })
        }
      }
    }
    for (const team of ['white', 'black'] as const) {
      const n = play.players.filter((p) => p.team === team && f.players[p.id] && inPool(play.pool, f.players[p.id])).length
      if (n > 6) out.push({ frameIndex: i, playerId: '', kind: 'count', message: `${team === 'white' ? 'White' : 'Black'} has ${n} players in the water (max 6)` })
    }
  })
  // Breath: continuous time on the bottom.
  const times = frameTimes(play)
  for (const p of play.players) {
    let downSince: number | null = null
    let warned = false
    play.frames.forEach((f, i) => {
      const s = f.players[p.id]
      const down = !!s && s.depth === 'down' && inPool(play.pool, s)
      if (down && downSince === null) downSince = i === 0 ? 0 : times[i - 1]
      if (!down) {
        downSince = null
        warned = false
      }
      if (down && downSince !== null && !warned && times[i] - downSince > p.breath) {
        warned = true
        out.push({
          frameIndex: i,
          playerId: p.id,
          kind: 'breath',
          message: `${label(p.id)} has been down ${(times[i] - downSince).toFixed(0)} s (breath hold ${p.breath} s)`,
        })
      }
    })
  }
  return out
}
