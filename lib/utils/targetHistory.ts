import { getLocalDateKey } from '@/lib/utils/date'

/**
 * Target History & Historical Consistency Engine
 * 
 * Ensures that whenever a user adjusts their daily target,
 * past days retain the targets that were in effect on those days.
 * Past completed records and streaks are never broken retroactively.
 */

export interface TargetEntry {
  effectiveFrom: string // 'YYYY-MM-DD'
  prayerTarget: number
  studyTarget: number
}

export interface DayTargetResolution {
  prayerTarget: number
  studyTarget: number
  isFixed?: boolean
}

export interface DaySessionMetrics {
  prayerMins?: number
  studyMins?: number
  recordedPrayerTarget?: number
  recordedStudyTarget?: number
  hasCompletedPrayerSession?: boolean
  hasCompletedStudySession?: boolean
}

/**
 * Resolves the prayer & study target for a given dateKey ('YYYY-MM-DD').
 * Uses historical targets if available, or recorded completed dates,
 * guaranteeing future target adjustments do not retroactively alter past records.
 */
export function getTargetsForDate(
  dateKey: string,
  prefs: any,
  defaultPrayer = 15,
  defaultStudy = 15,
  dayMetrics?: DaySessionMetrics
): DayTargetResolution {
  const todayKey = getLocalDateKey()
  const isPastDay = dateKey < todayKey

  if (!prefs) {
    if (dayMetrics && (dayMetrics.recordedPrayerTarget || dayMetrics.recordedStudyTarget)) {
      const pT = dayMetrics.recordedPrayerTarget || defaultPrayer
      const sT = dayMetrics.recordedStudyTarget || defaultStudy
      return { prayerTarget: pT, studyTarget: sT, isFixed: isPastDay }
    }
    return { prayerTarget: defaultPrayer, studyTarget: defaultStudy, isFixed: isPastDay }
  }

  // 1. Check permanently locked/recorded day target (daily_targets, completed_dates, or daily_targets_history)
  const lockedRecord =
    prefs.daily_targets?.[dateKey] ||
    prefs.dailyTargets?.[dateKey] ||
    prefs.completed_dates?.[dateKey] ||
    prefs.completedDates?.[dateKey] ||
    prefs.daily_targets_history?.[dateKey]

  if (lockedRecord) {
    return {
      prayerTarget: lockedRecord.prayerTarget || defaultPrayer,
      studyTarget: lockedRecord.studyTarget || defaultStudy,
      isFixed: true,
    }
  }

  // 2. Check if sessions on this day had explicit targets recorded at session time
  if (dayMetrics && (dayMetrics.recordedPrayerTarget || dayMetrics.recordedStudyTarget)) {
    const pMins = dayMetrics.prayerMins || 0
    const sMins = dayMetrics.studyMins || 0
    const recPrayer = dayMetrics.recordedPrayerTarget || defaultPrayer
    const recStudy = dayMetrics.recordedStudyTarget || defaultStudy

    const prayerMetAtSessionTarget =
      recPrayer > 0 && (dayMetrics.hasCompletedPrayerSession || pMins >= recPrayer)
    const studyMetAtSessionTarget =
      recStudy > 0 && (dayMetrics.hasCompletedStudySession || sMins >= recStudy)

    if (prayerMetAtSessionTarget && studyMetAtSessionTarget) {
      return {
        prayerTarget: recPrayer,
        studyTarget: recStudy,
        isFixed: true,
      }
    }

    if (isPastDay) {
      return {
        prayerTarget: recPrayer,
        studyTarget: recStudy,
        isFixed: true,
      }
    }
  }

  // 3. Check timeline target history (entries with effectiveFrom)
  const history: TargetEntry[] = prefs.target_history || prefs.targetHistory || []
  if (history.length > 0) {
    // Sort ascending by date
    const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))

    // If date is earlier than the earliest entry, it used the baseline/earliest target
    if (dateKey < sorted[0].effectiveFrom) {
      return {
        prayerTarget: sorted[0].prayerTarget || defaultPrayer,
        studyTarget: sorted[0].studyTarget || defaultStudy,
        isFixed: isPastDay,
      }
    }

    let activeEntry: TargetEntry | null = null
    for (const entry of sorted) {
      if (entry.effectiveFrom <= dateKey) {
        activeEntry = entry
      } else {
        break
      }
    }

    if (activeEntry) {
      return {
        prayerTarget: activeEntry.prayerTarget || defaultPrayer,
        studyTarget: activeEntry.studyTarget || defaultStudy,
        isFixed: isPastDay,
      }
    }
  }

  // 4. Fallback for past days: preserve baseline target (e.g. 15m), never retroactively apply new target
  if (isPastDay) {
    return {
      prayerTarget: defaultPrayer,
      studyTarget: defaultStudy,
      isFixed: true,
    }
  }

  // 5. Active target for today or future days from current preferences
  const pTarget =
    prefs.prayerTarget ||
    prefs.targets?.prayer ||
    defaultPrayer
  const sTarget =
    prefs.studyTarget ||
    prefs.wordTarget ||
    prefs.targets?.study ||
    defaultStudy

  return { prayerTarget: pTarget, studyTarget: sTarget, isFixed: false }
}

/**
 * Records a new target change effective from effectiveDate.
 * Preserves past target history, daily_targets, and locked completed dates so past days retain their historical targets.
 */
export function updateTargetHistory(
  prefs: any,
  newPrayerTarget: number,
  newStudyTarget: number,
  effectiveDate: string,
  completedDatesToLock?: Record<string, { prayerTarget: number; studyTarget: number; isFixed?: boolean }>,
  dailyTargetsToLock?: Record<string, { prayerTarget: number; studyTarget: number; isFixed?: boolean }>
): any {
  const currentHistory: TargetEntry[] = [
    ...(prefs?.target_history || prefs?.targetHistory || []),
  ]

  const oldPrayer =
    prefs?.prayerTarget || prefs?.targets?.prayer || 15
  const oldStudy =
    prefs?.studyTarget || prefs?.wordTarget || prefs?.targets?.study || 15

  // If no history exists, seed initial target from the beginning of time
  if (currentHistory.length === 0) {
    currentHistory.push({
      effectiveFrom: '2020-01-01',
      prayerTarget: oldPrayer,
      studyTarget: oldStudy,
    })
  }

  // Remove any existing entry for the exact same effectiveDate
  const filtered = currentHistory.filter((h) => h.effectiveFrom !== effectiveDate)
  filtered.push({
    effectiveFrom: effectiveDate,
    prayerTarget: newPrayerTarget,
    studyTarget: newStudyTarget,
  })

  // Sort ascending
  filtered.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))

  const completed_dates = {
    ...(prefs?.completed_dates || {}),
    ...(prefs?.completedDates || {}),
    ...(completedDatesToLock || {}),
  }

  const daily_targets = {
    ...(prefs?.daily_targets || {}),
    ...(prefs?.dailyTargets || {}),
    ...(dailyTargetsToLock || {}),
    ...completed_dates,
  }

  return {
    ...prefs,
    prayerTarget: newPrayerTarget,
    studyTarget: newStudyTarget,
    wordTarget: newStudyTarget,
    targets: {
      prayer: newPrayerTarget,
      study: newStudyTarget,
      word: newStudyTarget,
    },
    target_history: filtered,
    targetHistory: filtered,
    daily_targets,
    dailyTargets: daily_targets,
    completed_dates,
    completedDates: completed_dates,
  }
}
