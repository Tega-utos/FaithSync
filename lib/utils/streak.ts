import { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateKey } from '@/lib/utils/date'

/**
 * Calculates the 100% authentic, real-database consecutive daily streak.
 * A day only counts if BOTH prayer and scripture study daily targets were achieved.
 * Zero mock data, zero hardcoded numbers.
 */
export async function calculateUserStreak(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  // 1. Fetch user targets
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const prefs = (profile?.preferences as any) || {}
  const prayerTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
  const studyTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

  // 2. Fetch all completed sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, started_at, created_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (!sessions || sessions.length === 0) return 0

  const dailyMinutesMap: Record<string, { prayerSecs: number; studySecs: number }> = {}

  sessions.forEach((s) => {
    const dStr = getLocalDateKey(s.started_at || s.created_at)
    if (dStr) {
      if (!dailyMinutesMap[dStr]) {
        dailyMinutesMap[dStr] = { prayerSecs: 0, studySecs: 0 }
      }
      if (s.type === 'prayer') dailyMinutesMap[dStr].prayerSecs += s.duration_seconds || 0
      if (s.type === 'study' || s.type === 'word') dailyMinutesMap[dStr].studySecs += s.duration_seconds || 0
    }
  })

  // 3. Check today's progress
  const todayKey = getLocalDateKey()
  const todayPrayerMins = Math.floor((dailyMinutesMap[todayKey]?.prayerSecs || 0) / 60)
  const todayStudyMins = Math.floor((dailyMinutesMap[todayKey]?.studySecs || 0) / 60)
  const isTodayComplete = todayPrayerMins >= prayerTarget && todayStudyMins >= studyTarget

  let streak = isTodayComplete ? 1 : 0

  // 4. Walk backwards day by day starting from yesterday
  const checkDate = new Date()
  let dayOffset = 1
  while (true) {
    const prevDate = new Date(checkDate)
    prevDate.setDate(prevDate.getDate() - dayOffset)
    const prevKey = getLocalDateKey(prevDate)
    const dayData = dailyMinutesMap[prevKey]

    if (!dayData) {
      break
    }

    const prevPrayerMins = Math.floor(dayData.prayerSecs / 60)
    const prevStudyMins = Math.floor(dayData.studySecs / 60)

    if (prevPrayerMins >= prayerTarget && prevStudyMins >= studyTarget) {
      streak += 1
      dayOffset += 1
    } else {
      break
    }
  }

  return streak
}
