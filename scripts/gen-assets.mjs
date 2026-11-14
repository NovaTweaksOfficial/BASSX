/**
 * Generates BASSX app icons, maskable icons, Apple touch icon and iOS splash
 * screens with no external image dependencies. Run: npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public')
mkdirSync(resolve(outDir, 'icons'), { recursive: true })
mkdirSync(resolve(outDir, 'splash'), { recursive: true })

// ---------------------------------------------------------------- PNG writer
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  typeBuf.copy(out, 4)
  data.copy(out, 8)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  crcBuf.copy(out, 8 + data.length)
  return out
}
function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    )
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------ helpers
const clamp01 = (n) => Math.min(1, Math.max(0, n))
const mix = (a, b, t) => a + (b - a) * t
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}
function sdRoundedBox(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius)
  const qy = Math.abs(py - cy) - (halfH - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}
function over(dst, i, r, g, b, a) {
  if (a <= 0) return
  const inv = 1 - a
  dst[i] = clamp01(dst[i] * inv + r * a)
  dst[i + 1] = clamp01(dst[i + 1] * inv + g * a)
  dst[i + 2] = clamp01(dst[i + 2] * inv + b * a)
  dst[i + 3] = clamp01(dst[i + 3] + a)
}

/**
 * Draws the BASSX mark: a glowing five-bar spectrum inside a rounded tile,
 * with a fine orbital ring and vertical reflection.
 */
function renderMark(size, { maskable = false, splash = false } = {}) {
  const w = size
  const h = size
  const data = new Float32Array(w * h * 4)
  const cx = w / 2
  const cy = h * (splash ? 0.5 : 0.52)
  const tileRadius = w * 0.225
  const padding = maskable ? 0 : 0

  // Base fill: pure black with violet bloom.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const nx = (x - w / 2) / w
      const ny = (y - h / 2) / h
      const d = Math.hypot(nx, ny)
      let r = 0.018
      let g = 0.014
      let b = 0.03
      const bloom = Math.exp(-d * d * 5.5)
      r += bloom * 0.16
      g += bloom * 0.045
      b += bloom * 0.28
      const vignette = 1 - smoothstep(0.38, 0.72, d) * 0.45
      r *= vignette
      g *= vignette
      b *= vignette
      // subtle top-left rim light
      const rim = Math.exp(-Math.hypot(nx + 0.3, ny + 0.35) * 9) * 0.06
      r += rim
      g += rim * 0.7
      b += rim * 1.4
      data[i] = clamp01(r)
      data[i + 1] = clamp01(g)
      data[i + 2] = clamp01(b)
      data[i + 3] = 1
    }
  }

  // Rounded tile alpha mask (maskable icons stay full-bleed).
  if (!maskable) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const sd = sdRoundedBox(x, y, cx, cy, w / 2 - padding, h / 2 - padding, tileRadius)
        data[i + 3] = 1 - smoothstep(-1.2, 1.2, sd)
      }
    }
  }

  const scale = splash ? 1 : 1
  const barCount = 5
  const barW = w * 0.072 * scale
  const gap = w * 0.052 * scale
  const totalW = barCount * barW + (barCount - 1) * gap
  const heights = [0.17, 0.3, 0.44, 0.3, 0.17].map((v) => v * h * scale)
  const baseline = cy + h * 0.015 * scale
  const colors = [
    [0.72, 0.5, 1.0],
    [0.62, 0.32, 1.0],
    [0.22, 0.9, 0.95],
    [0.62, 0.32, 1.0],
    [0.72, 0.5, 1.0],
  ]

  // Orbital ring
  const ringR = w * 0.315
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      const ring = Math.exp(-Math.pow((dist - ringR) / (w * 0.0018), 2))
      const fade = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(angle * 1.0 + 1.2))
      const a = ring * fade * 0.5
      const t = 0.5 + 0.5 * Math.sin(angle * 2 + 0.5)
      over(data, i, mix(0.62, 0.16, t), mix(0.3, 0.8, t), 1, a)
    }
  }

  // Bars with glow + reflection
  for (let b = 0; b < barCount; b++) {
    const bh = heights[b]
    const bx = cx - totalW / 2 + b * (barW + gap)
    const bcy = baseline - bh / 2
    const halfW = barW / 2
    const halfH = bh / 2
    const color = colors[b]
    const glowRadius = w * 0.055

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const sd = sdRoundedBox(x, y, bx + halfW, bcy, halfW, halfH, barW / 2)
        const glow = Math.exp(-Math.max(0, sd) / glowRadius) * 0.5
        if (glow > 0.002) over(data, i, color[0], color[1], color[2], glow * 0.55)
        const core = 1 - smoothstep(-0.8, 0.8, sd)
        if (core > 0.001) {
          const shimmer = 0.82 + 0.18 * Math.sin(y * 0.05 + b)
          over(data, i, color[0] * shimmer, color[1] * shimmer, color[2] * shimmer, core)
        }
        // reflection
        const rsd = sdRoundedBox(
          x,
          y,
          bx + halfW,
          baseline + h * 0.055 + bh * 0.35,
          halfW * 0.9,
          bh * 0.32,
          barW / 2,
        )
        const rCore = (1 - smoothstep(-0.8, 0.8, rsd)) * 0.18 * (1 - y / h)
        if (rCore > 0.001) over(data, i, color[0], color[1], color[2], rCore)
      }
    }
  }

  // Bottom accent line
  const lineY = baseline + h * 0.115
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const line = Math.exp(-Math.pow((y - lineY) / (w * 0.0016), 2))
      const span = 1 - smoothstep(0.12, 0.3, Math.abs(x / w - 0.5))
      const a = line * span * 0.35
      if (a > 0.001) over(data, i, 0.7, 0.45, 1, a)
    }
  }

  // Film grain
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const n = (hash(x * 0.73, y * 1.27) - 0.5) * 0.018 * data[i + 3]
      data[i] = clamp01(data[i] + n)
      data[i + 1] = clamp01(data[i + 1] + n)
      data[i + 2] = clamp01(data[i + 2] + n)
    }
  }

  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < data.length; i++) rgba[i] = Math.round(clamp01(data[i]) * 255)
  return encodePng(w, h, rgba)
}

