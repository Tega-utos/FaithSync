'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Clock,
  CaretRight,
  Fire,
  BookOpen,
  CalendarBlank,
  Sparkle,
  HandsPraying,
  Printer,
  FileText,
  Check,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'
import { getMemoryCache, setMemoryCache } from '@/lib/cache/clientCache'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

interface DailySummary {
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

export default function HistoryPage() {
  const router = useRouter()

  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>(() => {
    return getMemoryCache<DailySummary[]>('history_summaries') || []
  })
  const [loading, setLoading] = useState(() => {
    return !getMemoryCache<DailySummary[]>('history_summaries')
  })
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)
  const [userName, setUserName] = useState('Believer')

  useEffect(() => {
    async function loadHistory() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch user display name
        setUserName(
          user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            'Believer'
        )

        // Fetch targets
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, preferences')
          .eq('id', user.id)
          .single()

        if (profile?.display_name) {
          setUserName(profile.display_name)
        }

        const prefs = (profile?.preferences as any) || {}
        const pTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
        const sTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15
        setPrayerTarget(pTarget)
        setStudyTarget(sTarget)

        // Fetch past 30 days sessions with full target & completion metadata
        const thirtyDaysAgo = getStartOfLocalDay()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
          .eq('user_id', user.id)
          .gte('started_at', thirtyDaysAgo.toISOString())
          .order('started_at', { ascending: false })

        // Aggregate by day
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

        // Build continuous 30-day rows
        const summaries: DailySummary[] = []
        const todayStr = getLocalDateKey()
        const newCompletedToSync: Record<string, { prayerTarget: number; studyTarget: number; isFixed?: boolean }> = {}

        for (let i = 0; i < 30; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = getLocalDateKey(d)
          const isToday = key === todayStr

          const display = d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
          })

          const data = dayMap[key] || {
            prayerSecs: 0,
            studySecs: 0,
            prayerTargetSecs: 0,
            studyTargetSecs: 0,
            hasCompletedPrayerSession: false,
            hasCompletedStudySession: false,
          }
          const pMins = Math.floor(data.prayerSecs / 60)
          const sMins = Math.floor(data.studySecs / 60)
          const totalMins = pMins + sMins

          const dayDataMetrics = {
            prayerMins: pMins,
            studyMins: sMins,
            recordedPrayerTarget: data.prayerTargetSecs > 0 ? Math.round(data.prayerTargetSecs / 60) : undefined,
            recordedStudyTarget: data.studyTargetSecs > 0 ? Math.round(data.studyTargetSecs / 60) : undefined,
            hasCompletedPrayerSession: data.hasCompletedPrayerSession,
            hasCompletedStudySession: data.hasCompletedStudySession,
          }

          // Resolve historical target for this exact date (prioritizes locked/met records)
          const dayTarget = getTargetsForDate(key, prefs, pTarget, sTarget, dayDataMetrics)
          const isPrayerMet = pMins >= dayTarget.prayerTarget
          const isStudyMet = sMins >= dayTarget.studyTarget

          let status: 'Complete' | 'In Progress' | 'Missed' = 'Missed'
          if (isPrayerMet && isStudyMet) {
            status = 'Complete'
            if (!prefs.completed_dates?.[key]) {
              newCompletedToSync[key] = {
                prayerTarget: dayTarget.prayerTarget,
                studyTarget: dayTarget.studyTarget,
                isFixed: true,
              }
            }
          } else if (pMins > 0 || sMins > 0) {
            status = 'In Progress'
          }

          summaries.push({
            dateKey: key,
            dateDisplay: display,
            isToday,
            prayerMinutes: pMins,
            studyMinutes: sMins,
            totalMinutes: totalMins,
            prayerTarget: dayTarget.prayerTarget,
            studyTarget: dayTarget.studyTarget,
            isPrayerMet,
            isStudyMet,
            status,
          })
        }

        setDailySummaries(summaries)
        setMemoryCache('history_summaries', summaries)

