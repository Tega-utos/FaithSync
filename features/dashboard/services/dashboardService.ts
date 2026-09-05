import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'
import { getMemoryCache, setMemoryCache } from '@/lib/cache/clientCache'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

export interface DashboardData {
  firstName: string
  streakDays: number
  prayerMinutes: number
  studyMinutes: number
  prayerTarget: number
  studyTarget: number
  weekDots: ('completed' | 'today' | 'missed' | 'pending')[]
  completedDaysCount: number
  buddies: Array<{
    id: string
    connectionId: string
    name: string
    initial: string
    isActiveNow: boolean
    prayerDone: boolean
    studyDone: boolean
    bothDone: boolean
  }>
  pendingRequests: Array<{
    id: string
    senderId: string
    senderName: string
    senderInitial: string
  }>
  globalCount: number
  activeCommunityUsers: Array<{
    id: string
    initial: string
  }>
}

export async function fetchDashboardData(forceFresh = false): Promise<DashboardData | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const cacheKey = `dashboard_data_${user.id}`
  if (!forceFresh) {
    const cached = getMemoryCache<DashboardData>(cacheKey, 90_000)
    if (cached) return cached
  }

  // 1. Profile & Goal Preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, preferences')
    .eq('id', user.id)
    .single()

  const rawName = profile?.display_name || user.user_metadata?.full_name || 'Believer'
  const firstName = rawName.split(' ')[0]
  const prefs = (profile?.preferences as any) || {}
  const prayerTarget = Number(
    prefs.prayerTarget ||
    prefs.targets?.prayer ||
    user.user_metadata?.prayerTarget ||
    user.user_metadata?.targets?.prayer ||
    15
  )
  const studyTarget = Number(
    prefs.studyTarget ||
    prefs.wordTarget ||
    prefs.targets?.study ||
    user.user_metadata?.studyTarget ||
    user.user_metadata?.targets?.study ||
    15
  )

  // 2. Strict Consecutive Streak Determination (The "All or Nothing" Rule)
  // Query all lifetime personal and 1-on-1 buddy sessions (Group sessions are excluded from personal records)
  const { data: rawAllUserSessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at, is_group, group_id')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const allUserSessions = (rawAllUserSessions || []).filter((s: any) => !s.is_group && s.type !== 'group' && !s.group_id)

  interface DayMinutesAgg {
    prayerSecs: number
    studySecs: number
    prayerTargetSecs: number
    studyTargetSecs: number
    hasPrayerComplete: boolean
    hasStudyComplete: boolean
  }

  const dailyMinutesMap: Record<string, DayMinutesAgg> = {}

  allUserSessions.forEach((s) => {
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

  // Check today's progress using today's target
  const todayKey = getLocalDateKey()
  const todayData = dailyMinutesMap[todayKey]
  const todayPrayerSecs = todayData?.prayerSecs || 0
  const todayStudySecs = todayData?.studySecs || 0
  const prayerMinutes = Math.floor(todayPrayerSecs / 60)
  const studyMinutes = Math.floor(todayStudySecs / 60)

  const todayMetrics = {
    prayerMins: prayerMinutes,
    studyMins: studyMinutes,
    recordedPrayerTarget: todayData?.prayerTargetSecs ? Math.round(todayData.prayerTargetSecs / 60) : undefined,
    recordedStudyTarget: todayData?.studyTargetSecs ? Math.round(todayData.studyTargetSecs / 60) : undefined,
    hasCompletedPrayerSession: todayData?.hasPrayerComplete,
    hasCompletedStudySession: todayData?.hasStudyComplete,
  }

  const todayTarget = getTargetsForDate(todayKey, prefs, prayerTarget, studyTarget, todayMetrics)
  const isTodayComplete = prayerMinutes >= todayTarget.prayerTarget && studyMinutes >= todayTarget.studyTarget

  let streakDays = isTodayComplete ? 1 : 0

  // The Break Rule: Walk backwards consecutive calendar days starting from yesterday using each day's historical target
  const checkDate = new Date()
  let dayOffset = 1
  while (true) {
    const prevDate = new Date(checkDate)
    prevDate.setDate(prevDate.getDate() - dayOffset)
    const prevKey = getLocalDateKey(prevDate)
    const dayData = dailyMinutesMap[prevKey]

    if (!dayData) {
      // Missing day breaks consecutive streak
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

    // The Dual Requirement: Both targets for THAT historical day must be met
    if (prevPrayerMins >= dayHistoricalTarget.prayerTarget && prevStudyMins >= dayHistoricalTarget.studyTarget) {
      streakDays += 1
      dayOffset += 1
    } else {
      // Failing either target breaks the streak
      break
    }
  }

  // 4. Week Consistency (Mon - Sun) using day-specific targets
  const now = new Date()
  const currentDayIndex = (now.getDay() + 6) % 7
  const dayStart = getStartOfLocalDay(now)
  dayStart.setDate(dayStart.getDate() - currentDayIndex)

  const { data: rawWeekSessions } = await supabase
    .from('sessions')
    .select('type, started_at, duration_seconds, target_duration_seconds, is_complete, is_group, group_id')
    .eq('user_id', user.id)
    .gte('started_at', dayStart.toISOString())

  const weekSessions = (rawWeekSessions || []).filter((s: any) => !s.is_group && s.type !== 'group' && !s.group_id)

  const weekSessionsByDay: Record<number, { prayer: number; study: number; prayerTarget: number; studyTarget: number; hasP: boolean; hasS: boolean }> = {}
  for (let i = 0; i < 7; i++) {
    weekSessionsByDay[i] = { prayer: 0, study: 0, prayerTarget: 0, studyTarget: 0, hasP: false, hasS: false }
  }

  weekSessions.forEach((s) => {
    const sDate = new Date(s.started_at)
    const dayIdx = (sDate.getDay() + 6) % 7
    if (s.type === 'prayer') {
      weekSessionsByDay[dayIdx].prayer += s.duration_seconds || 0
      if (s.target_duration_seconds) {
        weekSessionsByDay[dayIdx].prayerTarget = Math.max(weekSessionsByDay[dayIdx].prayerTarget, Math.round(s.target_duration_seconds / 60))
      }
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
        weekSessionsByDay[dayIdx].hasP = true
      }
    }
    if (s.type === 'study' || s.type === 'word') {
      weekSessionsByDay[dayIdx].study += s.duration_seconds || 0
      if (s.target_duration_seconds) {
        weekSessionsByDay[dayIdx].studyTarget = Math.max(weekSessionsByDay[dayIdx].studyTarget, Math.round(s.target_duration_seconds / 60))
      }
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
        weekSessionsByDay[dayIdx].hasS = true
      }
    }
  })

  let completedDaysCount = 0
  const weekDots: ('completed' | 'today' | 'missed' | 'pending')[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(dayStart)
    d.setDate(d.getDate() + i)
    const dKey = getLocalDateKey(d)
    const dayPrayerMins = Math.floor((weekSessionsByDay[i]?.prayer || 0) / 60)
    const dayStudyMins = Math.floor((weekSessionsByDay[i]?.study || 0) / 60)

    const wMetrics = {
      prayerMins: dayPrayerMins,
      studyMins: dayStudyMins,
      recordedPrayerTarget: weekSessionsByDay[i]?.prayerTarget || undefined,
      recordedStudyTarget: weekSessionsByDay[i]?.studyTarget || undefined,
      hasCompletedPrayerSession: weekSessionsByDay[i]?.hasP,
      hasCompletedStudySession: weekSessionsByDay[i]?.hasS,
    }
    const dayTarget = getTargetsForDate(dKey, prefs, prayerTarget, studyTarget, wMetrics)

    const isBothMet = dayPrayerMins >= dayTarget.prayerTarget && dayStudyMins >= dayTarget.studyTarget

    if (i < currentDayIndex) {
      if (isBothMet) {
        weekDots.push('completed')
        completedDaysCount++
      } else {
        weekDots.push('missed')
      }
    } else if (i === currentDayIndex) {
      if (prayerMinutes >= todayTarget.prayerTarget && studyMinutes >= todayTarget.studyTarget) {
        weekDots.push('completed')
        completedDaysCount++
      } else {
        weekDots.push('today')
      }
    } else {
      weekDots.push('pending')
    }
  }

  // 5. Accountability Buddies
  const startOfToday = getStartOfLocalDay()

  const { data: connections } = await supabase
    .from('buddies')
    .select('id, status, user_id, buddy_id, created_at')
    .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)

  const activeBuddies: DashboardData['buddies'] = []
  const pendingRequests: DashboardData['pendingRequests'] = []

  if (connections) {
    const activePairs = connections.filter((c) => c.status === 'accepted')
    const incomingPending = connections.filter((c) => c.status === 'pending' && c.buddy_id === user.id)

    const partnerIds = activePairs.map((c) => (c.user_id === user.id ? c.buddy_id : c.user_id))
    const senderIds = incomingPending.map((c) => c.user_id)
    const allProfileIds = Array.from(new Set([...partnerIds, ...senderIds]))

    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', allProfileIds)

      const profileMap: Record<string, string> = {}
      ;(profiles || []).forEach((p) => {
        profileMap[p.id] = p.display_name || p.username || 'Buddy'
      })

      incomingPending.forEach((req) => {
        const sName = profileMap[req.user_id] || 'A Believer'
        pendingRequests.push({
          id: req.id,
          senderId: req.user_id,
          senderName: sName,
          senderInitial: sName.charAt(0).toUpperCase(),
        })
      })

      activePairs.forEach((conn) => {
        const partnerId = conn.user_id === user.id ? conn.buddy_id : conn.user_id
        const pName = profileMap[partnerId] || 'Accountability Buddy'
        activeBuddies.push({
          id: partnerId,
          connectionId: conn.id,
          name: pName,
          initial: pName.charAt(0).toUpperCase(),
          isActiveNow: false,
          prayerDone: false,
          studyDone: false,
          bothDone: false,
        })
      })
    }

    if (partnerIds.length > 0) {
      const { data: buddySessions } = await supabase
        .from('sessions')
        .select('user_id, type, duration_seconds')
        .in('user_id', partnerIds)
        .gte('started_at', startOfToday.toISOString())

      const buddyMinutesMap: Record<string, { prayer: number; study: number }> = {}
      ;(buddySessions || []).forEach((s) => {
        if (!buddyMinutesMap[s.user_id]) {
          buddyMinutesMap[s.user_id] = { prayer: 0, study: 0 }
        }
        const mins = Math.floor(s.duration_seconds / 60)
        if (s.type === 'prayer') buddyMinutesMap[s.user_id].prayer += mins
        if (s.type === 'study' || s.type === 'word') buddyMinutesMap[s.user_id].study += mins
      })

      activeBuddies.forEach((b) => {
        const bpMins = buddyMinutesMap[b.id]?.prayer || 0
        const bsMins = buddyMinutesMap[b.id]?.study || 0
        b.prayerDone = bpMins >= 15
        b.studyDone = bsMins >= 15
        b.bothDone = b.prayerDone && b.studyDone
        b.isActiveNow = bpMins > 0 || bsMins > 0
      })
    }
  }

  // 6. Global Community Attendance
  let globalCount = 0
  const activeCommunityUsers: DashboardData['activeCommunityUsers'] = []

  const { data: todayGlobalSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('started_at', startOfToday.toISOString())

  if (todayGlobalSessions && todayGlobalSessions.length > 0) {
    const uniqueGlobalUsers = Array.from(
      new Set(todayGlobalSessions.map((s) => s.user_id).filter(Boolean))
    )
    globalCount = uniqueGlobalUsers.length

    const { data: globalProfiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', uniqueGlobalUsers.slice(0, 4))

    if (globalProfiles) {
      globalProfiles.forEach((p) => {
        activeCommunityUsers.push({
          id: p.id,
          initial: (p.display_name || 'B').charAt(0).toUpperCase(),
        })
      })
    }
  }

  const result: DashboardData = {
    firstName,
    streakDays,
    prayerMinutes,
    studyMinutes,
    prayerTarget,
    studyTarget,
    weekDots,
    completedDaysCount,
    buddies: activeBuddies.slice(0, 3),
    pendingRequests,
    globalCount,
    activeCommunityUsers,
  }

  setMemoryCache(cacheKey, result)
  return result
}
