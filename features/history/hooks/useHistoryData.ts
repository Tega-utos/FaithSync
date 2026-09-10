'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay, getEndOfLocalDay } from '@/lib/utils/date'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

export interface DailySummary {
  dateKey: string // YYYY-MM-DD
  dateDisplay: string // e.g. "Sep 10"
  isToday: boolean
  isFuture: boolean
  prayerMinutes: number
  studyMinutes: number
  totalMinutes: number
  prayerTarget: number
  studyTarget: number
  isPrayerMet: boolean
  isStudyMet: boolean
  status: 'Complete' | 'In Progress' | 'Missed' | 'Pending'
}

export interface HistoryDataResult {
  dailySummaries: DailySummary[]
  prayerTarget: number
  studyTarget: number
  userName: string
  year: number
  month: number // 1-12
  monthLabel: string // e.g. "September 2026"
  completedDays: number
  totalDaysInMonth: number
  elapsedDaysInMonth: number
  totalMinutesMonth: number
  consistencyPercent: number
  earliestDateKey: string // YYYY-MM-DD
}

export async function fetchHistoryData(
  targetYear?: number,
  targetMonth?: number
): Promise<HistoryDataResult | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const now = new Date()
  const year = targetYear || now.getFullYear()
  const month = targetMonth || now.getMonth() + 1 // 1-indexed (1-12)

  let userName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    'Believer'

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, preferences, created_at')
    .eq('id', user.id)
    .single()

  if (profile?.display_name) {
    userName = profile.display_name
  }

  const prefs = (profile?.preferences as any) || {}
  const pTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
  const sTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

  // Calculate calendar month bounds
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const endOfMonth = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999)

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1
  const todayDateNum = now.getDate()
  const todayKey = getLocalDateKey(now)

  // Query sessions for the selected calendar month + earliest session for month bounds
  const [sessionsRes, earliestSessionRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
      .eq('user_id', user.id)
      .gte('started_at', startOfMonth.toISOString())
      .lte('started_at', endOfMonth.toISOString())
      .order('started_at', { ascending: false }),
    supabase
      .from('sessions')
      .select('started_at, created_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const earliestDateKey =
    (earliestSessionRes.data?.started_at
      ? getLocalDateKey(earliestSessionRes.data.started_at)
      : null) ||
    (profile?.created_at ? getLocalDateKey(profile.created_at) : null) ||
    getLocalDateKey(now)

  const sessions = sessionsRes.data || []

  interface DayAgg {
    prayerSecs: number
    studySecs: number
    prayerTargetSecs: number
    studyTargetSecs: number
    hasCompletedPrayerSession: boolean
    hasCompletedStudySession: boolean
  }
  const dayMap: Record<string, DayAgg> = {}

  sessions.forEach((s) => {
    const rawDate = s.started_at || s.created_at
    const dateKey = getLocalDateKey(rawDate)
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = {
        prayerSecs: 0,
        studySecs: 0,
        prayerTargetSecs: 0,
        studyTargetSecs: 0,
        hasCompletedPrayerSession: false,
        hasCompletedStudySession: false,
      }
    }
    if (s.type === 'prayer') {
      dayMap[dateKey].prayerSecs += s.duration_seconds || 0
      if (s.target_duration_seconds && s.target_duration_seconds > 0) {
        dayMap[dateKey].prayerTargetSecs = Math.max(
          dayMap[dateKey].prayerTargetSecs,
          s.target_duration_seconds
        )
      }
      if (
        s.is_complete ||
        (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))
      ) {
        dayMap[dateKey].hasCompletedPrayerSession = true
      }
    } else if (s.type === 'study' || s.type === 'word') {
      dayMap[dateKey].studySecs += s.duration_seconds || 0
      if (s.target_duration_seconds && s.target_duration_seconds > 0) {
        dayMap[dateKey].studyTargetSecs = Math.max(
          dayMap[dateKey].studyTargetSecs,
          s.target_duration_seconds
        )
      }
      if (
        s.is_complete ||
        (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))
      ) {
        dayMap[dateKey].hasCompletedStudySession = true
      }
    }
  })

  const summaries: DailySummary[] = []
  let totalMinutesMonth = 0
  let completedDays = 0

  // Build daily summaries in reverse chronological order (Day N down to Day 1)
  for (let dayNum = daysInMonth; dayNum >= 1; dayNum--) {
    const d = new Date(year, month - 1, dayNum)
    const dateKey = getLocalDateKey(d)
    const isToday = isCurrentMonth && dayNum === todayDateNum
    const isFuture = isCurrentMonth && dayNum > todayDateNum

    const dateDisplay = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })

    const agg = dayMap[dateKey] || {
      prayerSecs: 0,
      studySecs: 0,
      prayerTargetSecs: 0,
      studyTargetSecs: 0,
      hasCompletedPrayerSession: false,
      hasCompletedStudySession: false,
    }

    const prayerMinutes = Math.floor(agg.prayerSecs / 60)
    const studyMinutes = Math.floor(agg.studySecs / 60)
    const totalMinutes = prayerMinutes + studyMinutes
    totalMinutesMonth += totalMinutes

    const dayMetrics = {
      prayerMins: prayerMinutes,
      studyMins: studyMinutes,
      recordedPrayerTarget: agg.prayerTargetSecs
        ? Math.round(agg.prayerTargetSecs / 60)
        : undefined,
      recordedStudyTarget: agg.studyTargetSecs
        ? Math.round(agg.studyTargetSecs / 60)
        : undefined,
      hasCompletedPrayerSession: agg.hasCompletedPrayerSession,
      hasCompletedStudySession: agg.hasCompletedStudySession,
    }

    const historicalTargets = getTargetsForDate(
      dateKey,
      prefs,
      pTarget,
      sTarget,
      dayMetrics
    )
    const prayerTargetForDay = historicalTargets.prayerTarget || pTarget
    const studyTargetForDay = historicalTargets.studyTarget || sTarget

    const isPrayerMet =
      agg.hasCompletedPrayerSession ||
      (prayerTargetForDay > 0 && prayerMinutes >= prayerTargetForDay)
    const isStudyMet =
      agg.hasCompletedStudySession ||
      (studyTargetForDay > 0 && studyMinutes >= studyTargetForDay)

    let status: 'Complete' | 'In Progress' | 'Missed' | 'Pending'
    if (isFuture) {
      status = 'Pending'
    } else if (isPrayerMet && isStudyMet) {
      status = 'Complete'
      completedDays++
    } else if (isToday) {
      status = 'In Progress'
    } else {
      status = totalMinutes > 0 ? 'In Progress' : 'Missed'
    }

    summaries.push({
      dateKey,
      dateDisplay,
      isToday,
      isFuture,
      prayerMinutes,
      studyMinutes,
      totalMinutes,
      prayerTarget: prayerTargetForDay,
      studyTarget: studyTargetForDay,
      isPrayerMet,
      isStudyMet,
      status,
    })
  }

  const elapsedDaysInMonth = isCurrentMonth ? Math.min(todayDateNum, daysInMonth) : daysInMonth
  const consistencyPercent =
    elapsedDaysInMonth > 0 ? Math.round((completedDays / elapsedDaysInMonth) * 100) : 0

  const monthDate = new Date(year, month - 1, 1)
  const monthLabel = monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return {
    dailySummaries: summaries,
    prayerTarget: pTarget,
    studyTarget: sTarget,
    userName,
    year,
    month,
    monthLabel,
    completedDays,
    totalDaysInMonth: daysInMonth,
    elapsedDaysInMonth,
    totalMinutesMonth,
    consistencyPercent,
    earliestDateKey,
  }
}