        // If newly discovered completed days were not locked in preferences, sync them silently
        if (Object.keys(newCompletedToSync).length > 0) {
          const mergedCompleted = {
            ...(prefs.completed_dates || {}),
            ...newCompletedToSync,
          }
          supabase
            .from('profiles')
            .update({
              preferences: {
                ...prefs,
                completed_dates: mergedCompleted,
                completedDates: mergedCompleted,
              },
            })
            .eq('id', user.id)
            .then(() => {})
        }
      } catch (err) {
        console.error('History load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const completedDays = dailySummaries.filter((d) => d.status === 'Complete').length
  const totalMinsMonth = dailySummaries.reduce((sum, d) => sum + d.totalMinutes, 0)

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4 print:p-0 print:m-0 print:max-w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border print:hidden">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary tracking-tight">Devotion Ledger</h1>

        <button
          type="button"
          onClick={handlePrint}
          className="px-3 py-1.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          title="Print Devotion Ledger / Export PDF"
        >
          <Printer size={15} className="text-[#FBBF24]" weight="bold" />
          <span>Print</span>
        </button>
      </div>

      {/* Print Document Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 text-center border-b pb-4">
        <h1 className="text-2xl font-black tracking-tight text-black">FaithSync Devotion Ledger</h1>
        <p className="text-sm text-text-secondary mt-1">
          Spiritual Walk Record for <span className="font-bold">{userName}</span> • Past 30 Days
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          Printed on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Summary Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3">
        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Completed Days
          </span>
          <p className="text-lg font-black text-text-primary font-mono-tabular">
            {completedDays} <span className="text-xs font-normal text-text-secondary">/ 30 days</span>
          </p>
        </div>

        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Total Devotion Time
          </span>
          <p className="text-lg font-black text-text-primary font-mono-tabular">
            {Math.floor(totalMinsMonth / 60)}h {totalMinsMonth % 60}m
          </p>
        </div>

        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Daily Targets Set
          </span>
          <p className="text-xs font-bold text-text-primary pt-1 flex items-center gap-2">
            <span className="text-[#FBBF24]">🙏 {prayerTarget}m Prayer</span>
            <span className="text-[#234537] dark:text-emerald-400">📖 {studyTarget}m Study</span>
          </p>
        </div>
      </div>

      {/* Horizontal Scroll Hint (Mobile only) */}
      <div className="flex items-center justify-between text-[11px] text-text-secondary px-1 print:hidden">
        <span className="font-medium flex items-center gap-1">
          <FileText size={14} className="text-[#FBBF24]" />
          <span>Spreadsheet Ledger (Past 30 Days)</span>
        </span>
        <span className="text-[10px] text-text-muted sm:hidden">
          👉 Scroll horizontally
        </span>
      </div>

      {/* Ledger Spreadsheet or Loading */}
      {loading ? (
        <div className="py-20 text-center text-xs text-text-secondary">
          Loading devotion spreadsheet...
        </div>
      ) : dailySummaries.length === 0 ? (
        <div className="faith-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No logs recorded yet</h3>
          <p className="text-xs text-text-secondary">
            Start your first timer session on the Clock-in screen to begin your consistency log.
          </p>
          <Link href="/clock-in" className="inline-block pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] text-xs font-bold"
            >
              Clock In Now
            </button>
          </Link>
        </div>
      ) : (
        /* Unified Horizontal-Scroll Excel-Style Spreadsheet Table */
        <div className="faith-card overflow-hidden shadow-sm bg-card border border-border print:border-black print:shadow-none">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[580px] print:min-w-full">
              <thead>
                <tr className="bg-surface border-b border-border text-[10px] uppercase font-black tracking-wider text-text-secondary print:bg-gray-100 print:text-black">
                  <th className="py-3 px-3.5 border-r border-border/70">Date</th>
                  <th className="py-3 px-3.5 border-r border-border/70">Prayer Time</th>
                  <th className="py-3 px-3.5 border-r border-border/70">Study Time</th>
                  <th className="py-3 px-3.5 border-r border-border/70 text-center">Total</th>
                  <th className="py-3 px-3.5 border-r border-border/70 text-center">Daily Status</th>
                  <th className="py-3 px-3 text-right print:hidden">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-light bg-card print:divide-gray-300">
                {dailySummaries.map((day, idx) => (
                  <tr
                    key={day.dateKey}
                    onClick={() => router.push(`/session-details/date/${day.dateKey}`)}
                    className={`hover:bg-surface/80 transition-colors cursor-pointer group print:hover:bg-transparent ${
                      idx % 2 === 1 ? 'bg-surface/20' : 'bg-card'
                    }`}
                  >
                    {/* 1. Date Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-bold text-text-primary border-r border-border-light">
                      <div className="flex items-center gap-1.5">
                        <CalendarBlank size={14} className="text-text-muted shrink-0" />
                        <span>{day.dateDisplay}</span>
                        {day.isToday && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold shrink-0">
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Prayer Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          day.isPrayerMet
                            ? 'bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/40 dark:border-amber-500/30 font-black'
                            : day.prayerMinutes > 0
                            ? 'bg-surface text-text-primary border border-border'
                            : 'text-text-muted'
                        }`}
                      >
                        <HandsPraying size={12} weight="fill" />
                        <span>{day.prayerMinutes} / {day.prayerTarget}m</span>
                      </span>
                    </td>

                    {/* 3. Study Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          day.isStudyMet
                            ? 'bg-[#EBF3EE] dark:bg-emerald-950/30 text-[#234537] dark:text-emerald-400 border border-[#234537]/30 dark:border-emerald-700/35 font-black'
                            : day.studyMinutes > 0
                            ? 'bg-surface text-text-primary border border-border'
                            : 'text-text-muted'
                        }`}
                      >
                        <BookOpen size={12} weight="fill" />
                        <span>{day.studyMinutes} / {day.studyTarget}m</span>
                      </span>
                    </td>

                    {/* 4. Total Minutes Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light text-center font-mono-tabular font-bold text-xs text-text-primary">
                      {day.totalMinutes > 0 ? `${day.totalMinutes}m` : '—'}
                    </td>

                    {/* 5. Daily Status Badge */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light text-center">
                      {day.status === 'Complete' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ECFCCB] text-[#15803D] text-[10px] font-black inline-flex items-center gap-1 shadow-2xs">
                          <Check size={11} weight="bold" /> Complete
                        </span>
                      ) : day.status === 'In Progress' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold inline-block">
                          In Progress
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold inline-block opacity-75">
                          Missed
                        </span>
                      )}
                    </td>

                    {/* 6. Action Cell */}
                    <td className="py-3 px-3 whitespace-nowrap text-right print:hidden">
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors">
                        <span>Details</span>
                        <CaretRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
