// Scan feedback: a short beep + haptic buzz. Everything is guarded — no browser API here is guaranteed.

const SOUND_KEY = "stockflow.scanner.sound"

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) audioContext = new Ctor()
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {})
  return audioContext
}

/**
 * Browsers (iOS Safari especially) only let audio start from a user gesture. Call this when the
 * scanner opens and on the first tap inside it, so the beep works for reads that happen later.
 */
export function primeScanAudio() {
  if (!isScanSoundEnabled()) return
  try {
    getAudioContext()
  } catch {
    // audio unavailable
  }
}

export function isScanSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off"
  } catch {
    return true
  }
}

export function setScanSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off")
  } catch {
    // storage unavailable — the preference just won't stick
  }
}

function beep(kind: "success" | "error") {
  const ctx = getAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const start = ctx.currentTime
  const duration = kind === "success" ? 0.09 : 0.2
  osc.type = kind === "success" ? "sine" : "square"
  osc.frequency.value = kind === "success" ? 1760 : 220
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(kind === "success" ? 0.2 : 0.08, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Beep (unless muted) and vibrate. Safe to call anywhere on the client. */
export function playScanFeedback(kind: "success" | "error" = "success") {
  if (typeof navigator !== "undefined") {
    try {
      navigator.vibrate?.(kind === "success" ? 50 : [70, 50, 70])
    } catch {
      // vibration not allowed (e.g. no user gesture yet)
    }
  }
  if (!isScanSoundEnabled()) return
  try {
    beep(kind)
  } catch {
    // audio blocked or unavailable
  }
}
