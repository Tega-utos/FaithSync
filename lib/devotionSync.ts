/**
 * Shared Deterministic Sync Utility
 * Single source of truth for devotion state transitions and time calculations.
 */

export type DevotionState = 'scheduled' | 'live' | 'completed'

export function getDevotionState(
  startedAt: string | number | Date,
  durationMins: number
): DevotionState {
  const start = new Date(startedAt).getTime()
  const end = start + durationMins * 60000
  const now = Date.now()

  if (now < start) return 'scheduled'
  if (now < end) return 'live'
  return 'completed'
}

export function getElapsedSeconds(startedAt: string | number | Date): number {
  const start = new Date(startedAt).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

export function getRemainingSeconds(
  startedAt: string | number | Date,
  durationMins: number
): number {
  const totalSeconds = durationMins * 60
  return Math.max(0, totalSeconds - getElapsedSeconds(startedAt))
}
