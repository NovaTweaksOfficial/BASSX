/**
 * Minimal, dependency-free ID3v2 reader for local files.
 * Extracts title / artist / album / year and embedded artwork so the player
 * can show real metadata without shipping a media parsing library.
 */

export type TrackMeta = {
  title?: string
  artist?: string
  album?: string
  year?: string
  artworkUrl?: string
}

const TEXT_FRAMES: Record<string, keyof TrackMeta> = {
  TIT2: 'title',
  TPE1: 'artist',
  TALB: 'album',
  TDRC: 'year',
  TYER: 'year',
}

export async function readTrackMetadata(file: File): Promise<TrackMeta> {
  try {
    const slice = file.slice(0, Math.min(file.size, 1_500_000))
    const buffer = await slice.arrayBuffer()
    return parseId3(new DataView(buffer))
  } catch {
    return {}
  }
}

function parseId3(view: DataView): TrackMeta {
  const meta: TrackMeta = {}
  if (view.byteLength < 10) return meta
  if (readAscii(view, 0, 3) !== 'ID3') return meta

  const major = view.getUint8(3)
  if (major < 2 || major > 4) return meta

  const tagSize = readSynchsafe(view, 6)
  const end = Math.min(view.byteLength, 10 + tagSize)
  let offset = 10
  const flags = view.getUint8(5)

  if (major >= 3 && (flags & 0x40) !== 0) {
    // Skip extended header (size includes itself in v2.3).
    const extSize =
      major === 4 ? readSynchsafe(view, offset) : view.getUint32(offset)
    offset += Math.max(extSize, 6)
  }

  while (offset + 10 <= end) {
    const id = readAscii(view, offset, 4)
    if (!/^[A-Z0-9]{4}$/.test(id)) break

    const size =
      major === 4
        ? readSynchsafe(view, offset + 4)
        : view.getUint32(offset + 4)
    const frameStart = offset + 10
    const frameEnd = Math.min(frameStart + size, end)
    if (size <= 0 || frameStart >= end) break

    if (id === 'APIC' && !meta.artworkUrl) {
      const art = parseApic(view, frameStart, frameEnd)
      if (art) meta.artworkUrl = art
    } else if (TEXT_FRAMES[id]) {
      const text = decodeTextFrame(view, frameStart, frameEnd)
      if (text) meta[TEXT_FRAMES[id]] = text
    }

    offset = frameEnd
    if (major === 3 && (view.getUint8(offset - 1) === 0 || size === 0)) {
      // Some v2.3 writers include padding; stop at padded zeroes.
    }
  }

  return meta
}

function parseApic(view: DataView, start: number, end: number): string | undefined {
  if (start >= end) return undefined
  const encoding = view.getUint8(start)
  let cursor = start + 1

  // MIME type — always Latin-1, null terminated.
  let mime = ''
  while (cursor < end && view.getUint8(cursor) !== 0) {
    mime += String.fromCharCode(view.getUint8(cursor))
    cursor++
  }
  cursor++
  if (cursor >= end) return undefined

  // Picture type.
  cursor++
  // Description — terminated by 1 or 2 zero bytes depending on encoding.
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < end) {
      if (view.getUint8(cursor) === 0 && view.getUint8(cursor + 1) === 0) {
        cursor += 2
        break
      }
      cursor += 2
    }
  } else {
    while (cursor < end && view.getUint8(cursor) !== 0) cursor++
    cursor++
  }

  if (cursor >= end) return undefined
  const bytes = new Uint8Array(view.buffer, view.byteOffset + cursor, end - cursor)
  if (bytes.byteLength < 32) return undefined
  const type = mime && mime !== '-->' ? mime : detectImageMime(bytes)
  if (!type) return undefined
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return URL.createObjectURL(new Blob([copy], { type }))
}

function detectImageMime(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'
  return undefined
}

function decodeTextFrame(view: DataView, start: number, end: number): string {
  if (start >= end) return ''
  const encoding = view.getUint8(start)
  const bytes = new Uint8Array(
    view.buffer,
    view.byteOffset + start + 1,
    Math.max(0, end - start - 1),
  )
  let text = ''
  try {
    if (encoding === 0) {
      text = new TextDecoder('iso-8859-1').decode(bytes)
    } else if (encoding === 1) {
      text = new TextDecoder('utf-16').decode(bytes)
    } else if (encoding === 2) {
      text = new TextDecoder('utf-16be').decode(bytes)
    } else {
      text = new TextDecoder('utf-8').decode(bytes)
    }
  } catch {
    text = new TextDecoder().decode(bytes)
  }
  return text.replace(/\u0000+$/g, '').replace(/\u0000/g, ' ').trim()
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    if (offset + i >= view.byteLength) break
    out += String.fromCharCode(view.getUint8(offset + i))
  }
  return out
}

function readSynchsafe(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  )
}
