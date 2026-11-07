import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FORMATIONS,
  Frame,
  Play,
  Player,
  PlayerState,
  TEAM_LABEL,
  TeamId,
  clone,
  formationState,
  inPool,
  newPlay,
  placeBench,
  placeTeam,
  teamCountInPool,
  uid,
} from './model'
import { analyse, frameTimes, requiredSeconds, snapshotAt, snapshotOfFrame, totalDuration } from './animation'
import { autoTiming, breathRotation, mirrorPlay, startOfPlay } from './automations'
import { Orientation, PlayerStyle, ViewOptions } from './render'
import { Board, Tool } from './components/Board'
import { PlayerPanel } from './components/PlayerPanel'
import { Dialog } from './components/Dialog'
import { Guide } from './components/Guide'
import { decodePlay, deleteLocal, downloadBlob, exportJson, isPlay, loadLibrary, safeName, shareUrl, upsertLocal } from './storage'
import { recordPlay, snapshotPng } from './video'
import {
  Account,
  PLAN_LIMITS,
  PRICE_TEXT,
  cloudEnabled,
  deleteCloudPlay,
  getAccount,
  listCloudPlays,
  onAuthChange,
  openBillingPortal,
  saveCloudPlay,
  signInWithEmail,
  signOut,
  startCheckout,
} from './cloud'

const ARROW_COLORS = ['#facc15', '#ef4444', '#22c55e', '#ffffff', '#111827']
const CURRENT_KEY = 'uwh.current.v1'
const PREFS_KEY = 'uwh.prefs.v2'

type DialogName = null | 'library' | 'share' | 'export' | 'account' | 'guide' | 'pool'

interface Prefs extends ViewOptions {
  autoFace: boolean
}

