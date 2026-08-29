import { TimelineSegment } from '@/components/timer/PrayerFocusTimelineBuilder'
import { playSegmentChime, startSilentMediaLoop, stopSilentMediaLoop } from '@/components/audio/Chime'

let wakeLockSentinel: any = null

/**
 * 4.1 Request Screen Wake Lock
 */
export async function requestScreenWakeLock() {
  if (typeof window === 'undefined' || !('wakeLock' in navigator)) return
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
  } catch (err: any) {
    console.warn('Wake Lock not available or denied:', err?.message)
  }
}

/**
 * 4.1 Release Screen Wake Lock
 */
export async function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release()
    } catch {}
    wakeLockSentinel = null
  }
}

/**
 * 4.2 Update Lock Screen metadata using Media Session API
 */
export function updateLockScreenMedia(segment: TimelineSegment | null, discipline: string = 'Prayer') {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

  try {
    if (!segment) {
      navigator.mediaSession.metadata = new (window as any).MediaMetadata({
        title: `${discipline} Session`,
        artist: 'Open stillness & prayer',
        album: 'FaithSync — Prayer Focus',
        artwork: [{ src: '/assets/welcome-hero.png', sizes: '512x512', type: 'image/png' }],
      })
      return
    }

    const title = segment.type === 'scripture' ? (segment.reference || 'Scripture') : 'Reflection Prompt'
    const artist = segment.type === 'scripture' ? (segment.verseText || segment.reference || '') : (segment.prompt || '')

    navigator.mediaSession.metadata = new (window as any).MediaMetadata({
      title,
      artist,
      album: 'FaithSync — Prayer Focus',
      artwork: [{ src: '/assets/welcome-hero.png', sizes: '512x512', type: 'image/png' }],
    })
  } catch (err) {
    console.warn('MediaSession metadata error:', err)
  }
}

/**
 * 4.3 Request Notification permission in context
 */
export async function requestSessionNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    const perm = await Notification.requestPermission()
    return perm === 'granted'
  } catch {
    return false
  }
}

/**
 * 4.3 Show OS Notification via Service Worker on segment change
 */
export async function notifySegmentTransition(segment: TimelineSegment | null) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  const title = segment
    ? segment.type === 'scripture'
      ? `Scripture: ${segment.reference}`
      : 'Prayer Reflection'
    : 'Timeline Completed'

  const body = segment
    ? segment.type === 'scripture'
      ? segment.verseText ? `"${segment.verseText}"` : `Reading ${segment.reference}`
      : `"${segment.prompt}"`
    : 'Continuing in open prayer & stillness.'

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/assets/welcome-hero.png',
          tag: 'prayer-focus-segment',
          silent: false,
        })
        return
      }
    }

    new Notification(title, {
      body,
      icon: '/assets/welcome-hero.png',
      tag: 'prayer-focus-segment',
    })
  } catch (err) {
    console.warn('Notification trigger error:', err)
  }
}

/**
 * Coordinated handler called when a timeline segment changes
 */
export function onTimelineSegmentChanged(
  segment: TimelineSegment | null,
  isMuted: boolean = false,
  discipline: string = 'Prayer'
) {
  playSegmentChime(isMuted)
  updateLockScreenMedia(segment, discipline)
  notifySegmentTransition(segment)
}

/**
 * Start full session lock-screen presence
 */
export async function startLockScreenSession(firstSegment: TimelineSegment | null, discipline: string = 'Prayer') {
  await requestScreenWakeLock()
  startSilentMediaLoop()
  updateLockScreenMedia(firstSegment, discipline)
}

/**
 * Stop full session lock-screen presence
 */
export async function stopLockScreenSession() {
  await releaseScreenWakeLock()
  stopSilentMediaLoop()
}
