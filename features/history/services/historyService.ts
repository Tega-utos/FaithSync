import { createClient } from '@/lib/supabase/client'
import { getTargetsForDate } from '@/lib/utils/targetHistory'
import { getLocalDateKey } from '@/lib/utils/date'

export interface DailySummary {
  dateKey: string
  dateDisplay: string
  isToday: boolean
  prayerMinutes: number
  studyMinutes: number
  prayerTarget: number
  studyTarget: number
  isPrayerMet: boolean
  isStudyMet: boolean
  status: 'Complete' | 'In Progress' | 'Missed'
}

export async function fetchHistorySummaries(): Promise<DailySummary[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const prefs = (profile?.preferences as any) || {}
  const prayerTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
  const studyTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

  const { data: sessions } = await supabase
    .from('sessions')
    .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const summariesMap: Record<string, { prayerSecs: number; studySecs: number; pTarget: number; sTarget: number; hasP: boolean; hasS: boolean }> = {}

  ;(sessions || []).forEach((s) => {
    const dKey = getLocalDateKey(s.started_at || s.created_at)
    if (!summariesMap[dKey]) {
      summariesMap[dKey] = { prayerSecs: 0, studySecs: 0, pTarget: 0, sTarget: 0, hasP: false, hasS: false }
    }
    if (s.type === 'prayer') {
      summariesMap[dKey].prayerSecs += s.duration_seconds || 0
      if (s.target_duration_seconds) summariesMap[dKey].pTarget = Math.max(summariesMap[dKey].pTarget, Math.round(s.target_duration_seconds / 60))
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) summariesMap[dKey].hasP = true
    }
    if (s.type === 'study' || s.type === 'word') {
      summariesMap[dKey].studySecs += s.duration_seconds || 0
      if (s.target_duration_seconds) summariesMap[dKey].sTarget = Math.max(summariesMap[dKey].sTarget, Math.round(s.target_duration_seconds / 60))
      if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) summariesMap[dKey].hasS = true
    }
  })

  const results: DailySummary[] = []
  const todayKey = getLocalDateKey()

  // Generate 14 days of history
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = getLocalDateKey(d)
    const pMins = Math.floor((summariesMap[key]?.prayerSecs || 0) / 60)
    const sMins = Math.floor((summariesMap[key]?.studySecs || 0) / 60)

    const dayMetrics = {
      prayerMins: pMins,
      studyMins: sMins,
      recordedPrayerTarget: summariesMap[key]?.pTarget || undefined,
      recordedStudyTarget: summariesMap[key]?.sTarget || undefined,
      hasCompletedPrayerSession: summariesMap[key]?.hasP,
      hasCompletedStudySession: summariesMap[key]?.hasS,
    }
    const dayTarget = getTargetsForDate(key, prefs, prayerTarget, studyTarget, dayMetrics)

    const isPrayerMet = pMins >= dayTarget.prayerTarget
    const isStudyMet = sMins >= dayTarget.studyTarget
    const isBothMet = isPrayerMet && isStudyMet
    const isToday = key === todayKey

    let status: DailySummary['status'] = 'Missed'
    if (isBothMet) {
      status = 'Complete'
    } else if (pMins > 0 || sMins > 0 || isToday) {
      status = 'In Progress'
    }

    results.push({
      dateKey: key,
      dateDisplay: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      isToday,
      prayerMinutes: pMins,
      studyMinutes: sMins,
      prayerTarget: dayTarget.prayerTarget,
      studyTarget: dayTarget.studyTarget,
      isPrayerMet,
      isStudyMet,
      status,
    })
  }

  return results
}
