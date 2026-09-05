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
  if (!prefs) {
    if (dayMetrics) {
      const pT = dayMetrics.recordedPrayerTarget || defaultPrayer
      const sT = dayMetrics.recordedStudyTarget || defaultStudy
      return { prayerTarget: pT, studyTarget: sT }
    }
    return { prayerTarget: defaultPrayer, studyTarget: defaultStudy }
  }

  // 1. Check permanently locked/recorded day target (completed_dates or daily_targets_history)
  if (prefs.completed_dates?.[dateKey]) {
    const record = prefs.completed_dates[dateKey]
    return {
      prayerTarget: record.prayerTarget || defaultPrayer,
      studyTarget: record.studyTarget || defaultStudy,
      isFixed: true,
    }
  }

  if (prefs.daily_targets_history?.[dateKey]) {
    const record = prefs.daily_targets_history[dateKey]
    return {
      prayerTarget: record.prayerTarget || defaultPrayer,
      studyTarget: record.studyTarget || defaultStudy,
      isFixed: true,
    }
  }

  // 2. Check if sessions on this day had explicit targets and were completed/met
  if (dayMetrics) {
    const pMins = dayMetrics.prayerMins || 0
    const sMins = dayMetrics.studyMins || 0
    const recPrayer = dayMetrics.recordedPrayerTarget
    const recStudy = dayMetrics.recordedStudyTarget

    const prayerMetAtSessionTarget =
      recPrayer && recPrayer > 0 && (dayMetrics.hasCompletedPrayerSession || pMins >= recPrayer)
    const studyMetAtSessionTarget =
      recStudy && recStudy > 0 && (dayMetrics.hasCompletedStudySession || sMins >= recStudy)

    // If both were met based on the session's recorded target at the time, lock it in
    if (prayerMetAtSessionTarget && studyMetAtSessionTarget) {
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
      }
    }
  }

  // 4. If this day achieved at least the baseline targets (e.g. 15m),
  // ensure future target adjustments (e.g. 30m) don't retroactively mark a completed past day as incomplete
  if (dayMetrics) {
    const pMins = dayMetrics.prayerMins || 0
    const sMins = dayMetrics.studyMins || 0
    const basePrayer = dayMetrics.recordedPrayerTarget || 15
    const baseStudy = dayMetrics.recordedStudyTarget || 15

    if (pMins >= basePrayer && sMins >= baseStudy) {
      return {
        prayerTarget: basePrayer,
        studyTarget: baseStudy,
        isFixed: true,
      }
    }
  }

  // 5. Fallback to current preferences target
  const pTarget =
    prefs.prayerTarget ||
    prefs.targets?.prayer ||
    defaultPrayer
  const sTarget =
    prefs.studyTarget ||
    prefs.wordTarget ||
    prefs.targets?.study ||
    defaultStudy

  return { prayerTarget: pTarget, studyTarget: sTarget }
}

/**
 * Records a new target change effective from effectiveDate.
 * Preserves past target history and locked completed dates so past days retain their historical targets.
 */
export function updateTargetHistory(
  prefs: any,
  newPrayerTarget: number,
  newStudyTarget: number,
  effectiveDate: string,
  completedDatesToLock?: Record<string, { prayerTarget: number; studyTarget: number }>
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
    ...(completedDatesToLock || {}),
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
    completed_dates,
    completedDates: completed_dates,
  }
}
