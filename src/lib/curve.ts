import { EQ_FREQUENCIES } from '../audio/types'

export type Pt = { x: number; y: number }

const MIN_HZ = EQ_FREQUENCIES[0]
const MAX_HZ = EQ_FREQUENCIES[EQ_FREQUENCIES.length - 1]
const LOG_SPAN = Math.log10(MAX_HZ / MIN_HZ)

export function logRatio(hz: number): number {
  return Math.log10(hz / MIN_HZ) / LOG_SPAN
}

export function bandPoints(
  bands: number[],
  width: number,
  height: number,
  paddingX = 12,
  paddingY = 10,
  range = 12,
): Pt[] {
  return EQ_FREQUENCIES.map((hz, index) => {
    const x = paddingX + logRatio(hz) * (width - paddingX * 2)
    const y =
      height / 2 - ((bands[index] ?? 0) / range) * (height / 2 - paddingY)
    return { x, y }
  })
}

/** Catmull-Rom → cubic Bézier for a smooth, natural EQ curve. */
export function smoothPath(points: Pt[], tension = 0.9): string {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`
  }
  return d
}

export function areaPath(points: Pt[], baseline: number): string {
  if (!points.length) return ''
  const line = smoothPath(points)
  const last = points[points.length - 1]
  return `${line} L ${round(last.x)} ${baseline} L ${round(points[0].x)} ${baseline} Z`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function nearestBandIndex(xRatio: number): number {
  let best = 0
  let bestDelta = Infinity
  EQ_FREQUENCIES.forEach((hz, index) => {
    const delta = Math.abs(logRatio(hz) - xRatio)
    if (delta < bestDelta) {
      bestDelta = delta
      best = index
    }
  })
  return best
}
