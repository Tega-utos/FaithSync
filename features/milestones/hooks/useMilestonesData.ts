'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { calculateUserStreak } from '@/lib/utils/streak'

export const MILESTONES_CACHE_KEY = 'milestones_data'

export interface MilestoneStats {
  completedSessions: number
  totalMinutes: number
  currentStreakDays: number
  prayerMinutes: number
  studyMinutes: number
}

const defaultStats: MilestoneStats = {
  completedSessions: 0,
  totalMinutes: 0,
  currentStreakDays: 0,
  prayerMinutes: 0,
  studyMinutes: 0,
}

export async function fetchMilestonesData(): Promise<MilestoneStats | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: allSessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  if (!allSessions || allSessions.length === 0) {
    const realStreak = await calculateUserStreak(user.id, supabase)
    return {
      ...defaultStats,
      currentStreakDays: realStreak,
    }
  }

  const verifiedSessions = allSessions.filter(
    (s) =>
      s.is_complete ||
      (s.duration_seconds > 0 &&
        s.duration_seconds >= (s.target_duration_seconds || 0))
  )

  let totalPrayerSecs = 0
  let totalStudySecs = 0

  verifiedSessions.forEach((s) => {
    if (s.type === 'prayer') {
      totalPrayerSecs += s.duration_seconds
    }
    if (s.type === 'study' || s.type === 'word') {
      totalStudySecs += s.duration_seconds
    }
  })

  const pMins = Math.floor(totalPrayerSecs / 60)
  const sMins = Math.floor(totalStudySecs / 60)
  const totMins = pMins + sMins
  const realStreak = await calculateUserStreak(user.id, supabase)

  return {
    completedSessions: verifiedSessions.length,
    totalMinutes: totMins,
    currentStreakDays: realStreak,
    prayerMinutes: pMins,
    studyMinutes: sMins,
  }
}

export function useMilestonesData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<MilestoneStats | null>(
    MILESTONES_CACHE_KEY,
    fetchMilestonesData,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  return {
    stats: data || defaultStats,
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  }
}

export function invalidateMilestonesData() {
  globalMutate(MILESTONES_CACHE_KEY)
}
