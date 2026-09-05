'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

export const HISTORY_CACHE_KEY = 'history_sessions_data'

export interface DailySummary {
  dateKey: string // YYYY-MM-DD
  dateDisplay: string // e.g. "Aug 27"
  isToday: boolean
  prayerMinutes: number
  studyMinutes: number
  totalMinutes: number
  prayerTarget: number
  studyTarget: number
  isPrayerMet: boolean
  isStudyMet: boolean
  status: 'Complete' | 'In Progress' | 'Missed'
}

export interface HistoryDataResult {
  dailySummaries: DailySummary[]
  prayerTarget: number
  studyTarget: number
  userName: string
}

export async function fetchHistoryData(): Promise<HistoryDataResult | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  let userName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    'Believer'

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, preferences')
    .eq('id', user.id)
    .single()

  if (profile?.display_name) {
    userName = profile.display_name
  }

  const prefs = (profile?.preferences as any) || {}
  const pTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
  const sTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

  const thirtyDaysAgo = getStartOfLocalDay()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
    .eq('user_id', user.id)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .order('started_at', { ascending: false })

  interface DayAgg {
    prayerSecs: number
    studySecs: number
    prayerTargetSecs: number
    studyTargetSecs: number
    hasCompletedPrayerSession: boolean
    hasCompletedStudySession: boolean
  }
  const dayMap: Record<string, DayAgg> = {}

  ;(sessions || []).forEach((s) => {
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
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
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
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
        dayMap[dateKey].hasCompletedStudySession = true
      }
    }
  })

  const todayKey = getLocalDateKey()
  const summaries: DailySummary[] = []

  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateKey = getLocalDateKey(d)
    const isToday = dateKey === todayKey

    const dateDisplay = d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })

    const historicalTargets = getTargetsForDate(d, profile?.preferences || {})
    const prayerTargetForDay = historicalTargets.prayerTarget || pTarget
    const studyTargetForDay = historicalTargets.studyTarget || sTarget

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

    const isPrayerMet =
      agg.hasCompletedPrayerSession ||
      (prayerTargetForDay > 0 && prayerMinutes >= prayerTargetForDay)
    const isStudyMet =
      agg.hasCompletedStudySession ||
      (studyTargetForDay > 0 && studyMinutes >= studyTargetForDay)

    let status: 'Complete' | 'In Progress' | 'Missed'
    if (isPrayerMet && isStudyMet) {
      status = 'Complete'
    } else if (isToday) {
      status = totalMinutes > 0 ? 'In Progress' : 'In Progress'
    } else {
      status = totalMinutes > 0 ? 'In Progress' : 'Missed'
    }

    summaries.push({
      dateKey,
      dateDisplay,
      isToday,
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

  return {
    dailySummaries: summaries,
    prayerTarget: pTarget,
    studyTarget: sTarget,
    userName,
  }
}

export function useHistoryData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<HistoryDataResult | null>(
    HISTORY_CACHE_KEY,
    fetchHistoryData,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  return {
    dailySummaries: data?.dailySummaries || [],
    prayerTarget: data?.prayerTarget || 15,
    studyTarget: data?.studyTarget || 15,
    userName: data?.userName || 'Believer',
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  }
}

export function invalidateHistoryData() {
  globalMutate(HISTORY_CACHE_KEY)
}