const DEFAULT_PREFS: Prefs = {
  orientation: typeof window !== 'undefined' && window.innerWidth < 720 ? 'portrait' : 'landscape',
  style: 'body',
  sizeScale: 1.3,
  showGrid: true,
  showNames: true,
  showPaths: true,
  autoFace: true,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [viewerCode] = useState(() => (location.hash.startsWith('#view=') ? location.hash.slice(6) : null))
  const [play, setPlay] = useState<Play>(() => {
    try {
      const raw = localStorage.getItem(CURRENT_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (isPlay(p)) return p
      }
    } catch {
      /* ignore */
    }
    return startOfPlay(newPlay('Start of play'))
  })
  const [viewerMode, setViewerMode] = useState(!!viewerCode)
  const [frameIndex, setFrameIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('move')
  const [arrowColor, setArrowColor] = useState(ARROW_COLORS[0])
  const [prefs, setPrefs] = useState<Prefs>(() => readJson(PREFS_KEY, DEFAULT_PREFS))
  const [formTeam, setFormTeam] = useState<TeamId>('white')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState<number | null>(null)
  const [rate, setRate] = useState(1)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [past, setPast] = useState<Play[]>([])
  const [future, setFuture] = useState<Play[]>([])
  const [account, setAccount] = useState<Account>({ session: null, email: null, plan: cloudEnabled ? 'free' : 'pro', status: '' })
  const [panelOpen, setPanelOpen] = useState(false)

  const playRef = useRef(play)
  playRef.current = play
  const gestureBase = useRef<Play | null>(null)

  // Load a shared play from the link
  useEffect(() => {
    if (!viewerCode) return
    decodePlay(viewerCode)
      .then((p) => {
        if (isPlay(p)) {
          setPlay(p)
          setFrameIndex(0)
        }
      })
      .catch(() => {
        setViewerMode(false)
        flash('That share link could not be opened.')
      })
  }, [viewerCode])

  useEffect(() => {
    if (!viewerMode) localStorage.setItem(CURRENT_KEY, JSON.stringify(play))
  }, [play, viewerMode])
  useEffect(() => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)), [prefs])

  const refreshAccount = useCallback(() => {
    getAccount().then(setAccount).catch(() => {})
  }, [])
  useEffect(() => {
    refreshAccount()
    return onAuthChange(refreshAccount)
  }, [refreshAccount])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2800)
  }

  // ---- history -----------------------------------------------------------
  const commit = useCallback((next: Play) => {
    setPast((p) => [...p.slice(-60), playRef.current])
    setFuture([])
    setPlay(next)
  }, [])
  const undo = () => {
    if (!past.length) return
    setFuture((f) => [play, ...f])
    setPlay(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, play])
    setPlay(future[0])
    setFuture((f) => f.slice(1))
  }

  const fi = Math.min(frameIndex, play.frames.length - 1)
  const frame = play.frames[fi]

  const editFrame = (fn: (f: Frame) => void) => {
    const next = clone(play)
    fn(next.frames[fi])
    commit(next)
  }
  const editPlayer = (id: string, patch: Partial<Player>) => {
    const next = clone(play)
    const p = next.players.find((x) => x.id === id)
    if (p) Object.assign(p, patch)
    commit(next)
  }
  const editState = (id: string, patch: Partial<PlayerState>) => editFrame((f) => Object.assign(f.players[id], patch))

  const toggleDepth = (id: string) => editFrame((f) => (f.players[id].depth = f.players[id].depth === 'up' ? 'down' : 'up'))

  const benchPlayer = (id: string) => {
    const next = clone(play)
    const f = next.frames[fi]
    const p = next.players.find((x) => x.id === id)!
    const bench = next.players.filter((x) => x.team === p.team && (x.id === id || !inPool(next.pool, f.players[x.id])))
    placeBench(next.pool, bench, f.players, p.team)
    commit(next)
  }
  const fieldPlayer = (id: string) => {
    const next = clone(play)
    const f = next.frames[fi]
    const p = next.players.find((x) => x.id === id)!
    const slot = FORMATIONS[1].slots[Math.min(5, teamCountInPool(next, f, p.team))]
    f.players[id] = formationState(next.pool, p.team, slot)
    const bench = next.players.filter((x) => x.team === p.team && x.id !== id && !inPool(next.pool, f.players[x.id]))
    placeBench(next.pool, bench, f.players, p.team)
    commit(next)
  }

  // ---- playback ----------------------------------------------------------
  const total = totalDuration(play)
  const times = useMemo(() => frameTimes(play), [play])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * rate
      last = now
      setTime((t) => {
        const nt = (t ?? 0) + dt
        if (nt >= total) {
          setPlaying(false)
          setFrameIndex(play.frames.length - 1)
          return null
        }
        return nt
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, rate, total, play.frames.length])

  const startPlayback = () => {
    if (play.frames.length < 2) {
      flash('Add a second frame to animate the move.')
      return
    }
    setSelectedId(null)
    setTime(fi >= play.frames.length - 1 ? 0 : times[fi])
    setPlaying(true)
  }
  const stopPlayback = () => {
    setPlaying(false)
    if (time !== null) {
      let idx = 0
      times.forEach((t, i) => t <= time + 0.01 && (idx = i))
      setFrameIndex(idx)
    }
    setTime(null)
  }

  const previewing = time !== null
  const snapshot = useMemo(() => (previewing ? snapshotAt(play, time!) : snapshotOfFrame(frame)), [play, frame, time, previewing])
  const nextSnap = useMemo(() => (play.frames[fi + 1] ? snapshotOfFrame(play.frames[fi + 1]) : null), [play, fi])
  const editable = !viewerMode && !previewing

  const warnings = useMemo(() => analyse(play), [play])
  const frameWarnIds = useMemo(() => new Set(warnings.filter((w) => w.frameIndex === fi && w.playerId).map((w) => w.playerId)), [warnings, fi])

  // ---- frames ------------------------------------------------------------
  const addFrame = () => {
    const next = clone(play)
    const f = clone(frame)
    f.id = uid()
    f.note = ''
    f.arrows = []
    f.duration = 3
    next.frames.splice(fi + 1, 0, f)
    commit(next)
    setFrameIndex(fi + 1)
  }
  const deleteFrame = () => {
    if (play.frames.length < 2) return
    const next = clone(play)
    next.frames.splice(fi, 1)
    if (fi === 0) next.frames[0].duration = 0
    commit(next)
    setFrameIndex(Math.max(0, fi - 1))
  }
  const moveFrame = (dir: -1 | 1) => {
    const j = fi + dir
    if (j < 0 || j >= play.frames.length) return
    const next = clone(play)
    ;[next.frames[fi], next.frames[j]] = [next.frames[j], next.frames[fi]]
    commit(next)
    setFrameIndex(j)
  }

  // ---- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (playing) stopPlayback()
        else startPlayback()
        return
      }
      if (e.key === 'ArrowRight') setFrameIndex((i) => Math.min(play.frames.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setFrameIndex((i) => Math.max(0, i - 1))
      if (!editable || !selectedId || selectedId === 'puck') return
      const k = e.key.toLowerCase()
      if (k === 'u') toggleDepth(selectedId)
      if (k === 'q') editState(selectedId, { heading: frame.players[selectedId].heading - Math.PI / 12 })
      if (k === 'e') editState(selectedId, { heading: frame.players[selectedId].heading + Math.PI / 12 })
      if (k === 'l') editPlayer(selectedId, { stickHand: 'L' })
      if (k === 'r') editPlayer(selectedId, { stickHand: 'R' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- saving ------------------------------------------------------------
  const [library, setLibrary] = useState<Play[]>(() => loadLibrary())
  const [cloudPlays, setCloudPlays] = useState<Play[]>([])
  const limit = PLAN_LIMITS[account.plan]
  useEffect(() => {
    if (dialog === 'library' && cloudEnabled && account.plan === 'pro') listCloudPlays().then(setCloudPlays).catch(() => {})
  }, [dialog, account.plan])

  const save = async () => {
    const exists = library.some((p) => p.id === play.id)
    if (!exists && library.length >= limit.savedPlays) {
      flash(`The free plan keeps ${limit.savedPlays} plays. Upgrade for unlimited plays.`)
      setDialog('account')
      return
    }
    setLibrary(upsertLocal(play))
    if (cloudEnabled && account.plan === 'pro') {
      try {
        await saveCloudPlay(play)
        flash('Saved to your account')
      } catch (e) {
        flash(`Saved on this device. Cloud save failed: ${(e as Error).message}`)
      }
    } else flash('Saved on this device')
  }

  const openPlay = (p: Play) => {
    setPast((h) => [...h, play])
    setPlay(clone(p))
    setFrameIndex(0)
    setSelectedId(null)
    setDialog(null)
  }

  const importFile = (file: File) => {
    file.text().then((t) => {
      try {
        const p = JSON.parse(t)
        if (!isPlay(p)) throw new Error()
        p.id = uid()
        openPlay(p)
        flash('Play imported')
      } catch {
        flash('That file is not a play from this app.')
      }
    })
  }

  // ---- export ------------------------------------------------------------
  const [recording, setRecording] = useState<number | null>(null)
  const [videoFormat, setVideoFormat] = useState<'wide' | 'tall'>('wide')
  const [videoRate, setVideoRate] = useState(1)
  const exportVideo = async () => {
    if (play.frames.length < 2) {
      flash('Add at least two frames to make a video.')
      return
    }
    setRecording(0)
    try {
      const wide = videoFormat === 'wide'
      const { blob, ext } = await recordPlay(play, {
        ...prefs,
        orientation: wide ? 'landscape' : 'portrait',
        width: wide ? 1920 : 1080,
        height: wide ? 1080 : 1920,
        speed: videoRate,
        watermark: limit.watermark ? 'Made with UWH Tactics' : undefined,
        onProgress: setRecording,
      })
      downloadBlob(blob, `${safeName(play.name)}.${ext}`)
      flash('Video downloaded')
    } catch (e) {
      flash((e as Error).message)
    } finally {
      setRecording(null)
    }
  }
  const exportPng = async () => {
    const blob = await snapshotPng(play, previewing ? time! : times[fi], { ...prefs, watermark: limit.watermark ? 'Made with UWH Tactics' : undefined })
    downloadBlob(blob, `${safeName(play.name)}_frame${fi + 1}.png`)
  }

  const [link, setLink] = useState('')
  const makeLink = async () => {
    setDialog('share')
    setLink('')
    setLink(await shareUrl(play))
  }

  // ---- automations -------------------------------------------------------
  const runAuto = (kind: string) => {
    let next = play
    if (kind === 'start') next = startOfPlay(play)
    if (kind === 'rotate') next = breathRotation(play, fi, formTeam, 1)
    if (kind === 'timing') next = autoTiming(play)
    if (kind === 'mirror') next = mirrorPlay(play)
    commit(next)
    if (kind === 'start') setFrameIndex(0)
    flash(
      kind === 'start'
        ? 'Built the start of play. Press Play.'
        : kind === 'rotate'
          ? `Added a ${TEAM_LABEL[formTeam]} breathing rotation`
          : kind === 'timing'
            ? 'Frame times now match each player speed'
            : 'Mirrored left to right',
    )
  }

  const applyFormation = (id: string) => {
    const f = FORMATIONS.find((x) => x.id === id)!
    const next = clone(play)
    placeTeam(next.pool, next.players, next.frames[fi].players, formTeam, f)
    commit(next)
  }

  const setPool = (patch: Partial<Play['pool']>) => {
    const next = clone(play)
    const oldPool = next.pool
    next.pool = { ...next.pool, ...patch }
    // Keep players in the same relative spots when the pool changes size,
    // and move the sub benches if the side changed.
    for (const f of next.frames) {
      for (const p of next.players) {
        const s = f.players[p.id]
        if (s && inPool(oldPool, s)) {
          s.x = (s.x / oldPool.width) * next.pool.width
          s.y = (s.y / oldPool.length) * next.pool.length
        }
      }
      for (const team of ['white', 'black'] as TeamId[]) {
        const bench = next.players.filter((p) => p.team === team && f.players[p.id] && !inPool(oldPool, f.players[p.id]))
        placeBench(next.pool, bench, f.players, team)
      }
      f.puck.x = (f.puck.x / oldPool.width) * next.pool.width
      f.puck.y = (f.puck.y / oldPool.length) * next.pool.length
    }
    commit(next)
  }

  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }))

  // ---- render ------------------------------------------------------------
  const counts = { white: teamCountInPool(play, frame, 'white'), black: teamCountInPool(play, frame, 'black') }
  const need = requiredSeconds(play, fi)

  if (viewerMode) {
    return (
      <div className="viewer">
        <header className="topbar">
          <div className="brand">
            <Logo /> UWH Tactics
          </div>
          <div className="title-static">{play.name}</div>
          <div className="spacer" />
          <button
            className="primary"
            onClick={() => {
              const copy = { ...clone(play), id: uid() }
              history.replaceState(null, '', location.pathname)
              setViewerMode(false)
              setPlay(copy)
              flash('Opened in the editor. Save it to keep a copy.')
            }}
          >
            Open in editor
          </button>
        </header>
        <main className="viewer-main">
          <Board
            play={play}
            frameIndex={fi}
            snapshot={snapshot}
            next={null}
            editable={false}
            selectedId={null}
            tool="move"
            arrowColor={arrowColor}
            options={prefs}
            autoFace={false}
            warnIds={new Set()}
            onSelect={() => {}}
            onBegin={() => {}}
            onLive={() => {}}
            onEnd={() => {}}
            onToggleDepth={() => {}}
          />
        </main>
        <footer className="viewer-controls">
          <button onClick={() => { stopPlayback(); setFrameIndex(Math.max(0, fi - 1)) }}>◀ Back</button>
          {playing ? <button className="primary" onClick={stopPlayback}>❚❚ Pause</button> : <button className="primary" onClick={startPlayback}>▶ Play</button>}
          <button onClick={() => { stopPlayback(); setFrameIndex(Math.min(play.frames.length - 1, fi + 1)) }}>Next ▶</button>
          <span className="muted">
            Step {fi + 1} of {play.frames.length}
          </span>
          <div className="note-view">{(previewing ? snapshot.note : frame.note) || play.description}</div>
        </footer>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className={`app ${panelOpen ? 'panel-open' : ''} ${selectedId && selectedId !== 'puck' ? 'has-sel' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Logo /> <span className="hide-sm">UWH Tactics</span>
        </div>
        <input className="title" value={play.name} onChange={(e) => setPlay({ ...play, name: e.target.value })} aria-label="Play name" />
        <div className="spacer" />
        <button onClick={undo} disabled={!past.length} title="Undo (Ctrl Z)">↶</button>
        <button onClick={redo} disabled={!future.length} title="Redo (Ctrl Shift Z)">↷</button>
        <button onClick={() => setDialog('library')}>Library</button>
        <button className="primary" onClick={save}>Save</button>
        <button onClick={makeLink}>Share</button>
        <button onClick={() => setDialog('export')}>Export</button>
        <button onClick={() => setDialog('guide')} className="hide-sm">Guide</button>
        <button onClick={() => setDialog('account')} className="account-btn">
          {account.plan === 'pro' ? (cloudEnabled ? 'Pro' : 'Local') : 'Upgrade'}
        </button>
        <button className="show-sm" onClick={() => setPanelOpen((o) => !o)}>☰</button>
      </header>

      <aside className="sidebar">
        <section>
          <h4>Tools</h4>
          <div className="seg">
            <button className={tool === 'move' ? 'on' : ''} onClick={() => setTool('move')}>Move</button>
            <button className={tool === 'arrow' ? 'on' : ''} onClick={() => setTool('arrow')}>Arrow</button>
            <button className={tool === 'erase' ? 'on' : ''} onClick={() => setTool('erase')}>Erase</button>
          </div>
          {tool === 'arrow' && (
            <div className="swatches">
              {ARROW_COLORS.map((c) => (
                <button key={c} className={`swatch ${c === arrowColor ? 'on' : ''}`} style={{ background: c }} onClick={() => setArrowColor(c)} aria-label={`Arrow colour ${c}`} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h4>Teams in the water</h4>
          {(['white', 'black'] as TeamId[]).map((team) => (
            <div key={team} className="roster">
              <div className="roster-head">
                <span className={`dot ${team}`} /> {TEAM_LABEL[team]}
                <span className={`count ${counts[team] > 6 ? 'bad' : ''}`}>{counts[team]} / 6</span>
              </div>
              <div className="roster-list">
                {play.players
                  .filter((p) => p.team === team)
                  .map((p) => {
                    const s = frame.players[p.id]
                    const on = s && inPool(play.pool, s)
                    return (
                      <div key={p.id} className={`chip ${selectedId === p.id ? 'sel' : ''} ${on ? '' : 'bench'}`} onClick={() => setSelectedId(p.id)} title={`${p.role}${p.name ? ', ' + p.name : ''}`}>
                        <b>{p.number}</b>
                        {on ? (
                          <button
                            className={`mini ${s.depth === 'up' ? 'up' : 'down'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (editable) toggleDepth(p.id)
                            }}
                            title="Toggle up / down"
                          >
                            {s.depth === 'up' ? 'UP' : 'DN'}
                          </button>
                        ) : (
                          <span className="mini sub">SUB</span>
                        )}
                        <span className="hand">{p.stickHand}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </section>

        <section>
          <h4>Formations</h4>
          <div className="seg">
            <button className={formTeam === 'white' ? 'on' : ''} onClick={() => setFormTeam('white')}>White</button>
            <button className={formTeam === 'black' ? 'on' : ''} onClick={() => setFormTeam('black')}>Black</button>
          </div>
          <div className="list">
            {FORMATIONS.map((f) => (
              <button key={f.id} className="item" disabled={!editable} onClick={() => applyFormation(f.id)} title={f.description}>
                {f.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>Automations</h4>
          <div className="list">
            <button className="item" disabled={!editable} onClick={() => runAuto('start')} title="Replaces the frames with a full start of play sequence">
              ⚡ Start of play
            </button>
            <button className="item" disabled={!editable} onClick={() => runAuto('rotate')} title="Adds frames after this one where the selected team breathes in pairs">
              ⚡ Breathing rotation ({TEAM_LABEL[formTeam]})
            </button>
            <button className="item" disabled={!editable} onClick={() => runAuto('timing')} title="Times each frame by how fast each player can swim">
              ⚡ Auto timing by speed
            </button>
            <button className="item" disabled={!editable} onClick={() => runAuto('mirror')}>
              ⚡ Mirror left and right
            </button>
          </div>
        </section>

        <section>
          <h4>Display</h4>
          <div className="seg">
            {(['landscape', 'portrait'] as Orientation[]).map((o) => (
              <button key={o} className={prefs.orientation === o ? 'on' : ''} onClick={() => setPref('orientation', o)}>
                {o === 'landscape' ? 'Wide' : 'Tall'}
              </button>
            ))}
          </div>
          <div className="seg">
            {(['body', 'token'] as PlayerStyle[]).map((o) => (
              <button key={o} className={prefs.style === o ? 'on' : ''} onClick={() => setPref('style', o)}>
                {o === 'body' ? 'Swimmers' : 'Discs'}
              </button>
            ))}
          </div>
          <label>
            Player size {Math.round(prefs.sizeScale * 100)}%
            <input type="range" min={0.6} max={1.6} step={0.05} value={prefs.sizeScale} onChange={(e) => setPref('sizeScale', Number(e.target.value))} />
          </label>
          <label className="check"><input type="checkbox" checked={prefs.showPaths} onChange={(e) => setPref('showPaths', e.target.checked)} /> Show moves to next frame</label>
          <label className="check"><input type="checkbox" checked={prefs.showNames} onChange={(e) => setPref('showNames', e.target.checked)} /> Show names</label>
          <label className="check"><input type="checkbox" checked={prefs.showGrid} onChange={(e) => setPref('showGrid', e.target.checked)} /> 1 m grid</label>
          <label className="check"><input type="checkbox" checked={prefs.autoFace} onChange={(e) => setPref('autoFace', e.target.checked)} /> Face direction of travel</label>
          <button className="ghost full" onClick={() => setDialog('pool')}>Pool size and sub box</button>
        </section>
      </aside>

      <main className="stage">
        <Board
          play={play}
          frameIndex={fi}
          snapshot={snapshot}
          next={prefs.showPaths ? nextSnap : null}
          editable={editable}
          selectedId={selectedId}
          tool={tool}
          arrowColor={arrowColor}
          options={prefs}
          autoFace={prefs.autoFace}
          warnIds={frameWarnIds}
          onSelect={setSelectedId}
          onBegin={() => (gestureBase.current = playRef.current)}
          onLive={setPlay}
          onEnd={() => {
            const base = gestureBase.current
            gestureBase.current = null
            if (base && base !== playRef.current) {
              setPast((p) => [...p.slice(-60), base])
              setFuture([])
            }
          }}
          onToggleDepth={toggleDepth}
        />
      </main>

      <aside className="inspector">
        {selectedId && selectedId !== 'puck' ? (
          <PlayerPanel
            play={play}
            frameIndex={fi}
            selectedId={selectedId}
            editable={editable}
            onPlayer={editPlayer}
            onState={editState}
            onBench={benchPlayer}
            onField={fieldPlayer}
          />
        ) : (
          <div className="panel">
            <h3>Frame {fi + 1}</h3>
            <label>
              Coaching note for this step
              <textarea rows={3} value={frame.note} disabled={!editable} placeholder="What should happen in this step?" onChange={(e) => editFrame((f) => (f.note = e.target.value))} />
            </label>
            <label>
              Play description
              <textarea rows={3} value={play.description} placeholder="When to use this play" onChange={(e) => setPlay({ ...play, description: e.target.value })} />
            </label>
            <p className="muted small">
              Click a player to edit them. Double click or press U to send a player up or down. Drag the yellow handle to turn a player.
            </p>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="panel warnings">
            <h3>Reality check</h3>
            <ul>
              {warnings.slice(0, 8).map((w, i) => (
                <li key={i} onClick={() => { stopPlayback(); setFrameIndex(w.frameIndex); if (w.playerId) setSelectedId(w.playerId) }}>
                  <b>Frame {w.frameIndex + 1}</b> {w.message}
                </li>
              ))}
            </ul>
            {warnings.length > 8 && <p className="muted small">and {warnings.length - 8} more</p>}
          </div>
        )}
      </aside>

      <footer className="timeline">
        <div className="transport">
          {playing ? (
            <button className="primary" onClick={stopPlayback}>❚❚</button>
          ) : (
            <button className="primary" onClick={startPlayback} title="Play (Space)">▶</button>
          )}
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
          <input
            className="scrub"
            type="range"
            min={0}
            max={Math.max(0.01, total)}
            step={0.05}
            value={time ?? times[fi]}
            onChange={(e) => {
              setPlaying(false)
              setTime(Number(e.target.value))
            }}
            onPointerUp={stopPlayback}
            aria-label="Timeline"
          />
          <span className="clock">
            {(time ?? times[fi]).toFixed(1)} / {total.toFixed(1)} s
          </span>
        </div>
        <div className="frames">
          {play.frames.map((f, i) => (
            <button
              key={f.id}
              className={`frame ${i === fi && !previewing ? 'on' : ''} ${warnings.some((w) => w.frameIndex === i) ? 'warn' : ''}`}
              onClick={() => {
                stopPlayback()
                setFrameIndex(i)
              }}
              title={f.note}
            >
              <b>{i + 1}</b>
              <span>{i === 0 ? 'start' : `${f.duration.toFixed(1)} s`}</span>
            </button>
          ))}
          <button className="frame add" onClick={addFrame} disabled={!editable} title="Copy this frame and add it after">
            + Add frame
          </button>
        </div>
        <div className="frame-tools">
          {fi > 0 && (
            <label className="inline">
              Time to get here
              <input type="number" min={0.6} max={30} step={0.1} value={frame.duration} disabled={!editable} onChange={(e) => editFrame((f) => (f.duration = Math.max(0.6, Number(e.target.value) || 0.6)))} />
              s
              {need > frame.duration + 0.05 && (
                <button className="link" onClick={() => editFrame((f) => (f.duration = need))}>
                  needs {need} s, fix
                </button>
              )}
            </label>
          )}
          <button onClick={() => moveFrame(-1)} disabled={!editable || fi === 0}>◀ Move</button>
          <button onClick={() => moveFrame(1)} disabled={!editable || fi === play.frames.length - 1}>Move ▶</button>
          <button onClick={deleteFrame} disabled={!editable || play.frames.length < 2}>Delete frame</button>
          <button onClick={() => editFrame((f) => (f.arrows = []))} disabled={!editable || !frame.arrows.length}>Clear arrows</button>
        </div>
      </footer>

      {dialog === 'guide' && (
        <Dialog title="Underwater hockey guide" onClose={() => setDialog(null)} wide>
          <Guide />
        </Dialog>
      )}

      {dialog === 'pool' && (
        <Dialog title="Pool size and sub box" onClose={() => setDialog(null)}>
          <label>
            Length {play.pool.length} m
            <input type="range" min={15} max={30} step={0.5} value={play.pool.length} onChange={(e) => setPool({ length: Number(e.target.value) })} />
          </label>
          <label>
            Width {play.pool.width} m
            <input type="range" min={8} max={18} step={0.5} value={play.pool.width} onChange={(e) => setPool({ width: Number(e.target.value) })} />
          </label>
          <label>
            Depth {play.pool.depth} m
            <input type="range" min={1.5} max={4} step={0.1} value={play.pool.depth} onChange={(e) => setPool({ depth: Number(e.target.value) })} />
          </label>
          <div className="label">Sub box side (seen from the White goal)</div>
          <div className="seg">
            <button className={play.pool.subSide === 'left' ? 'on' : ''} onClick={() => setPool({ subSide: 'left' })}>Left</button>
            <button className={play.pool.subSide === 'right' ? 'on' : ''} onClick={() => setPool({ subSide: 'right' })}>Right</button>
          </div>
          <p className="muted small">Competition pools are 21 to 25 m long and 12 to 15 m wide, 2 to 3.65 m deep. Depth changes how long it takes to go up for air.</p>
          <div className="row">
            <button onClick={() => setPool({ length: 25, width: 12 })}>25 x 12</button>
            <button onClick={() => setPool({ length: 25, width: 15 })}>25 x 15</button>
            <button onClick={() => setPool({ length: 21, width: 12 })}>21 x 12</button>
          </div>
        </Dialog>
      )}

      {dialog === 'library' && (
        <Dialog title="Play library" onClose={() => setDialog(null)} wide>
          <div className="row">
            <button className="primary" onClick={() => openPlay(newPlay('New play'))}>New blank play</button>
            <button onClick={() => openPlay(startOfPlay(newPlay('Start of play')))}>New from start of play</button>
            <label className="button">
              Import file
              <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </label>
          </div>
          <h4>
            On this device ({library.length}
            {Number.isFinite(limit.savedPlays) ? ` of ${limit.savedPlays}` : ''})
          </h4>
          {library.length === 0 && <p className="muted">No saved plays yet. Press Save to keep the play you are working on.</p>}
          <ul className="plays">
            {library.map((p) => (
              <li key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <span className="muted small"> {p.frames.length} frames, updated {new Date(p.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="row">
                  <button onClick={() => openPlay(p)}>Open</button>
                  <button onClick={() => openPlay({ ...clone(p), id: uid(), name: p.name + ' copy' })}>Duplicate</button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) {
                        setLibrary(deleteLocal(p.id))
                        if (cloudEnabled && account.plan === 'pro') deleteCloudPlay(p.id).catch(() => {})
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {cloudEnabled && account.plan === 'pro' && (
            <>
              <h4>In your account ({cloudPlays.length})</h4>
              <ul className="plays">
                {cloudPlays.map((p) => (
                  <li key={p.id}>
                    <b>{p.name}</b>
                    <button onClick={() => openPlay(p)}>Open</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Dialog>
      )}

      {dialog === 'share' && (
        <Dialog title="Share this play" onClose={() => setDialog(null)}>
          <p>Anyone with this link can watch the play step by step and copy it into their own editor. Nothing is uploaded: the play is packed into the link itself.</p>
          <textarea readOnly rows={4} value={link || 'Building link...'} onFocus={(e) => e.target.select()} />
          <div className="row">
            <button
              className="primary"
              disabled={!link}
              onClick={() => {
                navigator.clipboard?.writeText(link).then(() => flash('Link copied'))
              }}
            >
              Copy link
            </button>
            {'share' in navigator && (
              <button disabled={!link} onClick={() => navigator.share({ title: play.name, url: link }).catch(() => {})}>
                Share...
              </button>
            )}
          </div>
        </Dialog>
      )}

      {dialog === 'export' && (
        <Dialog title="Export" onClose={() => setDialog(null)}>
          <h4>Video</h4>
          <p className="muted small">Records the animation in real time and downloads it as a video you can send in a team chat.</p>
          <div className="seg">
            <button className={videoFormat === 'wide' ? 'on' : ''} onClick={() => setVideoFormat('wide')}>Wide 1920 x 1080</button>
            <button className={videoFormat === 'tall' ? 'on' : ''} onClick={() => setVideoFormat('tall')}>Phone 1080 x 1920</button>
          </div>
          <div className="seg">
            {[0.5, 1, 2].map((r) => (
              <button key={r} className={videoRate === r ? 'on' : ''} onClick={() => setVideoRate(r)}>
                {r}x speed
              </button>
            ))}
          </div>
          <button className="primary full" onClick={exportVideo} disabled={recording !== null}>
            {recording !== null ? `Recording ${Math.round(recording * 100)}%` : 'Make video'}
          </button>
          {limit.watermark && <p className="muted small">Free plan videos carry a small watermark.</p>}
          <h4>Other</h4>
          <div className="row">
            <button onClick={exportPng}>Picture of this frame</button>
            <button onClick={() => exportJson(play)}>Play file (.json)</button>
          </div>
        </Dialog>
      )}

      {dialog === 'account' && (
        <Dialog title="Account and plan" onClose={() => setDialog(null)}>
          <AccountBox account={account} onChange={refreshAccount} flash={flash} />
        </Dialog>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function AccountBox({ account, onChange, flash }: { account: Account; onChange: () => void; flash: (m: string) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const plans = (
    <div className="plans">
      <div className="plan">
        <h4>Free</h4>
        <div className="price">$0</div>
        <ul>
          <li>Full tactics board and animation</li>
          <li>3 saved plays on one device</li>
          <li>Share links</li>
          <li>Videos with a watermark</li>
        </ul>
      </div>
      <div className="plan pro">
        <h4>Coach</h4>
        <div className="price">{PRICE_TEXT}</div>
        <ul>
          <li>Unlimited plays</li>
          <li>Saved to your account on every device</li>
          <li>Clean HD videos for the team chat</li>
          <li>Cancel any time</li>
        </ul>
      </div>
    </div>
  )
  if (!cloudEnabled) {
    return (
      <div>
        <p>
          <b>Local mode.</b> This copy is not connected to an account server, so everything is unlocked and saved in this browser.
        </p>
        <p className="muted small">The site owner turns on accounts and the {PRICE_TEXT} plan by adding Supabase and Stripe keys. See the README.</p>
        {plans}
      </div>
    )
  }
  if (!account.session) {
    return (
      <div>
        {plans}
        <h4>Sign in or create an account</h4>
        {sent ? (
          <p>Check {email} for a sign in link.</p>
        ) : (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              signInWithEmail(email).then(() => setSent(true), (err) => flash(err.message))
            }}
          >
            <input type="email" required placeholder="you@club.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="primary" type="submit">Email me a link</button>
          </form>
        )}
      </div>
    )
  }
  return (
    <div>
      <p>
        Signed in as <b>{account.email}</b>. Plan: <b>{account.plan === 'pro' ? 'Coach' : 'Free'}</b>
      </p>
      {account.plan === 'pro' ? (
        <button onClick={() => openBillingPortal().catch((e) => flash(e.message))}>Manage subscription</button>
      ) : (
        <>
          {plans}
          <button className="primary full" onClick={() => startCheckout().catch((e) => flash(e.message))}>
            Upgrade for {PRICE_TEXT}
          </button>
        </>
      )}
      <button className="ghost full" onClick={() => signOut().then(onChange)}>Sign out</button>
    </div>
  )
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="5" width="28" height="22" rx="4" fill="#1d78b5" />
      <line x1="16" y1="5" x2="16" y2="27" stroke="#fff" strokeOpacity=".6" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="3.2" fill="#f97316" />
      <rect x="4" y="13" width="2" height="6" fill="#cbd5e1" />
      <rect x="26" y="13" width="2" height="6" fill="#cbd5e1" />
    </svg>
  )
}