export function useHistoryData(targetYear?: number, targetMonth?: number) {
  const now = new Date()
  const year = targetYear || now.getFullYear()
  const month = targetMonth || now.getMonth() + 1

  const cacheKey = `history_sessions_data_${year}_${month}`

  const { data, error, isLoading, isValidating, mutate } = useSWR<HistoryDataResult | null>(
    cacheKey,
    () => fetchHistoryData(year, month),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  const monthDate = new Date(year, month - 1, 1)
  const defaultMonthLabel = monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return {
    dailySummaries: data?.dailySummaries || [],
    prayerTarget: data?.prayerTarget || 15,
    studyTarget: data?.studyTarget || 15,
    userName: data?.userName || 'Believer',
    year: data?.year || year,
    month: data?.month || month,
    monthLabel: data?.monthLabel || defaultMonthLabel,
    completedDays: data?.completedDays || 0,
    totalDaysInMonth: data?.totalDaysInMonth || 30,
    elapsedDaysInMonth: data?.elapsedDaysInMonth || 30,
    totalMinutesMonth: data?.totalMinutesMonth || 0,
    consistencyPercent: data?.consistencyPercent || 0,
    earliestDateKey: data?.earliestDateKey || getLocalDateKey(now),
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  }
}

export function invalidateHistoryData() {
  globalMutate((key: any) => typeof key === 'string' && key.startsWith('history_sessions_data'))
}