function write(name, buffer) {
  writeFileSync(resolve(outDir, name), buffer)
  console.log(`  ✓ ${name}`)
}

console.log('Generating BASSX icons…')
write('icons/icon-192.png', renderMark(192))
write('icons/icon-512.png', renderMark(512))
write('icons/maskable-512.png', renderMark(512, { maskable: true }))
write('apple-touch-icon.png', renderMark(180, { maskable: true }))
write('icons/icon-1024.png', renderMark(1024))

console.log('Generating iOS splash screens…')
const splashes = [
  [1170, 2532],
  [1290, 2796],
  [1536, 2048],
]
for (const [w, h] of splashes) {
  const mark = renderMark(w, { splash: true, maskable: true })
  // The mark renderer is square; crop the centered square into a portrait canvas.
  // Simpler: render the square at width and letterbox with matching black.
  const square = decodePngToRgba(mark)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const mx = x
      const my = y - Math.floor((h - w) / 2)
      if (my >= 0 && my < w) {
        const si = (my * w + mx) * 4
        data[i] = square[si]
        data[i + 1] = square[si + 1]
        data[i + 2] = square[si + 2]
        data[i + 3] = 255
      } else {
        data[i] = 5
        data[i + 1] = 4
        data[i + 2] = 8
        data[i + 3] = 255
      }
    }
  }
  write(`splash/splash-${w}x${h}.png`, encodePng(w, h, data))
}

// The mark renderer returns PNG bytes; this little helper reverses the IDAT for
// the splash letterboxing step.
import { inflateSync } from 'node:zlib'
function decodePngToRgba(png) {
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const rgba = new Uint8Array(width * height * 4)
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    raw.copy(rgba, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
  }
  return rgba
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c084fc"/><stop offset=".55" stop-color="#a855f7"/><stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="bg" cx=".5" cy=".45" r=".75">
      <stop offset="0" stop-color="#1d1030"/><stop offset="1" stop-color="#050507"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bg)"/>
  <g fill="url(#g)">
    <rect x="16" y="28" width="5" height="12" rx="2.5"/>
    <rect x="24" y="21" width="5" height="26" rx="2.5"/>
    <rect x="32" y="14" width="5" height="40" rx="2.5"/>
    <rect x="40" y="21" width="5" height="26" rx="2.5"/>
    <rect x="48" y="28" width="5" height="12" rx="2.5"/>
  </g>
</svg>`
writeFileSync(resolve(outDir, 'favicon.svg'), favicon)
console.log('  ✓ favicon.svg')
console.log('Done.')
