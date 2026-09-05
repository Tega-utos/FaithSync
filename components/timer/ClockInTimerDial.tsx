'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ActiveSession, getSessionElapsedSeconds } from '@/context/TimerContext'
import { playGentleChime } from '@/components/audio/Chime'
import { Fire, BookOpen } from '@phosphor-icons/react'

interface ClockInTimerDialProps {
  session: ActiveSession
  onCountdownComplete?: () => void
}

export function ClockInTimerDial({ session, onCountdownComplete }: ClockInTimerDialProps) {
  // Local state scoped ONLY to this component to prevent parent page re-rendering
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    getSessionElapsedSeconds(session)
  )

  const isCompletedRef = useRef(false)

  useEffect(() => {
    // Immediate calculation on session change/mount
    const current = getSessionElapsedSeconds(session)
    setElapsedSeconds(current)
    isCompletedRef.current = false

    if (!session.isActive || session.isPaused) {
      return
    }

    let rafId: number | null = null
    let lastSecond = current

    const tick = () => {
      const nowElapsed = getSessionElapsedSeconds(session)

      // Countdown completion check
      if (session.mode === 'countdown') {
        const targetSecs = session.targetDurationSeconds || 900
        if (nowElapsed >= targetSecs && !isCompletedRef.current) {
          isCompletedRef.current = true
          setElapsedSeconds(targetSecs)
          playGentleChime(false)
          if (onCountdownComplete) {
            onCountdownComplete()
          }
          return
        }
      }

      if (nowElapsed !== lastSecond) {
        lastSecond = nowElapsed
        setElapsedSeconds(nowElapsed)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    // Visibility change / Tab refocus handler: instantly recalculate wall-clock diff
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const refreshed = getSessionElapsedSeconds(session)
        lastSecond = refreshed
        setElapsedSeconds(refreshed)
      }
    }

    const handleFocus = () => {
      const refreshed = getSessionElapsedSeconds(session)
      lastSecond = refreshed
      setElapsedSeconds(refreshed)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [
    session.isActive,
    session.isPaused,
    session.lastResumeTimestamp,
    session.accumulatedSeconds,
    session.mode,
    session.targetDurationSeconds,
    onCountdownComplete,
  ])

  const targetSecs = session.targetDurationSeconds || 900
  const displaySeconds =
    session.mode === 'countdown'
      ? Math.max(0, targetSecs - elapsedSeconds)
      : elapsedSeconds

  const mins = Math.floor(displaySeconds / 60)
  const secs = displaySeconds % 60
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  const lapNumber = Math.max(1, Math.floor(elapsedSeconds / targetSecs) + 1)
  const isPastLap1 = elapsedSeconds >= targetSecs
  const currentLapProgressSecs = elapsedSeconds % targetSecs
  const progressPercentage = Math.min(100, (currentLapProgressSecs / targetSecs) * 100)

  const radius = 84
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center my-auto py-4">
      <div className="relative w-56 h-56 min-[375px]:w-64 min-[375px]:h-64 sm:w-72 sm:h-72 flex items-center justify-center filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          {/* Background Disc */}
          <circle
            cx="100"
            cy="100"
            r="88"
            className="fill-card dark:fill-[#16130F] transition-colors"
          />

          {/* Background Track Ring */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            className="text-border dark:text-neutral-800 transition-colors"
          />

          {/* Dynamic Sweeping Progress Ring */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className={`transition-[stroke-dashoffset] duration-200 ease-out ${
              isPastLap1 ? 'text-[#FBBF24]' : 'text-[#0E0E0E] dark:text-[#F5F1E8]'
            }`}
          />
        </svg>

        {/* Center Digits with Fraunces / Mono Display Font */}
        <div className="absolute flex flex-col items-center space-y-1 text-center">
          {isPastLap1 && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/40 dark:border-amber-500/30 text-[#FBBF24] text-[10px] font-extrabold tracking-wider animate-bounce">
              LAP {lapNumber}
            </span>
          )}

          <div className="font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
            {formattedTime}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold capitalize text-text-primary dark:text-[#F5F1E8]">
            {session.discipline === 'prayer' ? (
              <Fire size={14} weight="fill" className="text-[#FBBF24]" />
            ) : (
              <BookOpen size={14} className="text-[#FBBF24]" />
            )}
            <span className="text-text-primary dark:text-[#F5F1E8]">
              {session.discipline} Session
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
