import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'
import { getMemoryCache, setMemoryCache } from '@/lib/cache/clientCache'

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
  const prayerTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
  const studyTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

  // 2. Strict Consecutive Streak Determination (The "All or Nothing" Rule)
  // Query all lifetime sessions to aggregate prayer and study minutes by local day
  const { data: allUserSessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, started_at, created_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const dailyMinutesMap: Record<string, { prayerSecs: number; studySecs: number }> = {}

  ;(allUserSessions || []).forEach((s) => {
    const dStr = getLocalDateKey(s.started_at || s.created_at)
    if (dStr) {
      if (!dailyMinutesMap[dStr]) {
        dailyMinutesMap[dStr] = { prayerSecs: 0, studySecs: 0 }
      }
      if (s.type === 'prayer') dailyMinutesMap[dStr].prayerSecs += s.duration_seconds || 0
      if (s.type === 'study' || s.type === 'word') dailyMinutesMap[dStr].studySecs += s.duration_seconds || 0
    }
  })

  // Check today's progress
  const todayKey = getLocalDateKey()
  const todayPrayerSecs = dailyMinutesMap[todayKey]?.prayerSecs || 0
  const todayStudySecs = dailyMinutesMap[todayKey]?.studySecs || 0
  const prayerMinutes = Math.floor(todayPrayerSecs / 60)
  const studyMinutes = Math.floor(todayStudySecs / 60)
  const isTodayComplete = prayerMinutes >= prayerTarget && studyMinutes >= studyTarget

  let streakDays = isTodayComplete ? 1 : 0

  // The Break Rule: Walk backwards consecutive calendar days starting from yesterday
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

    // The Dual Requirement: Both targets must be met
    if (prevPrayerMins >= prayerTarget && prevStudyMins >= studyTarget) {
      streakDays += 1
      dayOffset += 1
    } else {
      // Failing either target breaks the streak
      break
    }
  }

  // 4. Week Consistency (Mon - Sun)
  const now = new Date()
  const currentDayIndex = (now.getDay() + 6) % 7
  const dayStart = getStartOfLocalDay(now)
  dayStart.setDate(dayStart.getDate() - currentDayIndex)

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('type, started_at, duration_seconds')
    .eq('user_id', user.id)
    .gte('started_at', dayStart.toISOString())

  const weekSessionsByDay: Record<number, { prayer: number; study: number }> = {}
  for (let i = 0; i < 7; i++) {
    weekSessionsByDay[i] = { prayer: 0, study: 0 }
  }

  ;(weekSessions || []).forEach((s) => {
    const sDate = new Date(s.started_at)
    const dayIdx = (sDate.getDay() + 6) % 7
    if (s.type === 'prayer') weekSessionsByDay[dayIdx].prayer += s.duration_seconds
    if (s.type === 'study' || s.type === 'word') weekSessionsByDay[dayIdx].study += s.duration_seconds
  })

  let completedDaysCount = 0
  const weekDots: ('completed' | 'today' | 'missed' | 'pending')[] = []

  for (let i = 0; i < 7; i++) {
    const dayPrayerMins = Math.floor((weekSessionsByDay[i]?.prayer || 0) / 60)
    const dayStudyMins = Math.floor((weekSessionsByDay[i]?.study || 0) / 60)
    const isBothMet = dayPrayerMins >= prayerTarget && dayStudyMins >= studyTarget

    if (i < currentDayIndex) {
      if (isBothMet) {
        weekDots.push('completed')
        completedDaysCount++
      } else {
        weekDots.push('missed')
      }
    } else if (i === currentDayIndex) {
      if (prayerMinutes >= prayerTarget && studyMinutes >= studyTarget) {
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
