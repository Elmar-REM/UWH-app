// Core data model for the underwater hockey tactics board.
// All positions are in metres. World coordinates:
//   x runs across the width of the pool (0 = left wall, as seen from the White goal)
//   y runs along the length (0 = White goal wall, length = Black goal wall)

export type TeamId = 'white' | 'black'
export type StickHand = 'L' | 'R'
export type Speed = 'slow' | 'medium' | 'fast'
export type Depth = 'up' | 'down'
export type Side = 'left' | 'right'

export interface Player {
  id: string
  team: TeamId
  number: number
  name: string
  role: string
  stickHand: StickHand
  speed: Speed
  /** Comfortable breath hold on the bottom, seconds */
  breath: number
  notes: string
}

export interface PlayerState {
  x: number
  y: number
  /** Facing direction in radians. 0 = towards the Black goal (+y). */
  heading: number
  depth: Depth
}

export interface Arrow {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

export interface Frame {
  id: string
  /** Time taken to move from the previous frame into this one, seconds */
  duration: number
  note: string
  players: Record<string, PlayerState>
  puck: { x: number; y: number }
  arrows: Arrow[]
}

export interface PoolConfig {
  length: number
  width: number
  depth: number
  goalWidth: number
  subSide: Side
  subBoxLength: number
}

export interface Play {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  pool: PoolConfig
  players: Player[]
  frames: Frame[]
}

/** Typical swimming speeds with fins along the bottom, metres per second */
export const SPEED_MS: Record<Speed, number> = {
  slow: 1.0,
  medium: 1.4,
  fast: 1.8,
}

export const SPEED_LABEL: Record<Speed, string> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
}

export const TEAM_LABEL: Record<TeamId, string> = { white: 'White', black: 'Black' }

/** Sizes used for drawing a player from above, in metres */
export const BODY = {
  length: 1.75,
  finLength: 0.6,
  shoulders: 0.48,
  head: 0.24,
  stick: 0.35,
}

export const RULES = {
  playersInWater: 6,
  squadSize: 10,
  stickMaxLength: 0.35,
  puckDiameter: 0.08,
}

