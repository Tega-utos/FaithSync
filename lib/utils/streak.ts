import { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateKey } from '@/lib/utils/date'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

/**
 * Calculates the 100% authentic, real-database consecutive daily streak.
 * A day only counts if BOTH prayer and scripture study daily targets were achieved.
 * Targets are resolved historically per day so future target changes never break past streaks.
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

  // 2. Fetch all completed personal & buddy sessions (Group sessions are excluded from personal streaks)
  const { data: rawSessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at, is_group, group_id')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  const sessions = (rawSessions || []).filter((s: any) => !s.is_group && s.type !== 'group' && !s.group_id)

  if (!sessions || sessions.length === 0) return 0

  interface DayAgg {
    prayerSecs: number
    studySecs: number
    prayerTargetSecs: number
    studyTargetSecs: number
    hasPrayerComplete: boolean
    hasStudyComplete: boolean
  }

  const dailyMinutesMap: Record<string, DayAgg> = {}

  sessions.forEach((s) => {
    const dStr = getLocalDateKey(s.started_at || s.created_at)
    if (dStr) {
      if (!dailyMinutesMap[dStr]) {
        dailyMinutesMap[dStr] = {
          prayerSecs: 0,
          studySecs: 0,
          prayerTargetSecs: 0,
          studyTargetSecs: 0,
          hasPrayerComplete: false,
          hasStudyComplete: false,
        }
      }
      if (s.type === 'prayer') {
        dailyMinutesMap[dStr].prayerSecs += s.duration_seconds || 0
        if (s.target_duration_seconds) {
          dailyMinutesMap[dStr].prayerTargetSecs = Math.max(dailyMinutesMap[dStr].prayerTargetSecs, s.target_duration_seconds)
        }
        if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
          dailyMinutesMap[dStr].hasPrayerComplete = true
        }
      }
      if (s.type === 'study' || s.type === 'word') {
        dailyMinutesMap[dStr].studySecs += s.duration_seconds || 0
        if (s.target_duration_seconds) {
          dailyMinutesMap[dStr].studyTargetSecs = Math.max(dailyMinutesMap[dStr].studyTargetSecs, s.target_duration_seconds)
        }
        if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
          dailyMinutesMap[dStr].hasStudyComplete = true
        }
      }
    }
  })

  // 3. Check today's progress using today's target
  const todayKey = getLocalDateKey()
  const todayData = dailyMinutesMap[todayKey]
  const todayPrayerMins = Math.floor((todayData?.prayerSecs || 0) / 60)
  const todayStudyMins = Math.floor((todayData?.studySecs || 0) / 60)
  const todayMetrics = {
    prayerMins: todayPrayerMins,
    studyMins: todayStudyMins,
    recordedPrayerTarget: todayData?.prayerTargetSecs ? Math.round(todayData.prayerTargetSecs / 60) : undefined,
    recordedStudyTarget: todayData?.studyTargetSecs ? Math.round(todayData.studyTargetSecs / 60) : undefined,
    hasCompletedPrayerSession: todayData?.hasPrayerComplete,
    hasCompletedStudySession: todayData?.hasStudyComplete,
  }
  const todayTarget = getTargetsForDate(todayKey, prefs, prayerTarget, studyTarget, todayMetrics)
  const isTodayComplete = todayPrayerMins >= todayTarget.prayerTarget && todayStudyMins >= todayTarget.studyTarget

  let streak = isTodayComplete ? 1 : 0

  // 4. Walk backwards day by day starting from yesterday using each day's historical target
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
    const dayMetrics = {
      prayerMins: prevPrayerMins,
      studyMins: prevStudyMins,
      recordedPrayerTarget: dayData.prayerTargetSecs ? Math.round(dayData.prayerTargetSecs / 60) : undefined,
      recordedStudyTarget: dayData.studyTargetSecs ? Math.round(dayData.studyTargetSecs / 60) : undefined,
      hasCompletedPrayerSession: dayData.hasPrayerComplete,
      hasCompletedStudySession: dayData.hasStudyComplete,
    }
    const dayHistoricalTarget = getTargetsForDate(prevKey, prefs, prayerTarget, studyTarget, dayMetrics)

    if (prevPrayerMins >= dayHistoricalTarget.prayerTarget && prevStudyMins >= dayHistoricalTarget.studyTarget) {
      streak += 1
      dayOffset += 1
    } else {
      break
    }
  }

  return streak
}
