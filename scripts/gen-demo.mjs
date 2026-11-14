/**
 * Synthesises the built-in BASSX demo track ("Sub Zero") as a 16-bit stereo
 * WAV. This gives the app a real, bass-heavy source to process and visualize
 * without requiring the user to import a file first.
 *
 * Run: npm run demo
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public', 'demo')
mkdirSync(outDir, { recursive: true })

const SR = 44100
const BPM = 120
const BEAT = 60 / BPM
const BARS = 12
const BEATS = BARS * 4
const DURATION = BEATS * BEAT
const N = Math.round(SR * DURATION)
const left = new Float32Array(N)
const right = new Float32Array(N)

let seed = 0x1234567
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0x100000000
}
const noise = () => rand() * 2 - 1
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const soft = (x) => Math.tanh(x)

const add = (t, duration, fn, pan = 0, gain = 1) => {
  const start = Math.floor(t * SR)
  const len = Math.floor(duration * SR)
  const lGain = gain * Math.cos(((pan + 1) / 2) * (Math.PI / 2))
  const rGain = gain * Math.sin(((pan + 1) / 2) * (Math.PI / 2))
  for (let i = 0; i < len; i++) {
    const idx = start + i
    if (idx < 0 || idx >= N) continue
    const time = i / SR
    const s = fn(time, i)
    left[idx] += s * lGain
    right[idx] += s * rGain
  }
}

// ------------------------------------------------------------------- kick
function kick(t, gain = 1) {
  add(
    t,
    0.55,
    (time) => {
      const env = Math.exp(-time * 8.5)
      const freq = 44 + 105 * Math.exp(-time * 34)
      const body = Math.sin(2 * Math.PI * freq * time) * env
      const click = noise() * Math.exp(-time * 220) * 0.16
      return soft((body + click) * 2.1) * gain
    },
    0,
    0.92,
  )
}

// -------------------------------------------------------------------- 808
function eightOhEight(t, freq, length = 0.82, gain = 1) {
  add(
    t,
    length,
    (time) => {
      const attack = Math.min(1, time / 0.012)
      const env = attack * Math.exp(-time * 2.2) * (1 - Math.max(0, time - length + 0.03) / 0.03)
      const glide = 1 + 0.035 * Math.exp(-time * 9)
      const tone =
        Math.sin(2 * Math.PI * freq * glide * time) +
        0.28 * Math.sin(4 * Math.PI * freq * time) +
        0.1 * Math.sin(6 * Math.PI * freq * time)
      return soft(tone * 1.7) * env * gain
    },
    0,
    0.62,
  )
}

// -------------------------------------------------------------------- hats
function hat(t, open = false, gain = 1, pan = 0.18) {
  const decay = open ? 16 : 95
  let prev = 0
  add(
    t,
    open ? 0.32 : 0.09,
    (time) => {
      const n = noise()
      const hp = n - prev
      prev = n
      return hp * Math.exp(-time * decay) * 0.5
    },
    pan,
    gain,
  )
}

// ------------------------------------------------------------------- snare
function clap(t, gain = 1) {
  let prev = 0
  add(
    t,
    0.26,
    (time) => {
      const n = noise()
      const bp = n - prev * 0.55
      prev = n
      const burst =
        Math.exp(-time * 38) * 0.7 +
        (time > 0.012 ? Math.exp(-(time - 0.012) * 55) * 0.4 : 0) +
        (time > 0.026 ? Math.exp(-(time - 0.026) * 70) * 0.3 : 0)
      const tone = Math.sin(2 * Math.PI * 190 * time) * Math.exp(-time * 24) * 0.35
      return (bp * burst + tone) * gain
    },
    0.02,
    0.34,
  )
}

// --------------------------------------------------------------------- pad
const CHORDS = [
  [82.41, 98.0, 123.47, 164.81],
  [65.41, 98.0, 130.81, 164.81],
  [110.0, 130.81, 164.81, 196.0],
  [123.47, 155.56, 185.0, 220.0],
  [82.41, 98.0, 123.47, 164.81],
  [65.41, 98.0, 130.81, 164.81],
]
const ROOTS = [41.2, 65.41, 55.0, 61.74, 41.2, 65.41]

function pad(startBeat, bars, chord, gain = 0.19) {
  const t = startBeat * BEAT
  const dur = bars * 4 * BEAT
  const fade = 0.9
  add(
    t,
    dur,
    (time) => {
      let s = 0
      chord.forEach((freq, voice) => {
        for (let d = 0; d < 2; d++) {
          const detune = d === 0 ? 1 + voice * 0.0007 : 1 - voice * 0.0009
          const phase = voice * 0.9 + d * 2.1
          s +=
            (Math.sin(2 * Math.PI * freq * detune * time + phase) * 0.45 +
              Math.sin(2 * Math.PI * freq * 2 * detune * time + phase) * 0.16 +
              Math.sin(2 * Math.PI * freq * 3 * time + phase) * 0.07) *
            0.5
        }
      })
      const attack = Math.min(1, time / fade)
      const release = Math.min(1, (dur - time) / fade)
      const env = Math.max(0, Math.min(attack, release))
      const trem = 0.86 + 0.14 * Math.sin(2 * Math.PI * 0.23 * time)
      return (s / chord.length) * env * trem
    },
    0,
    gain,
  )
}

// ----------------------------------------------------------------- sequence
const chordIndex = (bar) => Math.min(5, Math.floor(bar / 2))

// Intro pad + drone.
for (let seg = 0; seg < 6; seg++) {
  pad(seg * 8, 2, CHORDS[seg], 0.2)
}

// Sub drone under everything.
add(
  0,
  DURATION,
  (time) => {
    const env =
      Math.min(1, time / 1.2) * Math.min(1, (DURATION - time) / 1.4)
    return (
      Math.sin(2 * Math.PI * 41.2 * time) * 0.11 +
      Math.sin(2 * Math.PI * 82.4 * time) * 0.025
    ) * env
  },
  0,
  0.9,
)

// Kick, clap, hats and bass.
for (let bar = 0; bar < BARS; bar++) {
  const barStart = bar * 4
  const isIntro = bar === 0
  const isOutro = bar === BARS - 1

  if (!isIntro) {
    for (let beatInBar = 0; beatInBar < 4; beatInBar++) {
      kick((barStart + beatInBar) * BEAT, beatInBar === 0 ? 1 : 0.86)
    }
  } else {
    kick(2 * BEAT, 0.6)
  }

  if (!isIntro && !isOutro) {
    clap((barStart + 1) * BEAT, 1)
    clap((barStart + 3) * BEAT, 0.92)
  }

  const sixteenths = bar >= 3 && bar <= 9
  const steps = sixteenths ? 16 : 8
  for (let step = 0; step < steps; step++) {
    const beatPos = (step / steps) * 4
    const t = (barStart + beatPos) * BEAT
    const accent = step % (sixteenths ? 4 : 2) === 0 ? 1 : 0.55
    const open = beatPos === 3.5 && bar % 2 === 1
    if (bar > 0) hat(t, open, 0.5 * accent * (open ? 1.3 : 1), ((step % 4) - 1.5) * 0.28)
  }

  if (!isIntro) {
    const root = ROOTS[chordIndex(bar)]
    const pattern = bar % 2 === 0 ? [0.5, 1.75, 3.0] : [0.75, 1.5, 2.75]
    pattern.forEach((beatPos, i) => {
      const octave = i === 2 ? 1.5 : 1
      eightOhEight(
        (barStart + beatPos) * BEAT,
        root * octave,
        i === 2 ? 0.55 : 0.72,
        i === 0 ? 1 : 0.85,
      )
    })
  }
}

// Crash / impact at the first full drop.
let prev = 0
add(
  8 * BEAT,
  1.4,
  (time) => {
    const n = noise()
    const hp = n - prev * 0.92
    prev = n
    return hp * Math.exp(-time * 5.5) * 0.4
  },
  0,
  0.6,
)

// Sidechain-style pump on the pad + gentle wow on the whole mix is skipped;
// apply a simple beat-synced amplitude dip to mimic compression.
for (let i = 0; i < N; i++) {
  const t = i / SR
  const phase = t % BEAT
  const duck = 1 - 0.18 * Math.exp(-phase * 22)
  left[i] *= duck
  right[i] *= duck
}

// Vinyl noise floor.
for (let i = 0; i < N; i++) {
  left[i] += noise() * 0.0007
  right[i] += noise() * 0.0007
}

// Master soft clip + normalize.
let peak = 0
for (let i = 0; i < N; i++) {
  left[i] = soft(left[i] * 1.05)
  right[i] = soft(right[i] * 1.05)
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
}
const norm = 0.89 / (peak || 1)
const fadeIn = 0.04 * SR
const fadeOut = 0.5 * SR
for (let i = 0; i < N; i++) {
  let g = 1
  if (i < fadeIn) g *= i / fadeIn
  if (i > N - fadeOut) g *= Math.max(0, (N - i) / fadeOut)
  left[i] *= norm * g
  right[i] *= norm * g
}

// ------------------------------------------------------------------ WAV out
const bytes = 44 + N * 4
const buf = Buffer.alloc(bytes)
buf.write('RIFF', 0)
buf.writeUInt32LE(bytes - 8, 4)
buf.write('WAVE', 8)
buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(N * 4, 40)

for (let i = 0; i < N; i++) {
  const l = Math.round(clamp(left[i], -1, 1) * 32767)
  const r = Math.round(clamp(right[i], -1, 1) * 32767)
  buf.writeInt16LE(l, 44 + i * 4)
  buf.writeInt16LE(r, 46 + i * 4)
}

const file = resolve(outDir, 'bassx-demo.wav')
writeFileSync(file, buf)
console.log(
  `Built ${file} — ${DURATION.toFixed(1)}s, ${(bytes / 1024 / 1024).toFixed(1)} MB`,
)
