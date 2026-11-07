import { requiredSeconds } from './animation'
import {
  FORMATIONS,
  Frame,
  Play,
  PlayerState,
  SPEED_MS,
  TeamId,
  clone,
  formationState,
  inPool,
  placeTeam,
  uid,
} from './model'

function blankFrom(prev: Frame, note: string): Frame {
  return { id: uid(), duration: 3, note, players: clone(prev.players), puck: { ...prev.puck }, arrows: [] }
}

/** Sets every frame's time so each player can make their move at their own speed. */
export function autoTiming(play: Play): Play {
  const next = clone(play)
  next.frames.forEach((f, i) => {
    if (i > 0) f.duration = requiredSeconds(next, i)
  })
  return next
}

const fieldPlayers = (play: Play, frame: Frame, team: TeamId) =>
  play.players.filter((p) => p.team === team && frame.players[p.id] && inPool(play.pool, frame.players[p.id]))

/**
 * Breathing rotation: field players go up for air in pairs so the team always
 * keeps four on the bottom. Adds frames after the given frame.
 */
export function breathRotation(play: Play, fromIndex: number, team: TeamId, rounds = 1): Play {
  const next = clone(play)
  const base = next.frames[fromIndex]
  const field = fieldPlayers(next, base, team)
  if (field.length === 0) return next
  // Pair up players who play next to each other: forwards with forwards, backs with backs.
  const groups: string[][] = []
  for (let i = 0; i < field.length; i += 2) groups.push(field.slice(i, i + 2).map((p) => p.id))
  const dir = team === 'white' ? -1 : 1 // drift back towards own goal while breathing
  const frames: Frame[] = []
  let prev = base
  for (let r = 0; r < rounds; r++) {
    groups.forEach((g, gi) => {
      const f = blankFrom(prev, `${team === 'white' ? 'White' : 'Black'} rotation: group ${gi + 1} up for air`)
      for (const id of field.map((p) => p.id)) {
        const s = f.players[id]
        const home = base.players[id]
        if (g.includes(id)) {
          s.depth = 'up'
          s.y = clampY(next, home.y + dir * 1.2)
        } else {
          s.depth = 'down'
          s.y = home.y
          s.x = home.x
        }
      }
      f.duration = 3.5
      frames.push(f)
      prev = f
    })
  }
  const back = blankFrom(prev, 'Everyone back on the bottom')
  for (const p of field) back.players[p.id] = { ...base.players[p.id], depth: 'down' }
  back.duration = 3
  frames.push(back)
  next.frames.splice(fromIndex + 1, 0, ...frames)
  return autoTiming(next)
}

function clampY(play: Play, y: number) {
  return Math.min(play.pool.length - 0.3, Math.max(0.3, y))
}

/** Builds the classic start of play: both teams on the wall, sprint, first contact. */
export function startOfPlay(play: Play): Play {
  const next = clone(play)
  const pool = next.pool
  const f0: Frame = { id: uid(), duration: 0, note: 'Start: both teams touching their end wall', players: {}, puck: { x: pool.width / 2, y: pool.length / 2 }, arrows: [] }
  placeTeam(pool, next.players, f0.players, 'white', FORMATIONS[0])
  placeTeam(pool, next.players, f0.players, 'black', FORMATIONS[0])
  for (const id of Object.keys(f0.players)) if (inPool(pool, f0.players[id])) f0.players[id].depth = 'up'

  // Sprint: forwards race for the puck, backs drop in behind.
  const f1 = blankFrom(f0, 'Sprint: forwards race for the puck, backs take position')
  const mid = pool.length / 2
  for (const team of ['white', 'black'] as TeamId[]) {
    const field = fieldPlayers(next, f0, team)
    field.forEach((p, i) => {
      const isForward = /forward/i.test(p.role)
      const slot = FORMATIONS[1].slots.find((sl) => sl.role === p.role) ?? FORMATIONS[1].slots[i]
      const target = formationState(pool, team, slot)
      const s = f1.players[p.id]
      // How far this player gets in the sprint depends on their speed.
      const reach = SPEED_MS[p.speed] * 4.5
      const goalY = isForward ? (team === 'white' ? mid - 0.9 : mid + 0.9) : target.y
      const startY = s.y
      const dist = Math.abs(goalY - startY)
      const t = Math.min(1, reach / Math.max(0.1, dist))
      s.y = startY + (goalY - startY) * t
      s.x = isForward ? pool.width / 2 + (target.x - pool.width / 2) * 0.55 : target.x
      s.depth = 'down'
      s.heading = team === 'white' ? 0 : Math.PI
    })
  }
  f1.duration = 4.5

  // Contact: the team with the fastest centre forward wins the puck and passes back.
  const f2 = blankFrom(f1, 'First contact: puck flicked back to support')
  const cf = (team: TeamId) => fieldPlayers(next, f0, team).find((p) => p.role === 'Centre forward')
  const w = cf('white')
  const b = cf('black')
  const winner: TeamId = w && b && SPEED_MS[b.speed] > SPEED_MS[w.speed] ? 'black' : 'white'
  const wcf = winner === 'white' ? w : b
  if (wcf) {
    const s = f2.players[wcf.id]
    s.y = winner === 'white' ? mid - 0.4 : mid + 0.4
    s.x = pool.width / 2
    const back = winner === 'white' ? -3 : 3
    f2.puck = { x: pool.width / 2 + 1.2, y: mid + back }
    f2.arrows.push({ id: uid(), x1: pool.width / 2, y1: mid, x2: pool.width / 2 + 1.2, y2: mid + back, color: '#facc15' })
  }
  f2.duration = 2
  next.frames = [f0, f1, f2]
  return autoTiming(next)
}

/** Mirrors the play left to right, handy for running the same move on the other side. */
export function mirrorPlay(play: Play): Play {
  const next = clone(play)
  const W = next.pool.width
  const flip = (s: PlayerState) => {
    if (inPool(next.pool, s)) {
      s.x = W - s.x
      s.heading = -s.heading
    }
  }
  for (const f of next.frames) {
    Object.values(f.players).forEach(flip)
    f.puck.x = W - f.puck.x
    f.arrows.forEach((a) => {
      a.x1 = W - a.x1
      a.x2 = W - a.x2
    })
  }
  return next
}
