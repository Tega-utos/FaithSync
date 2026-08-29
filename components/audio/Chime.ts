/**
 * Gentle spiritual sound chimes synthesized with Web Audio API.
 * No external mp3 dependencies needed.
 */

let silentAudioEl: HTMLAudioElement | null = null

export function playGentleChime(isMuted: boolean = false) {
  if (isMuted || typeof window === 'undefined') return

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const now = ctx.currentTime

    // Frequencies of a Tibetan Singing Bowl chord: E4, B4, E5
    const freqs = [329.63, 493.88, 659.25]

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      // Soft attack and long gentle decay
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.15 / (i + 1), now + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 3.5)
    })
  } catch (e) {
    console.error('Audio chime error:', e)
  }
}

/**
 * Short, gentle bell chime under 1.5 seconds for segment changes
 */
export function playSegmentChime(isMuted: boolean = false) {
  if (isMuted || typeof window === 'undefined') return

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const now = ctx.currentTime

    // Warm peaceful interval: G4 (392.00 Hz) & D5 (587.33 Hz)
    const freqs = [392.0, 587.33]

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.12 / (i + 1), now + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 1.2)
    })
  } catch (e) {
    console.error('Segment chime error:', e)
  }
}

/**
 * Start silent audio loop to keep MediaSession alive on mobile lock screens
 */
export function startSilentMediaLoop() {
  if (typeof window === 'undefined') return

  try {
    if (!silentAudioEl) {
      // 1-second silent WAV base64
      const silentWav =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='
      silentAudioEl = new Audio(silentWav)
      silentAudioEl.loop = true
    }
    silentAudioEl.play().catch(() => {})
  } catch {}
}

export function stopSilentMediaLoop() {
  if (silentAudioEl) {
    try {
      silentAudioEl.pause()
      silentAudioEl.currentTime = 0
    } catch {}
  }
}

export const playChime = playGentleChime

