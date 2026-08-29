'use client'

import React, { useState, useEffect } from 'react'
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
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal'
import { playChime } from '@/components/audio/Chime'
import {
  PrayerFocusTimelineBuilder,
  TimelineSegment,
} from '@/components/timer/PrayerFocusTimelineBuilder'
import { ScriptureText } from '@/components/scripture/ScriptureText'
import {
  startLockScreenSession,
  stopLockScreenSession,
  onTimelineSegmentChanged,
  requestSessionNotificationPermission,
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from '@/lib/sessionLockScreen'

const DASH_ARRAY = 565.48 // 2 * PI * 90

export default function ClockInPage() {
  const router = useRouter()
  const {
    session,
    state,
    formattedTime,
    progressPercentage,
    lapNumber,
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

  const handleStart = async () => {
    // Request permission in context
    requestSessionNotificationPermission()

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
  }

  const handlePause = () => {
    pauseTimer()
    releaseScreenWakeLock()
  }

  const handleResume = () => {
    resumeTimer()
    requestScreenWakeLock()
  }

  const handleEnd = () => {
    const data = stopTimer()
    setSummaryData(data)
    stopLockScreenSession()
    playChime(soundMuted)
    setShowSummary(true)
  }

  const strokeOffset = DASH_ARRAY - (progressPercentage / 100) * DASH_ARRAY
  const isPastLap1 = lapNumber > 1

  // Runtime Timeline Computation
  const activeTimeline = session.focusTimeline || []
  const isTimelineSession = session.focusType === 'timeline' && activeTimeline.length > 0

  let currentSegment: TimelineSegment | null = null
  let currentSegmentIndex = -1
  let segmentElapsedSecs = 0
  let segmentTotalSecs = 0
  let isFreePrayerPastTimeline = false

  if (isTimelineSession) {
    let accumulatedSecs = 0
    for (let i = 0; i < activeTimeline.length; i++) {
      const segSecs = (activeTimeline[i].durationMinutes || 1) * 60
      if (
        session.secondsElapsed >= accumulatedSecs &&
        session.secondsElapsed < accumulatedSecs + segSecs
      ) {
        currentSegment = activeTimeline[i]
        currentSegmentIndex = i
        segmentElapsedSecs = session.secondsElapsed - accumulatedSecs
        segmentTotalSecs = segSecs
        break
      }
      accumulatedSecs += segSecs
    }

    if (!currentSegment && session.secondsElapsed >= accumulatedSecs) {
      isFreePrayerPastTimeline = true
    }
  }

  // Segment Transition Handler (Audio Chime + Lock-Screen Media + OS Notification)
  const prevSegmentIndexRef = React.useRef<number>(-1)
  useEffect(() => {
    if (isTimelineSession && isRunning) {
      if (prevSegmentIndexRef.current !== currentSegmentIndex) {
        // Segment transitioned
        if (prevSegmentIndexRef.current !== -1) {
          onTimelineSegmentChanged(currentSegment, soundMuted, session.discipline)
        }
        prevSegmentIndexRef.current = currentSegmentIndex
      }
    }
  }, [currentSegmentIndex, isTimelineSession, isRunning, currentSegment, soundMuted, session.discipline])

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-24 min-h-[92vh] flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between min-h-[44px]">
        {!isTimerActive ? (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <CaretLeft size={18} />
            <span>Home</span>
          </button>
        ) : (
          <div className="w-16" />
        )}

        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0E0E0E]">
          {isTimerActive ? (
            <span className="flex items-center gap-1.5 capitalize text-[#0E0E0E]">
              {session.discipline === 'prayer' ? (
                <HandsPraying size={18} weight="fill" className="text-[#FBBF24]" />
              ) : (
                <BookOpen size={18} className="text-[#FBBF24]" />
              )}
              <span>{session.discipline}</span>
            </span>
          ) : (
            'Start Session'
          )}
        </h1>

        {!isTimerActive ? (
          <Link
            href="/history"
            className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
            title="Session History"
          >
            <ClockCounterClockwise size={18} />
            <span className="hidden sm:inline">History</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setSoundMuted((prev) => !prev)}
            className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
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
          <div className="p-1 rounded-2xl bg-[#F3F4F6]/60 border border-[#E5E7EB] grid grid-cols-2 gap-1 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setSelectedDiscipline('prayer')}
              className={`py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                selectedDiscipline === 'prayer'
                  ? 'bg-[#0E0E0E] text-white shadow-md'
                  : 'text-[#707070] hover:text-[#0E0E0E]'
              }`}
            >
              <HandsPraying
                size={16}
                weight="fill"
                className={selectedDiscipline === 'prayer' ? 'text-[#FBBF24]' : 'text-current'}
              />
              <span>Prayer</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDiscipline('study')}
              className={`py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                selectedDiscipline === 'study'
                  ? 'bg-[#0E0E0E] text-white shadow-md'
                  : 'text-[#707070] hover:text-[#0E0E0E]'
              }`}
            >
              <BookOpen
                size={16}
                className={selectedDiscipline === 'study' ? 'text-[#FBBF24]' : 'text-current'}
              />
              <span>Study</span>
            </button>
          </div>

          {/* Focus Mode Segmented Toggle (Quick vs Timeline) */}
          <div className="max-w-xs mx-auto space-y-2">
            <div className="p-1 rounded-2xl bg-[#FAF6EE] border border-[#E5E7EB] grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setFocusMode('quick')}
                className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  focusMode === 'quick'
                    ? 'bg-white text-[#0E0E0E] shadow-xs'
                    : 'text-[#707070] hover:text-[#0E0E0E]'
                }`}
              >
                Quick Focus
              </button>
              <button
                type="button"
                onClick={() => setFocusMode('timeline')}
                className={`py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                  focusMode === 'timeline'
                    ? 'bg-white text-[#0E0E0E] shadow-xs'
                    : 'text-[#707070] hover:text-[#0E0E0E]'
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
                className="w-full px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] shadow-xs text-center"
              />
            ) : (
              /* Timeline Builder Trigger Card */
              <div
                onClick={() => setIsTimelineBuilderOpen(true)}
                className="p-3 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/40 hover:border-[#FBBF24] cursor-pointer transition-all flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Sparkle size={16} weight="fill" className="text-[#FBBF24]" />
                  <div>
                    <p className="text-xs font-bold text-[#0E0E0E]">
                      {timelineSegments.length} Guided Segments ({timelineTotalMins}m)
                    </p>
                    <p className="text-[10px] text-[#707070]">Tap to customize sequence</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-xl bg-white border border-[#E5E7EB] text-[10px] font-bold text-[#0E0E0E]"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Runtime Focus Display */
        <div className="px-4 py-2 max-w-sm mx-auto w-full">
          {isTimelineSession ? (
            isFreePrayerPastTimeline ? (
              <div className="p-3.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/30 text-center space-y-1 animate-in fade-in">
                <span className="text-[10px] font-bold uppercase text-[#FBBF24] tracking-wider">
                  Timeline Complete
                </span>
                <p className="text-xs font-bold text-[#0E0E0E]">
                  Free Prayer & Open Meditation
                </p>
                <p className="text-[10px] text-[#707070] italic">
                  Rest in God&apos;s presence as long as you desire.
                </p>
              </div>
            ) : currentSegment ? (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[#707070] tracking-wider">
                    Segment {currentSegmentIndex + 1} of {activeTimeline.length}:{' '}
                    <span className="text-[#0E0E0E]">
                      {currentSegment.type === 'scripture' ? 'Scripture' : 'Reflection'}
                    </span>
                  </span>

                  <span className="text-[10px] font-mono font-bold text-[#FBBF24]">
                    {Math.max(0, Math.ceil((segmentTotalSecs - segmentElapsedSecs) / 60))}m left
                  </span>
                </div>

                {/* Progress bar inside active segment */}
                <div className="w-full bg-[#F3F4F6] rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-[#FBBF24] h-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${Math.min(100, (segmentElapsedSecs / segmentTotalSecs) * 100)}%`,
                    }}
                  />
                </div>

                {/* Segment Content */}
                {currentSegment.type === 'scripture' ? (
                  <ScriptureText
                    reference={currentSegment.reference || 'Psalm 23:1'}
                    versionId={currentSegment.versionId || 'web'}
                    initialText={currentSegment.verseText}
                    display="verseWithReference"
                  />
                ) : (
                  <p className="text-xs text-[#0E0E0E] italic leading-relaxed font-serif">
                    &ldquo;{currentSegment.prompt}&rdquo;
                  </p>
                )}
              </div>
            ) : null
          ) : session.focusText ? (
            <div className="text-center px-4 py-2">
              <p className="text-xs font-serif italic text-[#707070] max-w-xs mx-auto">
                &ldquo;{session.focusText}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Central SVG Circular Timer Ring */}
      <div className="flex flex-col items-center justify-center my-auto py-4">
        <div className="relative w-56 h-56 min-[375px]:w-64 min-[375px]:h-64 sm:w-72 sm:h-72 flex items-center justify-center filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
            {/* Background Disc */}
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="#FFFFFF"
              className="transition-colors"
            />

            {/* Background Track Ring */}
            <circle
              cx="100"
              cy="100"
              r="84"
              stroke="#E5E7EB"
              strokeWidth="10"
              fill="transparent"
            />

            {/* Dynamic Sweeping Progress Ring */}
            <circle
              cx="100"
              cy="100"
              r="84"
              stroke={isPastLap1 ? '#FBBF24' : '#0E0E0E'}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 84}
              strokeDashoffset={(2 * Math.PI * 84) - (progressPercentage / 100) * (2 * Math.PI * 84)}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Center Digits with Fraunces Display Font */}
          <div className="absolute flex flex-col items-center space-y-1 text-center">
            {isPastLap1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF9F1] border border-[#FBBF24]/40 text-[#FBBF24] text-[10px] font-extrabold tracking-wider animate-bounce">
                LAP {lapNumber}
              </span>
            )}

            <div className="font-mono-tabular text-4xl sm:text-5xl font-bold tracking-tight text-[#0E0E0E]">
              {formattedTime}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold capitalize text-[#707070]">
              {session.discipline === 'prayer' ? (
                <Fire size={14} weight="fill" className="text-[#FBBF24]" />
              ) : (
                <BookOpen size={14} className="text-[#FBBF24]" />
              )}
              <span>{session.discipline} Session</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 pt-2">
        {!isTimerActive ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleStart}
              className="w-full bg-[#0E0E0E] text-white py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 font-extrabold text-base shadow-xl shadow-black/20 hover:bg-[#1f1f1f] active:scale-[0.99] transition-all"
            >
              <Play size={20} weight="fill" />
              <span>Start Session</span>
            </button>

            {selectedDiscipline === 'study' && (
              <Link href="/bible" className="block">
                <button
                  type="button"
                  className="w-full bg-white border border-[#E5E7EB] text-[#0E0E0E] py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:border-[#FBBF24] transition-all"
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
              className="py-4 rounded-2xl bg-white border border-[#E5E7EB] text-[#0E0E0E] font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-[#FAF6EE] transition-all"
            >
              {isRunning ? (
                <>
                  <Pause size={18} weight="fill" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={18} weight="fill" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleEnd}
              className="py-4 rounded-2xl bg-[#EA2C26] text-white font-bold text-sm shadow-lg shadow-[#EA2C26]/25 flex items-center justify-center gap-2 hover:bg-[#c9221d] active:scale-[0.98] transition-all"
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
