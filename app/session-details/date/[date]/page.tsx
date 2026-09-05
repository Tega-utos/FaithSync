'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  Fire,
  BookOpen,
  CalendarBlank,
  Clock,
  ChatCenteredText,
  Sparkle,
  Trophy,
  HandsPraying,
  Check,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay, getEndOfLocalDay } from '@/lib/utils/date'
import { getTargetsForDate } from '@/lib/utils/targetHistory'

interface SessionRecord {
  id: string
  type: string
  duration_seconds: number
  started_at: string
  reflection?: string | null
  reflection_text?: string | null
  verse_reference?: string | null
  focus_timeline?: Array<{
    id?: string
    type: 'scripture' | 'reflection'
    durationMinutes?: number
    title?: string
    reference?: string
    verseReference?: string
    versionId?: string
    verseText?: string
    prompt?: string
    reflectionPrompt?: string
    notes?: string
  }> | null
}

export default function DateSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const dateParam = params?.date as string // YYYY-MM-DD

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [totalPrayerSecs, setTotalPrayerSecs] = useState(0)
  const [totalStudySecs, setTotalStudySecs] = useState(0)
  const [dayTarget, setDayTarget] = useState({ prayerTarget: 15, studyTarget: 15 })

  useEffect(() => {
    async function loadDateSessions() {
      if (!dateParam) return

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch preferences for historical target resolution
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single()

        const prefs = (profile?.preferences as any) || {}
        const defaultPrayer = prefs.prayerTarget || prefs.targets?.prayer || 15
        const defaultStudy = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15

        // Local date bounds covering the entire 24h of the local day
        const localDayDate = new Date(`${dateParam}T12:00:00`)
        const start = getStartOfLocalDay(localDayDate)
        const end = getEndOfLocalDay(localDayDate)

        const { data } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', start.toISOString())
          .lte('started_at', end.toISOString())
          .order('started_at', { ascending: true })

        if (data) {
          const matching = (data as any[]).filter(
            (s) => getLocalDateKey(s.started_at) === dateParam
          )
          setSessions(matching)

          let pSecs = 0
          let sSecs = 0
          let recPTarget = 0
          let recSTarget = 0
          let hasPComp = false
          let hasSComp = false

          matching.forEach((s: any) => {
            if (s.type === 'prayer') {
              pSecs += s.duration_seconds || 0
              if (s.target_duration_seconds) {
                recPTarget = Math.max(recPTarget, Math.round(s.target_duration_seconds / 60))
              }
              if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
                hasPComp = true
              }
            }
            if (s.type === 'study' || s.type === 'word') {
              sSecs += s.duration_seconds || 0
              if (s.target_duration_seconds) {
                recSTarget = Math.max(recSTarget, Math.round(s.target_duration_seconds / 60))
              }
              if (s.is_complete || (s.duration_seconds > 0 && s.duration_seconds >= (s.target_duration_seconds || 0))) {
                hasSComp = true
              }
            }
          })
          setTotalPrayerSecs(pSecs)
          setTotalStudySecs(sSecs)

          const dayMetrics = {
            prayerMins: Math.floor(pSecs / 60),
            studyMins: Math.floor(sSecs / 60),
            recordedPrayerTarget: recPTarget || undefined,
            recordedStudyTarget: recSTarget || undefined,
            hasCompletedPrayerSession: hasPComp,
            hasCompletedStudySession: hasSComp,
          }

          const targetRes = getTargetsForDate(dateParam, prefs, defaultPrayer, defaultStudy, dayMetrics)
          setDayTarget({
            prayerTarget: targetRes.prayerTarget,
            studyTarget: targetRes.studyTarget,
          })
        }
      } catch (err) {
        console.error('Failed to load date details:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDateSessions()
  }, [dateParam])

  const formattedDate = dateParam
    ? new Date(`${dateParam}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins}m ${remSecs > 0 ? `${remSecs}s` : ''}`
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const prayerMins = Math.floor(totalPrayerSecs / 60)
  const studyMins = Math.floor(totalStudySecs / 60)
  const isComplete = prayerMins >= dayTarget.prayerTarget && studyMins >= dayTarget.studyTarget

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => router.push('/history')}
          className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Ledger</span>
        </button>

        <h1 className="text-lg font-bold text-text-primary">Daily Log</h1>
        <div className="w-8" />
      </div>

      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FBBF24]">
            <CalendarBlank size={16} />
            <span>{formattedDate}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            Day Breakdown
          </h2>
        </div>

        {isComplete ? (
          <span className="px-2.5 py-1 rounded-full bg-[#ECFCCB] text-[#15803D] text-[11px] font-black inline-flex items-center gap-1 shadow-2xs">
            <Check size={12} weight="bold" /> Complete
          </span>
        ) : totalPrayerSecs > 0 || totalStudySecs > 0 ? (
          <span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-bold inline-block">
            In Progress
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[11px] font-bold inline-block opacity-75">
            Missed
          </span>
        )}
      </div>

      {/* Totals Summary Card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="faith-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
            <HandsPraying size={14} weight="fill" className="text-[#FBBF24]" /> Total Prayer
          </span>
          <p className="text-lg font-black font-mono text-text-primary">
            {prayerMins} <span className="text-xs font-normal text-text-secondary">/ {dayTarget.prayerTarget}m</span>
          </p>
        </div>

        <div className="faith-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
            <BookOpen size={14} className="text-[#FBBF24]" /> Total Study
          </span>
          <p className="text-lg font-black font-mono text-text-primary">
            {studyMins} <span className="text-xs font-normal text-text-secondary">/ {dayTarget.studyTarget}m</span>
          </p>
        </div>
      </div>

      {/* Individual Sessions Stream */}
      {loading ? (
        <div className="py-20 text-center text-xs text-text-secondary">
          Loading session records...
        </div>
      ) : sessions.length === 0 ? (
        <div className="faith-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No timer activity logged on this day</h3>
          <p className="text-xs text-text-secondary">
            This day was recorded as missed or incomplete in your ledger.
          </p>
          <Link href="/clock-in" className="inline-block pt-2">
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-[#262626] dark:hover:bg-white/80 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/icon-timer-active.svg"
                alt="Clock In"
                width={16}
                height={16}
                className="w-4 h-4 object-contain"
              />
              <span>Clock In Today</span>
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
            Logged Sessions ({sessions.length})
          </span>

          {sessions.map((s, index) => (
            <div
              key={s.id}
              className="faith-card p-4 space-y-3 border border-border hover:border-[#FBBF24]/40 dark:border-amber-500/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  {s.type === 'prayer' ? (
                    <div className="w-7 h-7 rounded-lg bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center font-bold text-xs border border-[#FBBF24]/30 dark:border-amber-500/25">
                      <HandsPraying size={16} weight="fill" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#FBBF24]/15 dark:bg-amber-500/20 text-[#FBBF24] flex items-center justify-center font-bold text-xs">
                      <BookOpen size={16} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-text-primary capitalize">
                      {s.type} Session #{index + 1}
                    </h4>
                    <span className="text-[10px] font-mono text-text-secondary">
                      Started at {formatTime(s.started_at)}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-black font-mono text-text-primary bg-surface px-2 py-0.5 rounded-lg border border-border">
                  {formatDuration(s.duration_seconds)}
                </span>
              </div>

              {/* Reflection / Focus */}
              {s.reflection && (
                <div className="p-3 bg-surface rounded-xl border-l-2 border-[#FBBF24] text-xs text-text-primary italic leading-relaxed">
                  &ldquo;{s.reflection}&rdquo;
                </div>
              )}

              {/* Verse Reference */}
              {s.verse_reference && (
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FBBF24] bg-[#FDF9F1] dark:bg-amber-950/30 px-2 py-0.5 rounded-lg border border-[#FBBF24]/30 dark:border-amber-500/25">
                  <BookOpen size={12} />
                  <span>{s.verse_reference}</span>
                </div>
              )}

              {/* Used Timeline Segments */}
              {Array.isArray(s.focus_timeline) && s.focus_timeline.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-border-light">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                      <Clock size={12} className="text-[#FBBF24]" />
                      Prayer Focus Timeline ({s.focus_timeline.length} Segments)
                    </span>
                    <span className="text-[9px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-[#FBBF24]/30 dark:border-amber-500/25">
                      {s.focus_timeline.reduce((sum, seg) => sum + (seg.durationMinutes || 1), 0)}m Guided
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-2 border-l-2 border-border">
                    {s.focus_timeline.map((seg, sIdx) => (
                      <div
                        key={seg.id || sIdx}
                        className="p-2.5 rounded-xl bg-card border border-border space-y-1 text-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold">
                            {seg.type === 'scripture' ? (
                              <>
                                <BookOpen size={13} className="text-[#FBBF24]" weight="fill" />
                                <span className="text-text-primary text-[11px]">
                                  {seg.reference || 'Scripture Passage'}
                                </span>
                                {seg.versionId && (
                                  <span className="text-[9px] font-mono uppercase bg-subtle text-text-secondary px-1 rounded">
                                    {seg.versionId}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <Sparkle size={13} className="text-rose-500" weight="fill" />
                                <span className="text-text-primary text-[11px]">Reflection Prompt</span>
                              </>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-text-secondary font-semibold">
                            {seg.durationMinutes || 1} min
                          </span>
                        </div>

                        {seg.type === 'scripture' && seg.verseText && (
                          <p className="text-[11px] text-text-secondary italic leading-snug line-clamp-2">
                            &ldquo;{seg.verseText}&rdquo;
                          </p>
                        )}

                        {seg.type === 'reflection' && seg.prompt && (
                          <p className="text-[11px] text-text-primary italic leading-snug">
                            &ldquo;{seg.prompt}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
