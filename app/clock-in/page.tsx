'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Fire,
  BookOpen,
  Play,
  Pause,
  Square,
  CaretLeft,
  ClockCounterClockwise,
  BookBookmark,
  HandsPraying,
  Sparkle,
  Sliders,
  Clock,
  SpeakerHigh,
  SpeakerSlash,
} from '@phosphor-icons/react'
import { useTimer, TimerSessionData } from '@/context/TimerContext'
import { createClient } from '@/lib/supabase/client'
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal'
import { playChime } from '@/components/audio/Chime'
import {
  PrayerFocusTimelineBuilder,
  TimelineSegment,
} from '@/components/timer/PrayerFocusTimelineBuilder'
import { ClockInTimerDial } from '@/components/timer/ClockInTimerDial'
import { ActiveTimelineFocus } from '@/components/timer/ActiveTimelineFocus'
import {
  startLockScreenSession,
  stopLockScreenSession,
  requestSessionNotificationPermission,
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from '@/lib/sessionLockScreen'

export default function ClockInPage() {
  const router = useRouter()
  const {
    session,
    state,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    setDiscipline,
  } = useTimer()

  const [selectedDiscipline, setSelectedDiscipline] = useState<'prayer' | 'study'>(
    session.discipline === 'study' ? 'study' : 'prayer'
  )
  const [focusMode, setFocusMode] = useState<'quick' | 'timeline'>('quick')
  const [focusInput, setFocusInput] = useState(session.focusText || '')
  const [soundMuted, setSoundMuted] = useState(false)
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([
    {
      id: 'seg-1',
      type: 'scripture',
      durationMinutes: 2,
      reference: 'Psalm 23:1-3',
      versionId: 'web',
    },
    {
      id: 'seg-2',
      type: 'reflection',
      durationMinutes: 3,
      prompt: 'What are you grateful for today?',
    },
    {
      id: 'seg-3',
      type: 'scripture',
      durationMinutes: 2,
      reference: 'Philippians 4:6-7',
      versionId: 'web',
    },
  ])
  const [isTimelineBuilderOpen, setIsTimelineBuilderOpen] = useState(false)

  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<TimerSessionData | null>(null)

  const isRunning = state === 'RUNNING'
  const isPaused = state === 'PAUSED'
  const isTimerActive = isRunning || isPaused

  const timelineTotalMins = timelineSegments.reduce(
    (sum, s) => sum + (s.durationMinutes || 1),
    0
  )

  // Register service worker on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isTimerActive) {
      setDiscipline(selectedDiscipline)
    }
  }, [selectedDiscipline, isTimerActive, setDiscipline])

  // Re-acquire Wake Lock on visibility change if session running
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        requestScreenWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isRunning])

  const activeSessionIdRef = useRef<string | null>(null)

  const handleStart = async () => {
    // Request permission in context
    requestSessionNotificationPermission()

    const targetMinutes = focusMode === 'timeline' ? timelineTotalMins : 15
    const focusText = focusMode === 'timeline' ? `${timelineSegments.length} Guided Segments` : focusInput

    if (focusMode === 'timeline') {
      startTimer(
        selectedDiscipline,
        'stopwatch',
        timelineTotalMins,
        `${timelineSegments.length} Guided Segments`,
        'Seeking',
        'timeline',
        timelineSegments
      )
      startLockScreenSession(timelineSegments[0] || null, selectedDiscipline)
    } else {
      startTimer(
        selectedDiscipline,
        'stopwatch',
        15,
        focusInput,
        'Seeking',
        'quick',
        []
      )
      startLockScreenSession(null, selectedDiscipline)
    }

    // Write active uncompleted session so buddies see live clock-in on chat list
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: activeRow } = await (supabase.from('sessions') as any)
          .insert({
            user_id: user.id,
            type: selectedDiscipline,
            duration_seconds: 0,
            target_duration_seconds: targetMinutes * 60,
            is_complete: false,
            started_at: new Date().toISOString(),
            reflection: focusText || null,
          })
          .select('id')
          .maybeSingle()

        if (activeRow?.id) {
          activeSessionIdRef.current = activeRow.id
        }
      }
    } catch (e) {
      console.warn('Active session write note:', e)
    }
  }

  const handlePause = () => {
    pauseTimer()
    releaseScreenWakeLock()
  }

  const handleResume = () => {
    resumeTimer()
    requestScreenWakeLock()
  }

  const handleEnd = async () => {
    const data = stopTimer()
    setSummaryData(data)
    stopLockScreenSession()
    playChime(soundMuted)
    setShowSummary(true)

    // Immediate database persist to guarantee zero data loss
    if (data && data.secondsElapsed > 0) {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const isComplete =
            data.secondsElapsed >= (data.targetSeconds || 0) && (data.targetSeconds || 0) > 0

          let savedSessionId = activeSessionIdRef.current

          if (savedSessionId) {
            await (supabase.from('sessions') as any)
              .update({
                duration_seconds: data.secondsElapsed,
                target_duration_seconds: data.targetSeconds,
                is_complete: isComplete,
                verse_reference: data.verseReference || null,
                focus_type: data.focusType || 'quick',
                focus_timeline: (data.focusTimeline as any) || null,
                ended_at: data.endedAt || new Date().toISOString(),
              })
              .eq('id', savedSessionId)
          } else {
            const { data: savedSession } = await (supabase.from('sessions') as any)
              .insert({
                user_id: user.id,
                type: data.discipline,
                duration_seconds: data.secondsElapsed,
                target_duration_seconds: data.targetSeconds,
                is_complete: isComplete,
                verse_reference: data.verseReference || null,
                focus_type: data.focusType || 'quick',
                focus_timeline: (data.focusTimeline as any) || null,
                started_at: data.startedAt || new Date().toISOString(),
                ended_at: data.endedAt || new Date().toISOString(),
              })
              .select('id')
              .maybeSingle()
            if (savedSession?.id) {
              savedSessionId = savedSession.id
            }
          }

          activeSessionIdRef.current = null

          if (savedSessionId) {
            setSummaryData((prev) => (prev ? { ...prev, sessionId: savedSessionId } : prev))
          }

          // Invalidate cache immediately so dashboard & momentum rings update without delay
          invalidateMemoryCache()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('faithsync_session_updated'))
          }

          // Credit devotion minutes to user_stats
          const durationMins = Math.floor(data.secondsElapsed / 60)
          if (durationMins > 0) {
            try {
              const { data: currentStats } = await (supabase
                .from('user_stats') as any)
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

              if (currentStats) {
                await (supabase.from('user_stats') as any)
                  .update({
                    total_devotion_mins: (currentStats.total_devotion_mins || 0) + durationMins,
                    total_sessions: (currentStats.total_sessions || 0) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', user.id)
              } else {
                await (supabase.from('user_stats') as any).insert({
                  user_id: user.id,
                  total_devotion_mins: durationMins,
                  total_sessions: 1,
                })
              }
            } catch (statsErr) {
              console.warn('user_stats update note:', statsErr)
            }
          }
        }
      } catch (err) {
        console.error('Error saving ended session to database:', err)
      }
    }
  }



  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-32 sm:pb-36 min-h-[92vh] flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between min-h-[44px]">
        {!isTimerActive ? (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <CaretLeft size={18} />
            <span>Home</span>
          </button>
        ) : (
          <div className="w-16" />
        )}

        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-text-primary">
          {isTimerActive ? (
            <span className="flex items-center gap-1.5 capitalize text-text-primary dark:text-[#F5F1E8]">
              {session.discipline === 'prayer' ? (
                <HandsPraying size={18} weight="fill" className="text-[#FBBF24]" />
              ) : (
                <BookOpen size={18} className="text-[#FBBF24]" />
              )}
              <span className="font-bold">{session.discipline}</span>
            </span>
          ) : (
            'Start Session'
          )}
        </h1>

        {!isTimerActive ? (
          <Link
            href="/history"
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
            title="Session History"
          >
            <ClockCounterClockwise size={18} />
            <span className="hidden sm:inline">History</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setSoundMuted((prev) => !prev)}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
            title={soundMuted ? 'Unmute Chimes' : 'Mute Chimes'}
          >
            {soundMuted ? (
              <SpeakerSlash size={18} className="text-rose-500" />
            ) : (
              <SpeakerHigh size={18} className="text-[#FBBF24]" />
            )}
          </button>
        )}
      </div>

      {/* Pre-Session Setup */}
      {!isTimerActive ? (
        <div className="space-y-3.5 pt-1">
          {/* Mode Selector Toggle (Prayer vs Study) */}
          <div className="p-1 rounded-2xl bg-subtle/60 dark:bg-[#1C1813] border border-border dark:border-[#332E26] grid grid-cols-2 gap-1 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setSelectedDiscipline('prayer')}
              className={`py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                selectedDiscipline === 'prayer'
                  ? 'bg-[#0E0E0E] dark:bg-[#2A241C] dark:border dark:border-[#FBBF24]/50 text-white dark:text-[#F5F1E8] shadow-md'
                  : 'text-text-secondary dark:text-[#A8A29E] hover:text-text-primary dark:hover:text-[#F5F1E8]'
              }`}
            >
              <HandsPraying
                size={16}
                weight="fill"
                className={selectedDiscipline === 'prayer' ? 'text-[#FBBF24]' : 'text-current'}
              />
              <span className={selectedDiscipline === 'prayer' ? 'text-white dark:text-[#F5F1E8] font-bold' : ''}>Prayer</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDiscipline('study')}
              className={`py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                selectedDiscipline === 'study'
                  ? 'bg-[#0E0E0E] dark:bg-[#2A241C] dark:border dark:border-[#FBBF24]/50 text-white dark:text-[#F5F1E8] shadow-md'
                  : 'text-text-secondary dark:text-[#A8A29E] hover:text-text-primary dark:hover:text-[#F5F1E8]'
              }`}
            >
              <BookOpen
                size={16}
                className={selectedDiscipline === 'study' ? 'text-[#FBBF24]' : 'text-current'}
              />
              <span className={selectedDiscipline === 'study' ? 'text-white dark:text-[#F5F1E8] font-bold' : ''}>Study</span>
            </button>
          </div>

          {/* Focus Mode Segmented Toggle (Quick vs Timeline) */}
          <div className="max-w-xs mx-auto space-y-2">
            <div className="p-1 rounded-2xl bg-surface border border-border grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setFocusMode('quick')}
                className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  focusMode === 'quick'
                    ? 'bg-card text-text-primary dark:text-neutral-100 shadow-xs'
                    : 'text-text-secondary dark:text-neutral-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                Quick Focus
              </button>
              <button
                type="button"
                onClick={() => setFocusMode('timeline')}
                className={`py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                  focusMode === 'timeline'
                    ? 'bg-card text-text-primary dark:text-neutral-100 shadow-xs'
                    : 'text-text-secondary dark:text-neutral-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                <Clock size={12} className="text-[#FBBF24]" weight="bold" />
                <span>Timeline</span>
              </button>
            </div>

            {/* Quick Focus input */}
            {focusMode === 'quick' ? (
              <input
                type="text"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                placeholder="What is your focus? (e.g. Romans 12)"
                className="w-full px-4 py-2.5 bg-surface/70 dark:bg-neutral-900/70 border border-border/80 dark:border-white/15 rounded-2xl text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal focus:outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 shadow-xs text-center"
              />
            ) : (
              /* Timeline Builder Trigger Card */
              <div
                onClick={() => setIsTimelineBuilderOpen(true)}
                className="p-3 rounded-2xl bg-[#FDF9F1] dark:bg-[#1E1E1E] border border-[#FBBF24]/40 dark:border-amber-400/40 hover:border-[#FBBF24] cursor-pointer transition-all flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-[#FBBF24] dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkle size={18} weight="fill" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary dark:text-neutral-100">
                      {timelineSegments.length} Guided Segments ({timelineTotalMins}m)
                    </p>
                    <p className="text-[10.5px] text-text-secondary dark:text-neutral-400 font-medium">Tap to customize sequence</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-card dark:bg-[#2A241C] border border-border dark:border-[#FBBF24]/30 text-xs font-bold text-text-primary dark:text-[#F5F1E8] shadow-2xs hover:border-[#FBBF24] transition-all cursor-pointer"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Runtime Focus Display */
        <ActiveTimelineFocus session={session} soundMuted={soundMuted} />
      )}

      {/* Central High-Precision Isolated Circular Timer Dial */}
      <ClockInTimerDial session={session} />

      {/* Controls */}
      <div className="space-y-3 pt-2">
        {!isTimerActive ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleStart}
              className="w-full bg-[#0E0E0E] text-white dark:bg-[#FBBF24] dark:text-[#1A1610] py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 font-extrabold text-base shadow-xl shadow-black/20 dark:shadow-[0_4px_28px_rgba(251,191,36,0.35)] hover:bg-[#1f1f1f] dark:hover:bg-[#F59E0B] active:scale-[0.99] transition-all cursor-pointer border border-black/10 dark:border-[#D97706]/30"
            >
              <Play size={20} weight="fill" className="text-[#FBBF24] dark:text-[#1A1610] shrink-0" />
              <span className="tracking-tight">Start Session</span>
            </button>

            {selectedDiscipline === 'study' && (
              <Link href="/bible" className="block">
                <button
                  type="button"
                  className="w-full bg-card dark:bg-[#1C1813] border border-border dark:border-[#332E26] text-text-primary dark:text-[#F5F1E8] py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:border-[#FBBF24] dark:hover:border-[#FBBF24]/60 transition-all cursor-pointer"
                >
                  <BookBookmark size={18} className="text-[#FBBF24]" />
                  <span>Read Scripture in Bible Reader</span>
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={isRunning ? handlePause : handleResume}
              className="py-4 rounded-2xl bg-card dark:bg-[#1C1813] border border-border dark:border-[#332E26] text-text-primary dark:text-[#F5F1E8] font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-surface dark:hover:bg-[#25201A] transition-all cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Pause size={18} weight="fill" className="text-amber-500" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={18} weight="fill" className="text-amber-500" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleEnd}
              className="py-4 rounded-2xl bg-[#EA2C26] text-white font-bold text-sm shadow-lg shadow-[#EA2C26]/25 flex items-center justify-center gap-2 hover:bg-[#c9221d] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Square size={16} weight="fill" />
              <span>End Session</span>
            </button>
          </div>
        )}
      </div>

      <PrayerFocusTimelineBuilder
        isOpen={isTimelineBuilderOpen}
        onClose={() => setIsTimelineBuilderOpen(false)}
        initialSegments={timelineSegments}
        onApplyTimeline={(segs, totalMins) => {
          setTimelineSegments(segs)
        }}
      />

      <SessionSummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        sessionData={summaryData}
        onSaved={() => {
          setShowSummary(false)
        }}
      />
    </div>
  )
}
