import { Play } from './model'
import { snapshotAt, totalDuration } from './animation'
import { ViewOptions, drawScene, makeView } from './render'

export function pickVideoType() {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const t of types) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  return ''
}

export interface VideoOptions extends ViewOptions {
  speed: number
  width: number
  height: number
  onProgress?: (fraction: number) => void
}

/** Records the play as a video in real time and returns the file. */
export async function recordPlay(play: Play, opts: VideoOptions): Promise<{ blob: Blob; ext: string }> {
  const type = pickVideoType()
  if (!type) throw new Error('This browser cannot record video. Try Chrome, Edge or Safari.')
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')!
  const view = makeView(play.pool, opts.orientation, canvas.width, canvas.height, 24)
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()))

  const total = totalDuration(play)
  const hold = 1.0
  const length = hold + total / opts.speed + hold * 1.5

  const draw = (t: number) => {
    const snap = snapshotAt(play, t)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawScene(ctx, view, play, snap, {
      ...opts,
      showPaths: false,
      selectedId: null,
      caption: snap.note || play.name,
    })
  }

  draw(0)
  rec.start(250)
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000
      const t = Math.min(total, Math.max(0, (elapsed - hold) * opts.speed))
      draw(t)
      opts.onProgress?.(Math.min(1, elapsed / length))
      if (elapsed < length) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  rec.stop()
  await done
  stream.getTracks().forEach((t) => t.stop())
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.includes('mp4') ? 'mp4' : 'webm' }
}

export function snapshotPng(play: Play, t: number, opts: ViewOptions, width = 1600, height = 900): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const view = makeView(play.pool, opts.orientation, width, height, 24)
  const snap = snapshotAt(play, t)
  drawScene(ctx, view, play, snap, { ...opts, selectedId: null, showPaths: false, caption: snap.note || play.name })
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}
