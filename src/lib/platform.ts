/** Small platform helpers. */

export function haptic(ms = 8): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* iOS ignores the vibration API */
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function signedDb(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (Math.abs(rounded) < 0.05) return '0 dB'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} dB`
}