export const DEFAULT_POOL: PoolConfig = {
  length: 25,
  width: 12,
  depth: 2.5,
  goalWidth: 3,
  subSide: 'left',
  subBoxLength: 5,
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** Which end a team defends. White defends y = 0, Black defends y = length. */
export function defendsLow(team: TeamId) {
  return team === 'white'
}

/** Rectangle for a team's substitution box, outside the pool on the chosen side,
 * level with the team's own defending half. */
export function subBox(pool: PoolConfig, team: TeamId) {
  const w = 2.6
  const x = pool.subSide === 'left' ? -w - 0.4 : pool.width + 0.4
  const half = pool.length / 2
  const yCenter = defendsLow(team) ? half / 2 : half + half / 2
  return { x, y: yCenter - pool.subBoxLength / 2, w, h: pool.subBoxLength }
}

export function inPool(pool: PoolConfig, s: { x: number; y: number }) {
  return s.x >= 0 && s.x <= pool.width && s.y >= 0 && s.y <= pool.length
}

// ---------------------------------------------------------------------------
// Formations. Positions are given for a team defending y = 0, as fractions:
// fx across the width, fy along the length. They are mirrored for Black.
// ---------------------------------------------------------------------------

export interface FormationSlot {
  role: string
  fx: number
  fy: number
}

export interface Formation {
  id: string
  name: string
  description: string
  slots: FormationSlot[]
}

export const FORMATIONS: Formation[] = [
  {
    id: 'wall',
    name: 'Start of play (on the wall)',
    description: 'All six players touching their own end wall, waiting for the start signal.',
    slots: [
      { role: 'Left back', fx: 0.1, fy: 0.07 },
      { role: 'Left forward', fx: 0.26, fy: 0.07 },
      { role: 'Centre forward', fx: 0.42, fy: 0.07 },
      { role: 'Centre back', fx: 0.58, fy: 0.07 },
      { role: 'Right forward', fx: 0.74, fy: 0.07 },
      { role: 'Right back', fx: 0.9, fy: 0.07 },
    ],
  },
  {
    id: '3-3',
    name: '3 forwards, 3 backs',
    description: 'Classic shape. Three forwards in a line across the puck, three backs covering the goal.',
    slots: [
      { role: 'Left forward', fx: 0.25, fy: 0.5 },
      { role: 'Centre forward', fx: 0.5, fy: 0.54 },
      { role: 'Right forward', fx: 0.75, fy: 0.5 },
      { role: 'Left back', fx: 0.25, fy: 0.22 },
      { role: 'Centre back', fx: 0.5, fy: 0.3 },
      { role: 'Right back', fx: 0.75, fy: 0.22 },
    ],
  },
  {
    id: '3-1-2',
    name: '3 forwards, 1 half, 2 backs',
    description: 'A centre half links the forwards and backs and plugs the middle.',
    slots: [
      { role: 'Left forward', fx: 0.25, fy: 0.52 },
      { role: 'Centre forward', fx: 0.5, fy: 0.56 },
      { role: 'Right forward', fx: 0.75, fy: 0.52 },
      { role: 'Centre half', fx: 0.5, fy: 0.38 },
      { role: 'Left back', fx: 0.3, fy: 0.18 },
      { role: 'Right back', fx: 0.7, fy: 0.18 },
    ],
  },
  {
    id: '2-2-2',
    name: '2 forwards, 2 halves, 2 backs',
    description: 'Balanced pairs. Good for teams that rotate breathing in pairs.',
    slots: [
      { role: 'Left forward', fx: 0.35, fy: 0.55 },
      { role: 'Right forward', fx: 0.65, fy: 0.55 },
      { role: 'Left half', fx: 0.3, fy: 0.38 },
      { role: 'Right half', fx: 0.7, fy: 0.38 },
      { role: 'Left back', fx: 0.35, fy: 0.18 },
      { role: 'Right back', fx: 0.65, fy: 0.18 },
    ],
  },
  {
    id: 'defend',
    name: 'Defend the goal',
    description: 'Compact shape when the other team has the puck deep in your half.',
    slots: [
      { role: 'Left forward', fx: 0.3, fy: 0.32 },
      { role: 'Centre forward', fx: 0.5, fy: 0.36 },
      { role: 'Right forward', fx: 0.7, fy: 0.32 },
      { role: 'Left back', fx: 0.32, fy: 0.08 },
      { role: 'Centre back', fx: 0.5, fy: 0.14 },
      { role: 'Right back', fx: 0.68, fy: 0.08 },
    ],
  },
]

export function formationState(pool: PoolConfig, team: TeamId, slot: FormationSlot): PlayerState {
  const low = defendsLow(team)
  const x = slot.fx * pool.width
  const fy = Math.min(Math.max(slot.fy, 0.01), 0.99)
  // Mirror so Black attacks towards y = 0. Also flip left/right so "left" means
  // the player's own left when facing the opposition goal.
  return {
    x: low ? x : pool.width - x,
    y: low ? fy * pool.length : (1 - fy) * pool.length,
    heading: low ? 0 : Math.PI,
    depth: 'down',
  }
}

export function makeDefaultPlayers(): Player[] {
  const out: Player[] = []
  const hands: StickHand[] = ['R', 'R', 'L', 'R', 'R', 'R', 'R', 'L', 'R', 'R']
  const speeds: Speed[] = ['fast', 'fast', 'fast', 'medium', 'medium', 'slow', 'medium', 'fast', 'medium', 'slow']
  for (const team of ['white', 'black'] as TeamId[]) {
    for (let i = 0; i < RULES.squadSize; i++) {
      out.push({
        id: `${team}${i + 1}`,
        team,
        number: i + 1,
        name: '',
        role: i < 6 ? FORMATIONS[1].slots[i].role : 'Substitute',
        stickHand: hands[i],
        speed: speeds[i],
        breath: 15,
        notes: '',
      })
    }
  }
  return out
}

/** Places field players in a formation and subs in the sub box. */
export function placeTeam(
  pool: PoolConfig,
  players: Player[],
  states: Record<string, PlayerState>,
  team: TeamId,
  formation: Formation,
) {
  const teamPlayers = players.filter((p) => p.team === team)
  const field = teamPlayers.filter((p) => {
    const s = states[p.id]
    return s && inPool(pool, s)
  })
  const subs = teamPlayers.filter((p) => !field.includes(p))
  // Fill from current field players first, then pull in subs if fewer than six.
  const chosen = [...field, ...subs].slice(0, RULES.playersInWater)
  chosen.forEach((p, i) => {
    const slot = formation.slots[i]
    states[p.id] = formationState(pool, team, slot)
    p.role = slot.role
  })
  const bench = teamPlayers.filter((p) => !chosen.includes(p))
  placeBench(pool, bench, states, team)
}

export function placeBench(pool: PoolConfig, bench: Player[], states: Record<string, PlayerState>, team: TeamId) {
  const box = subBox(pool, team)
  bench.forEach((p, i) => {
    // Bench players sit side by side facing the pool, ready to swim on.
    states[p.id] = {
      x: pool.subSide === 'left' ? box.x + 1.75 : box.x + box.w - 1.75,
      y: box.y + 0.6 + (i * (box.h - 1.2)) / Math.max(1, bench.length - 1),
      heading: pool.subSide === 'left' ? Math.PI / 2 : -Math.PI / 2,
      depth: 'up',
    }
  })
}

export function newPlay(name = 'New play', pool: PoolConfig = DEFAULT_POOL): Play {
  const players = makeDefaultPlayers()
  const states: Record<string, PlayerState> = {}
  placeTeam(pool, players, states, 'white', FORMATIONS[1])
  placeTeam(pool, players, states, 'black', FORMATIONS[1])
  const now = Date.now()
  return {
    id: uid(),
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    pool: { ...pool },
    players,
    frames: [
      {
        id: uid(),
        duration: 0,
        note: '',
        players: states,
        puck: { x: pool.width / 2, y: pool.length / 2 },
        arrows: [],
      },
    ],
  }
}

export function teamCountInPool(play: Play, frame: Frame, team: TeamId) {
  return play.players.filter((p) => p.team === team && frame.players[p.id] && inPool(play.pool, frame.players[p.id])).length
}
