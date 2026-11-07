import { FORMATIONS, Play, Player, PlayerState, SPEED_LABEL, SPEED_MS, Speed, TEAM_LABEL, inPool } from '../model'

interface Props {
  play: Play
  frameIndex: number
  selectedId: string
  editable: boolean
  onPlayer: (id: string, patch: Partial<Player>) => void
  onState: (id: string, patch: Partial<PlayerState>) => void
  onBench: (id: string) => void
  onField: (id: string) => void
}

const ROLES = Array.from(new Set(FORMATIONS.flatMap((f) => f.slots.map((s) => s.role)).concat(['Substitute'])))

export function PlayerPanel({ play, frameIndex, selectedId, editable, onPlayer, onState, onBench, onField }: Props) {
  const p = play.players.find((x) => x.id === selectedId)
  const st = play.frames[frameIndex].players[selectedId]
  if (!p || !st) return null
  const deg = Math.round((((st.heading * 180) / Math.PI) % 360 + 360) % 360)
  const onPitch = inPool(play.pool, st)
  return (
    <div className="panel">
      <h3>
        <span className={`dot ${p.team}`} /> {TEAM_LABEL[p.team]} #{p.number} {p.name}
      </h3>
      <fieldset disabled={!editable}>
        <div className="row">
          <label>
            Name
            <input value={p.name} placeholder="Player name" onChange={(e) => onPlayer(p.id, { name: e.target.value })} />
          </label>
          <label className="narrow">
            Cap #
            <input type="number" min={1} max={99} value={p.number} onChange={(e) => onPlayer(p.id, { number: Number(e.target.value) || 1 })} />
          </label>
        </div>
        <label>
          Position
          <input list="roles" value={p.role} onChange={(e) => onPlayer(p.id, { role: e.target.value })} />
          <datalist id="roles">
            {ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        <div className="label">In this frame</div>
        <div className="seg">
          <button className={st.depth === 'down' ? 'on' : ''} onClick={() => onState(p.id, { depth: 'down' })}>
            Down on the bottom
          </button>
          <button className={st.depth === 'up' ? 'on' : ''} onClick={() => onState(p.id, { depth: 'up' })}>
            Up for air
          </button>
        </div>
        <label>
          Facing {deg}°
          <input type="range" min={0} max={359} value={deg} onChange={(e) => onState(p.id, { heading: (Number(e.target.value) * Math.PI) / 180 })} />
        </label>
        {onPitch ? (
          <button className="ghost full" onClick={() => onBench(p.id)}>
            Sub off (move to sub box)
          </button>
        ) : (
          <button className="ghost full" onClick={() => onField(p.id)}>
            Sub on (bring into the water)
          </button>
        )}

        <div className="label">Player profile</div>
        <div className="seg">
          <button className={p.stickHand === 'L' ? 'on' : ''} onClick={() => onPlayer(p.id, { stickHand: 'L' })}>
            Left hand stick
          </button>
          <button className={p.stickHand === 'R' ? 'on' : ''} onClick={() => onPlayer(p.id, { stickHand: 'R' })}>
            Right hand stick
          </button>
        </div>
        <label>
          Speed
          <select value={p.speed} onChange={(e) => onPlayer(p.id, { speed: e.target.value as Speed })}>
            {(Object.keys(SPEED_LABEL) as Speed[]).map((s) => (
              <option key={s} value={s}>
                {SPEED_LABEL[s]} (about {SPEED_MS[s]} m/s)
              </option>
            ))}
          </select>
        </label>
        <label>
          Breath hold on the bottom: {p.breath} s
          <input type="range" min={5} max={40} value={p.breath} onChange={(e) => onPlayer(p.id, { breath: Number(e.target.value) })} />
        </label>
        <label>
          Strengths and notes
          <textarea rows={3} value={p.notes} placeholder="Strong flick, reads the game well, likes the left wing" onChange={(e) => onPlayer(p.id, { notes: e.target.value })} />
        </label>
      </fieldset>
    </div>
  )
}
