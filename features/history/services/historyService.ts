import { createClient } from '@/lib/supabase/client'

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
    .select('type, duration_seconds, started_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })

  const summariesMap: Record<string, { prayer: number; study: number }> = {}

  ;(sessions || []).forEach((s) => {
    const dKey = new Date(s.started_at).toISOString().split('T')[0]
    if (!summariesMap[dKey]) {
      summariesMap[dKey] = { prayer: 0, study: 0 }
    }
    const mins = Math.floor(s.duration_seconds / 60)
    if (s.type === 'prayer') summariesMap[dKey].prayer += mins
    if (s.type === 'study' || s.type === 'word') summariesMap[dKey].study += mins
  })

  const results: DailySummary[] = []
  const todayKey = new Date().toISOString().split('T')[0]

  // Generate 14 days of history
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const pMins = summariesMap[key]?.prayer || 0
    const sMins = summariesMap[key]?.study || 0
    const isPrayerMet = pMins >= prayerTarget
    const isStudyMet = sMins >= studyTarget
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
      prayerTarget,
      studyTarget,
      isPrayerMet,
      isStudyMet,
      status,
    })
  }

  return results
}
