import { useEffect, useRef } from 'react'
import { useEngine } from '../audio/EngineProvider'
import type { ThemeAccent, VisualizerStyle } from '../audio/types'
import { useApp } from '../state/AppProvider'

type Palette = { main: string; bright: string; cyan: string; rgb: string }

const PALETTES: Record<ThemeAccent, Palette> = {
  violet: { main: '#a855f7', bright: '#e9d5ff', cyan: '#22d3ee', rgb: '168,85,247' },
  cyan: { main: '#22d3ee', bright: '#cffafe', cyan: '#a78bfa', rgb: '34,211,238' },
  magenta: { main: '#ec4899', bright: '#fce7f3', cyan: '#22d3ee', rgb: '236,72,153' },
  lime: { main: '#a3e635', bright: '#ecfccb', cyan: '#22d3ee', rgb: '163,230,53' },
}

type Props = {
  style?: VisualizerStyle
  height?: number
  bars?: number
  className?: string
  showGrid?: boolean
}

export function SpectrumCanvas({
  style,
  height = 190,
  bars,
  className = '',
  showGrid = true,
}: Props) {
  const { engine } = useEngine()
  const { settings } = useApp()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mode = style ?? settings.visualizer
  const accent = settings.accent
  const reduced = settings.reduceMotion
  const smoothing = settings.smoothing

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const palette = PALETTES[accent]
    let width = canvas.clientWidth || 600
    let heightPx = canvas.clientHeight || height
    let dpr = Math.min(2.5, window.devicePixelRatio || 1)
    let raf = 0
    let lastFrame = 0
    const freq = new Uint8Array(engine.getFrequencyBinCount())
    const wave = new Uint8Array(2048)
    const barCount = Math.max(18, Math.min(bars ?? Math.floor(width / 9), 84))
    const levels = new Float32Array(barCount)
    const peaks = new Float32Array(barCount)
    let bassEnergy = 0

    const idleLevel = (index: number): number => {
      const t = performance.now() * 0.001
      const a = 0.5 + 0.5 * Math.sin(index * 0.52 + t * 1.4)
      const b = 0.5 + 0.5 * Math.sin(index * 0.17 - t * 0.8)
      return 0.12 + a * b * 0.24
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      heightPx = Math.max(1, rect.height)
      dpr = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(heightPx * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const sampleFrequency = (ratio: number): number => {
      // Logarithmic mapping from 20 Hz to ~16 kHz across the analyser bins.
      const minBin = 1
      const maxBin = Math.min(freq.length - 1, Math.floor(freq.length * 0.72))
      const t = Math.pow(ratio, 1.55)
      const bin = Math.floor(minBin + t * (maxBin - minBin))
      let sum = 0
      let count = 0
      for (let i = Math.max(0, bin - 1); i <= Math.min(freq.length - 1, bin + 1); i++) {
        sum += freq[i]
        count++
      }
      return count ? sum / count / 255 : 0
    }

    const drawRoundedBar = (
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number,
      topOnly = false,
    ) => {
      const r = Math.min(radius, w / 2, h)
      ctx.beginPath()
      if (topOnly) {
        ctx.moveTo(x, y + h)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h)
        ctx.closePath()
      } else if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r)
      } else {
        ctx.rect(x, y, w, h)
      }
    }

    const drawSpectrum = (active: boolean) => {
      const bottom = heightPx - 12
      const top = 10
      const gap = Math.max(2, width * 0.006)
      const barW = Math.max(1.5, (width - gap * (barCount - 1)) / barCount)
      const gradient = ctx.createLinearGradient(0, bottom, 0, top)
      gradient.addColorStop(0, `rgba(${palette.rgb},0.5)`)
      gradient.addColorStop(0.5, palette.main)
      gradient.addColorStop(1, palette.bright)

      if (showGrid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.045)'
        ctx.lineWidth = 1
        for (let i = 1; i <= 3; i++) {
          const y = top + ((bottom - top) / 4) * i
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(width, y)
          ctx.stroke()
        }
      }

      // soft floor glow
      const floor = ctx.createLinearGradient(0, bottom - 16, 0, bottom + 12)
      floor.addColorStop(0, `rgba(${palette.rgb},0.16)`)
      floor.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = floor
      ctx.fillRect(0, bottom - 16, width, 28)

      for (let i = 0; i < barCount; i++) {
        const level = active ? levels[i] : idleLevel(i)
        const barH = Math.max(2, Math.pow(level, 1.25) * (bottom - top))
        const x = i * (barW + gap)
        const y = bottom - barH

        if (!active) {
          ctx.globalAlpha = 0.28 + 0.1 * Math.sin(i * 0.5 + performance.now() * 0.001)
        } else {
          ctx.globalAlpha = 0.82 + level * 0.18
        }

        ctx.save()
        ctx.shadowColor = `rgba(${palette.rgb},${active ? 0.85 : 0.3})`
        ctx.shadowBlur = reduced ? 0 : active ? 16 : 8
        ctx.fillStyle = active
          ? gradient
          : `rgba(${palette.rgb},0.55)`
        drawRoundedBar(x, y, barW, barH, barW / 2, true)
        ctx.fill()
        ctx.restore()

        // reflection
        ctx.globalAlpha = active ? 0.12 : 0.05
        ctx.fillStyle = palette.main
        drawRoundedBar(x, bottom + 4, barW, Math.min(barH * 0.24, 22), barW / 2, false)
        ctx.fill()

        // peak caps
        if (active) {
          const peak = peaks[i]
          const peakY = bottom - Math.max(2, Math.pow(peak, 1.25) * (bottom - top))
          ctx.globalAlpha = 0.75
          ctx.fillStyle = palette.cyan
          ctx.fillRect(x, peakY - 2, barW, 1.6)
        }
      }
      ctx.globalAlpha = 1
    }

    const drawMirror = (active: boolean) => {
      const middle = heightPx / 2
      const gap = Math.max(2, width * 0.006)
      const barW = Math.max(1.5, (width - gap * (barCount - 1)) / barCount)
      const maxH = heightPx * 0.44
      const gradient = ctx.createLinearGradient(0, middle - maxH, 0, middle + maxH)
      gradient.addColorStop(0, palette.cyan)
      gradient.addColorStop(0.48, palette.main)
      gradient.addColorStop(0.52, palette.main)
      gradient.addColorStop(1, `rgba(${palette.rgb},0.25)`)

      if (showGrid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.beginPath()
        ctx.moveTo(0, middle)
        ctx.lineTo(width, middle)
        ctx.stroke()
      }

      for (let i = 0; i < barCount; i++) {
        const level = active ? levels[i] : idleLevel(i)
        const barH = Math.max(1.5, Math.pow(level, 1.3) * maxH)
        const x = i * (barW + gap)
        ctx.globalAlpha = active ? 0.9 : 0.3
        ctx.save()
        ctx.shadowColor = palette.main
        ctx.shadowBlur = reduced || !active ? 0 : 12
        ctx.fillStyle = gradient
        drawRoundedBar(x, middle - barH, barW, barH * 2, barW / 2)
        ctx.fill()
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    const drawWave = (active: boolean) => {
      const middle = heightPx / 2
      const points = 220
      const amplitude = active ? heightPx * 0.32 : heightPx * 0.045
      const synth = (i: number, t: number) =>
        Math.sin(i * 0.16 + t * 1.1) * 0.42 +
        Math.sin(i * 0.07 - t * 0.7) * 0.3 +
        Math.sin(i * 0.31 + t * 0.35) * 0.12

      if (showGrid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, middle)
        ctx.lineTo(width, middle)
        ctx.stroke()
      }

      const build = (offset: number): Array<[number, number]> => {
        const pts: Array<[number, number]> = []
        for (let i = 0; i < points; i++) {
          const ratio = i / (points - 1)
          const sample = active
            ? (wave[Math.floor(ratio * wave.length)] - 128) / 128
            : synth(i, performance.now() * 0.001)
          pts.push([ratio * width, middle + sample * amplitude + offset])
        }
        return pts
      }

      const pts = build(0)
      const trace = (path: Array<[number, number]>) => {
        ctx.beginPath()
        path.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
      }

      ctx.save()
      ctx.shadowColor = palette.main
      ctx.shadowBlur = reduced ? 0 : active ? 18 : 6
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, palette.cyan)
      gradient.addColorStop(0.5, palette.main)
      gradient.addColorStop(1, palette.bright)
      ctx.strokeStyle = gradient
      ctx.lineWidth = active ? 2.2 : 1.4
      ctx.globalAlpha = active ? 0.95 : 0.4
      trace(pts)
      ctx.stroke()
      ctx.restore()

      // secondary ghost trace
      ctx.save()
      ctx.globalAlpha = active ? 0.25 : 0.12
      ctx.strokeStyle = palette.cyan
      ctx.lineWidth = 1
      trace(build(6))
      ctx.stroke()
      ctx.restore()

      // fill under the wave
      ctx.beginPath()
      ctx.moveTo(0, middle)
      pts.forEach(([x, y]) => ctx.lineTo(x, y))
      ctx.lineTo(width, middle)
      ctx.closePath()
      const fill = ctx.createLinearGradient(0, middle - amplitude, 0, middle + amplitude)
      fill.addColorStop(0, `rgba(${palette.rgb},0.18)`)
      fill.addColorStop(0.5, `rgba(${palette.rgb},0.04)`)
      fill.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = fill
      ctx.fill()
    }

    const drawOrb = (active: boolean) => {
      const cx = width / 2
      const cy = heightPx / 2
      const base = Math.min(width, heightPx) * 0.19
      const energy = active ? bassEnergy : 0.24 + Math.sin(performance.now() * 0.0012) * 0.05
      const middle = sampleFrequency(0.62)

      const glow = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base * 2.4)
      glow.addColorStop(0, `rgba(${palette.rgb},${active ? 0.34 : 0.14})`)
      glow.addColorStop(0.45, `rgba(${palette.rgb},0.08)`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, heightPx)

      const rings = [
        base * (1.05 + energy * 0.55),
        base * (1.4 + middle * 0.5),
        base * (1.8 + (active ? middle * 0.35 : 0.05)),
      ]
      rings.forEach((radius, i) => {
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = i === 0 ? palette.main : i === 1 ? palette.cyan : `rgba(${palette.rgb},0.5)`
        ctx.globalAlpha = active ? 0.85 - i * 0.2 : 0.28 - i * 0.05
        ctx.lineWidth = i === 0 ? 2 : 1
        ctx.save()
        ctx.shadowColor = palette.main
        ctx.shadowBlur = reduced || !active ? 0 : 18
        ctx.stroke()
        ctx.restore()
      })

      ctx.beginPath()
      ctx.arc(cx, cy, base * 0.72 * (1 + energy * 0.1), 0, Math.PI * 2)
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.9)
      core.addColorStop(0, `rgba(255,255,255,${active ? 0.22 : 0.08})`)
      core.addColorStop(0.6, `rgba(${palette.rgb},${active ? 0.28 : 0.1})`)
      core.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = core
      ctx.fill()

      const now = performance.now() * 0.0004
      for (let p = 0; p < 3; p++) {
        const angle = now * (1 + p * 0.4) + (p * Math.PI * 2) / 3
        const radius = rings[p]
        const px = cx + Math.cos(angle) * radius
        const py = cy + Math.sin(angle) * radius
        ctx.beginPath()
        ctx.arc(px, py, 2.4, 0, Math.PI * 2)
        ctx.fillStyle = p === 1 ? palette.cyan : palette.bright
        ctx.globalAlpha = active ? 0.9 : 0.35
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const render = (now: number) => {
      raf = requestAnimationFrame(render)
      const frameGap = reduced ? 1000 / 30 : 1000 / 60
      if (now - lastFrame < frameGap) return
      lastFrame = now

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(heightPx * dpr)) {
        resize()
      }

      ctx.clearRect(0, 0, width, heightPx)
      const live = engine.isLive
      let energy = 0
      if (live) {
        engine.readFrequency(freq)
        engine.readWaveform(wave)
        let sum = 0
        const inspect = Math.min(600, freq.length)
        for (let i = 0; i < inspect; i++) sum += freq[i]
        energy = sum / inspect
      }
      const active = live && energy > 0.6

      if (active) {
        for (let i = 0; i < barCount; i++) {
          const target = sampleFrequency((i + 0.5) / barCount) * 1.06
          const eased = target > levels[i] ? target : levels[i] * 0.86 + target * 0.14
          levels[i] = Math.min(1, eased)
          peaks[i] = Math.max(levels[i], peaks[i] - 0.012)
        }
        const subBins = Math.min(freq.length, 12)
        let sub = 0
        for (let i = 0; i < subBins; i++) sub += freq[i]
        bassEnergy = sub / subBins / 255
      } else {
        for (let i = 0; i < barCount; i++) {
          levels[i] *= 0.9
          peaks[i] = Math.max(0, peaks[i] - 0.02)
        }
        bassEnergy *= 0.95
      }

      ctx.globalAlpha = 1
      if (mode === 'wave') drawWave(active)
      else if (mode === 'orb') drawOrb(active)
      else if (mode === 'mirror') drawMirror(active)
      else drawSpectrum(active)
    }

    raf = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [engine, mode, accent, reduced, smoothing, height, bars, showGrid])

  return (
    <div className={`spectrum ${className}`} style={{ height }}>
      <canvas ref={canvasRef} className="spectrum__canvas" aria-hidden="true" />
      <div className="spectrum__scan" aria-hidden="true" />
    </div>
  )
}
