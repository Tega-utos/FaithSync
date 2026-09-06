'use client'

/**
 * Devotion Scheduler & Evening Streak Risk Monitor
 * Checks user reminder preferences and triggers notifications locally or via Web Push.
 */

export interface DevotionSchedulerOptions {
  userId: string
  preferences: {
    notifDailyReminders?: boolean
    notifStreakReminders?: boolean
    prayerReminderTime?: string // 'HH:mm' e.g. '07:00'
    studyReminderTime?: string // 'HH:mm' e.g. '21:00'
  }
  todayTotalMins: number
  currentStreak: number
}

export function checkAndTriggerDevotionAlerts({
  userId,
  preferences,
  todayTotalMins,
  currentStreak,
}: DevotionSchedulerOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return

  if (Notification.permission !== 'granted') return

  const now = new Date()
  const todayKey = now.toISOString().split('T')[0]
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeMinutes = currentHour * 60 + currentMinute

  const notifDaily = preferences.notifDailyReminders ?? true
  const notifStreak = preferences.notifStreakReminders ?? true

  // Helper to trigger local browser notification
  const fireNotification = (title: string, body: string, url: string = '/clock-in', tag: string = 'devotion') => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag,
            data: { url },
          } as any)
        })
      } else {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag,
        })
      }
    } catch (err) {
      console.error('Local notification error:', err)
    }
  }

  // 1. Evening 8:30 PM (20:30) Streak at Risk Warning
  if (notifStreak && currentHour >= 20 && currentMinute >= 30 && todayTotalMins === 0) {
    const streakKey = `faithsync_streak_warned_${todayKey}_${userId}`
    const alreadyWarned = localStorage.getItem(streakKey)
    if (!alreadyWarned) {
      localStorage.setItem(streakKey, 'true')
      const streakText = currentStreak > 0 ? `your ${currentStreak}-day streak` : 'your altar'
      fireNotification(
        '🔥 Protect Your Streak',
        `You haven't clocked in today yet. Take a moment before midnight to protect ${streakText}!`,
        '/clock-in',
        'streak-warning'
      )
    }
  }

  // 2. Daily Prayer Scheduled Devotion Reminder
  if (notifDaily && preferences.prayerReminderTime) {
    const [pHour, pMin] = preferences.prayerReminderTime.split(':').map(Number)
    if (!isNaN(pHour) && !isNaN(pMin)) {
      const targetTimeMins = pHour * 60 + pMin
      // If within 15 minutes of scheduled time
      if (Math.abs(currentTimeMinutes - targetTimeMins) <= 15) {
        const prayerKey = `faithsync_prayer_reminded_${todayKey}_${userId}`
        const alreadyReminded = localStorage.getItem(prayerKey)
        if (!alreadyReminded) {
          localStorage.setItem(prayerKey, 'true')
          fireNotification(
            '🌅 Morning Devotion Time',
            'Take 15 minutes to center your spirit in prayer and presence.',
            '/clock-in',
            'prayer-reminder'
          )
        }
      }
    }
  }

  // 3. Daily Scripture Study Scheduled Devotion Reminder
  if (notifDaily && preferences.studyReminderTime) {
    const [sHour, sMin] = preferences.studyReminderTime.split(':').map(Number)
    if (!isNaN(sHour) && !isNaN(sMin)) {
      const targetTimeMins = sHour * 60 + sMin
      if (Math.abs(currentTimeMinutes - targetTimeMins) <= 15) {
        const studyKey = `faithsync_study_reminded_${todayKey}_${userId}`
        const alreadyReminded = localStorage.getItem(studyKey)
        if (!alreadyReminded) {
          localStorage.setItem(studyKey, 'true')
          fireNotification(
            '📖 Scripture Study Time',
            'Open the Word and meditate on scripture for your evening growth.',
            '/clock-in',
            'study-reminder'
          )
        }
      }
    }
  }
}
