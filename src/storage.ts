import { Play } from './model'

const KEY = 'uwh.library.v1'

export function loadLibrary(): Play[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Play[]) : []
  } catch {
    return []
  }
}

export function saveLibrary(plays: Play[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plays))
  } catch {
    // Storage full or blocked; the play still lives in memory.
  }
}

export function upsertLocal(play: Play): Play[] {
  const lib = loadLibrary()
  const i = lib.findIndex((p) => p.id === play.id)
  const saved = { ...play, updatedAt: Date.now() }
  if (i >= 0) lib[i] = saved
  else lib.unshift(saved)
  saveLibrary(lib)
  return lib
}

export function deleteLocal(id: string): Play[] {
  const lib = loadLibrary().filter((p) => p.id !== id)
  saveLibrary(lib)
  return lib
}

// ---------------------------------------------------------------------------
// Share links: the whole play is compressed into the URL, so no server is needed.
// ---------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '.').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string) {
  const b = atob(text.replace(/\./g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

export async function encodePlay(play: Play) {
  const json = new TextEncoder().encode(JSON.stringify(play))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

export async function decodePlay(code: string): Promise<Play> {
  const bytes = await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw'))
  return JSON.parse(new TextDecoder().decode(bytes)) as Play
}

export async function shareUrl(play: Play) {
  const code = await encodePlay(play)
  return `${location.origin}${location.pathname}#view=${code}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeName(name: string) {
  return (name || 'play').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'play'
}

export function exportJson(play: Play) {
  downloadBlob(new Blob([JSON.stringify(play, null, 2)], { type: 'application/json' }), `${safeName(play.name)}.uwh.json`)
}

export function isPlay(v: unknown): v is Play {
  const p = v as Play
  return !!p && typeof p === 'object' && Array.isArray(p.players) && Array.isArray(p.frames) && !!p.pool
}
