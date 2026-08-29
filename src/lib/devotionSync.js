/**
 * Shared Deterministic Sync Utility
 * Single source of truth for devotion state transitions and time calculations.
 */

export function getDevotionState(startedAt, durationMins) {
  const start = new Date(startedAt).getTime()
  const end = start + durationMins * 60000
  const now = Date.now()

  if (now < start) return 'scheduled'
  if (now < end) return 'live'
  return 'completed'
}

export function getElapsedSeconds(startedAt) {
  const start = new Date(startedAt).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

export function getRemainingSeconds(startedAt, durationMins) {
  const totalSeconds = durationMins * 60
  return Math.max(0, totalSeconds - getElapsedSeconds(startedAt))
}
