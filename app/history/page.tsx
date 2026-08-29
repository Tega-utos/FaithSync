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
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'

interface DailySummary {
  dateKey: string // YYYY-MM-DD
  dateDisplay: string // e.g. "Aug 27"
  isToday: boolean
  prayerMinutes: number
  studyMinutes: number
  prayerTarget: number
  studyTarget: number
  isPrayerMet: boolean
  isStudyMet: boolean
  status: 'Complete' | 'In Progress' | 'Missed'
}

export default function HistoryPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)

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

        // Fetch targets
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single()

        const prefs = (profile?.preferences as any) || {}
        const pTarget = prefs.prayerTarget || prefs.targets?.prayer || 15
        const sTarget = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15
        setPrayerTarget(pTarget)
        setStudyTarget(sTarget)

        // Fetch past 30 days sessions
        const thirtyDaysAgo = getStartOfLocalDay()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

        const { data: sessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds, started_at, created_at')
          .eq('user_id', user.id)
          .gte('started_at', thirtyDaysAgo.toISOString())
          .order('started_at', { ascending: false })

        // Aggregate by day
        const dayMap: Record<string, { prayerSecs: number; studySecs: number }> = {}

        ;(sessions || []).forEach((s) => {
          const rawDate = s.started_at || s.created_at
          const dateKey = getLocalDateKey(rawDate)
          if (!dayMap[dateKey]) {
            dayMap[dateKey] = { prayerSecs: 0, studySecs: 0 }
          }
          if (s.type === 'prayer') {
            dayMap[dateKey].prayerSecs += s.duration_seconds
          } else if (s.type === 'study' || s.type === 'word') {
            dayMap[dateKey].studySecs += s.duration_seconds
          }
        })

        // Build continuous 30-day rows
        const summaries: DailySummary[] = []
        const todayStr = getLocalDateKey()

        for (let i = 0; i < 30; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = getLocalDateKey(d)
          const isToday = key === todayStr

          const display = d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })

          const data = dayMap[key] || { prayerSecs: 0, studySecs: 0 }
          const pMins = Math.floor(data.prayerSecs / 60)
          const sMins = Math.floor(data.studySecs / 60)

          const isPrayerMet = pMins >= pTarget
          const isStudyMet = sMins >= sTarget

          let status: 'Complete' | 'In Progress' | 'Missed' = 'Missed'
          if (isPrayerMet && isStudyMet) {
            status = 'Complete'
          } else if (pMins > 0 || sMins > 0) {
            status = 'In Progress'
          }

          summaries.push({
            dateKey: key,
            dateDisplay: display,
            isToday,
            prayerMinutes: pMins,
            studyMinutes: sMins,
            prayerTarget: pTarget,
            studyTarget: sTarget,
            isPrayerMet,
            isStudyMet,
            status,
          })
        }

        setDailySummaries(summaries)
      } catch (err) {
        console.error('History load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-lg font-bold text-[#0E0E0E]">Devotion Ledger</h1>
        <div className="w-8" />
      </div>

      {/* Hero Stats Card */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-[#0E0E0E]">
          Past 30 Days Record
        </h2>
        <p className="text-xs text-[#707070] leading-relaxed">
          A persistent chronological record of your daily prayer and scripture consistency.
        </p>
      </div>

      {/* Ledger Stream or Loading */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#707070]">
          Loading devotion ledger...
        </div>
      ) : dailySummaries.length === 0 ? (
        <div className="faith-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-bold text-[#0E0E0E]">No logs recorded yet</h3>
          <p className="text-xs text-[#707070]">
            Start your first timer session on the Clock-in screen to begin your consistency log.
          </p>
          <Link href="/clock-in" className="inline-block pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold"
            >
              Clock In Now
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Card List (< 640px) */}
          <div className="block sm:hidden space-y-2.5">
            {dailySummaries.map((day) => (
              <div
                key={day.dateKey}
                onClick={() => router.push(`/session-details/date/${day.dateKey}`)}
                className="faith-card p-3.5 space-y-2.5 hover:border-[#FBBF24]/50 transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#0E0E0E]">
                    <CalendarBlank size={14} className="text-[#9095A1]" />
                    <span>{day.dateDisplay}</span>
                    {day.isToday && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0E0E0E] text-white font-semibold">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {day.status === 'Complete' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#ECFCCB] text-[#15803D] text-[9px] font-extrabold shadow-2xs">
                        Complete
                      </span>
                    ) : day.status === 'In Progress' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[9px] font-bold">
                        In Progress
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[9px] font-bold">
                        Missed
                      </span>
                    )}
                    <CaretRight size={14} className="text-[#9095A1]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F3F4F6]">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[#707070] text-[10px]">Prayer:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        day.isPrayerMet
                          ? 'bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/40'
                          : day.prayerMinutes > 0
                          ? 'bg-[#FAF6EE] text-[#374151] border border-[#E5E7EB]'
                          : 'text-[#9095A1]'
                      }`}
                    >
                      <HandsPraying size={11} weight="fill" />
                      {day.prayerMinutes} / {day.prayerTarget}m
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[#707070] text-[10px]">Study:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        day.isStudyMet
                          ? 'bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/40'
                          : day.studyMinutes > 0
                          ? 'bg-[#FAF6EE] text-[#374151] border border-[#E5E7EB]'
                          : 'text-[#9095A1]'
                      }`}
                    >
                      <BookOpen size={11} />
                      {day.studyMinutes} / {day.studyTarget}m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/Tablet Table (>= 640px) */}
          <div className="hidden sm:block faith-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF6EE] border-b border-[#E5E7EB] text-[10px] uppercase font-bold tracking-wider text-[#707070]">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3">Prayer</th>
                    <th className="py-3 px-3">Study</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F3F4F6] bg-white">
                  {dailySummaries.map((day) => (
                    <tr
                      key={day.dateKey}
                      onClick={() => router.push(`/session-details/date/${day.dateKey}`)}
                      className="hover:bg-[#FAF6EE]/70 transition-colors cursor-pointer group"
                    >
                      {/* 1. Date */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-bold text-[#0E0E0E]">
                        <div className="flex items-center gap-1.5">
                          <CalendarBlank size={14} className="text-[#9095A1]" />
                          <span>{day.dateDisplay}</span>
                          {day.isToday && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0E0E0E] text-white font-semibold">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Prayer Status Pill */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            day.isPrayerMet
                              ? 'bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/40'
                              : day.prayerMinutes > 0
                              ? 'bg-[#FAF6EE] text-[#374151] border border-[#E5E7EB]'
                              : 'text-[#9095A1]'
                          }`}
                        >
                          <HandsPraying size={12} weight="fill" />
                          {day.prayerMinutes} / {day.prayerTarget}m
                        </span>
                      </td>

                      {/* 3. Study Status Pill */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            day.isStudyMet
                              ? 'bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/40'
                              : day.studyMinutes > 0
                              ? 'bg-[#FAF6EE] text-[#374151] border border-[#E5E7EB]'
                              : 'text-[#9095A1]'
                          }`}
                        >
                          <BookOpen size={12} />
                          {day.studyMinutes} / {day.studyTarget}m
                        </span>
                      </td>

                      {/* 4. Overall Status Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {day.status === 'Complete' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#ECFCCB] text-[#15803D] text-[10px] font-extrabold inline-block shadow-sm">
                            Complete
                          </span>
                        ) : day.status === 'In Progress' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold inline-block">
                            In Progress
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold inline-block">
                            Missed
                          </span>
                        )}
                      </td>

                      {/* 5. Action */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-right">
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors">
                          <span>View</span>
                          <CaretRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
