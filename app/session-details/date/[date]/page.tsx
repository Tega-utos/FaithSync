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
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay, getEndOfLocalDay } from '@/lib/utils/date'

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
          const matching = (data as SessionRecord[]).filter(
            (s) => getLocalDateKey(s.started_at) === dateParam
          )
          setSessions(matching)

          let pSecs = 0
          let sSecs = 0
          matching.forEach((s: any) => {
            if (s.type === 'prayer') pSecs += s.duration_seconds
            if (s.type === 'study' || s.type === 'word') sSecs += s.duration_seconds
          })
          setTotalPrayerSecs(pSecs)
          setTotalStudySecs(sSecs)
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

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.push('/history')}
          className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Ledger</span>
        </button>

        <h1 className="text-lg font-bold text-[#0E0E0E]">Daily Log</h1>
        <div className="w-8" />
      </div>

      {/* Date Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#FBBF24]">
          <CalendarBlank size={16} />
          <span>{formattedDate}</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[#0E0E0E]">
          Day Breakdown
        </h2>
      </div>

      {/* Totals Summary Card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="faith-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] flex items-center gap-1">
            <HandsPraying size={14} weight="fill" className="text-[#FBBF24]" /> Total Prayer
          </span>
          <p className="text-lg font-black font-mono text-[#0E0E0E]">
            {Math.floor(totalPrayerSecs / 60)} mins
          </p>
        </div>

        <div className="faith-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] flex items-center gap-1">
            <BookOpen size={14} className="text-[#FBBF24]" /> Total Study
          </span>
          <p className="text-lg font-black font-mono text-[#0E0E0E]">
            {Math.floor(totalStudySecs / 60)} mins
          </p>
        </div>
      </div>

      {/* Individual Sessions Stream */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#707070]">
          Loading session records...
        </div>
      ) : sessions.length === 0 ? (
        <div className="faith-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-bold text-[#0E0E0E]">No timer activity logged on this day</h3>
          <p className="text-xs text-[#707070]">
            This day was recorded as missed or incomplete in your ledger.
          </p>
          <Link href="/clock-in" className="inline-block pt-2">
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-[#262626] transition-all"
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
            Logged Sessions ({sessions.length})
          </span>

          {sessions.map((s, index) => (
            <div
              key={s.id}
              className="faith-card p-4 space-y-3 border border-[#E5E7EB] hover:border-[#FBBF24]/40 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2">
                  {s.type === 'prayer' ? (
                    <div className="w-7 h-7 rounded-lg bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center font-bold text-xs border border-[#FBBF24]/30">
                      <HandsPraying size={16} weight="fill" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#FBBF24]/15 text-[#FBBF24] flex items-center justify-center font-bold text-xs">
                      <BookOpen size={16} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-[#0E0E0E] capitalize">
                      {s.type} Session #{index + 1}
                    </h4>
                    <span className="text-[10px] font-mono text-[#707070]">
                      Started at {formatTime(s.started_at)}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-black font-mono text-[#0E0E0E] bg-[#FAF6EE] px-2 py-0.5 rounded-lg border border-[#E5E7EB]">
                  {formatDuration(s.duration_seconds)}
                </span>
              </div>

              {/* Reflection / Focus */}
              {s.reflection && (
                <div className="p-3 bg-[#FAF6EE] rounded-xl border-l-2 border-[#FBBF24] text-xs text-[#0E0E0E] italic leading-relaxed">
                  &ldquo;{s.reflection}&rdquo;
                </div>
              )}

              {/* Verse Reference */}
              {s.verse_reference && (
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FBBF24] bg-[#FDF9F1] px-2 py-0.5 rounded-lg border border-[#FBBF24]/30">
                  <BookOpen size={12} />
                  <span>{s.verse_reference}</span>
                </div>
              )}

              {/* Used Timeline Segments */}
              {Array.isArray(s.focus_timeline) && s.focus_timeline.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-[#F3F4F6]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] flex items-center gap-1">
                      <Clock size={12} className="text-[#FBBF24]" />
                      Prayer Focus Timeline ({s.focus_timeline.length} Segments)
                    </span>
                    <span className="text-[9px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] px-1.5 py-0.5 rounded border border-[#FBBF24]/30">
                      {s.focus_timeline.reduce((sum, seg) => sum + (seg.durationMinutes || 1), 0)}m Guided
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-2 border-l-2 border-[#E5E7EB]">
                    {s.focus_timeline.map((seg, sIdx) => (
                      <div
                        key={seg.id || sIdx}
                        className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] space-y-1 text-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold">
                            {seg.type === 'scripture' ? (
                              <>
                                <BookOpen size={13} className="text-[#FBBF24]" weight="fill" />
                                <span className="text-[#0E0E0E] text-[11px]">
                                  {seg.reference || 'Scripture Passage'}
                                </span>
                                {seg.versionId && (
                                  <span className="text-[9px] font-mono uppercase bg-[#F3F4F6] text-[#707070] px-1 rounded">
                                    {seg.versionId}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <Sparkle size={13} className="text-rose-500" weight="fill" />
                                <span className="text-[#0E0E0E] text-[11px]">Reflection Prompt</span>
                              </>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-[#707070] font-semibold">
                            {seg.durationMinutes || 1} min
                          </span>
                        </div>

                        {seg.type === 'scripture' && seg.verseText && (
                          <p className="text-[11px] text-[#707070] italic leading-snug line-clamp-2">
                            &ldquo;{seg.verseText}&rdquo;
                          </p>
                        )}

                        {seg.type === 'reflection' && seg.prompt && (
                          <p className="text-[11px] text-[#0E0E0E] italic leading-snug">
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
