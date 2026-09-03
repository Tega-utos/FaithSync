'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Play, Pause, Square } from '@phosphor-icons/react'
import { useTimer, TimerSessionData } from '@/context/TimerContext'

interface TimerPillProps {
  onEndSession: (data: TimerSessionData) => void
}

export function TimerPill({ onEndSession }: TimerPillProps) {
  const router = useRouter()
  const { session, state, formattedTime, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()

  const isRunning = state === 'RUNNING'
  const isPaused = state === 'PAUSED'
  const isIdle = !session.isActive

  const handleEnd = (e: React.MouseEvent) => {
    e.stopPropagation()
    const data = stopTimer()
    onEndSession(data)
  }

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isIdle) {
      startTimer('study', 'stopwatch', 15, 'Scripture Reading in Bible Reader', '')
    } else if (isRunning) {
      pauseTimer()
    } else {
      resumeTimer()
    }
  }

  const handleNavigateToTimer = () => {
    router.push('/clock-in')
  }

  return (
    <div className="fixed bottom-24 right-5 sm:right-8 z-40">
      <div
        onClick={handleNavigateToTimer}
        className="flex items-center gap-2.5 bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] px-3.5 py-2.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-white/15 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
      >
        {/* LED Indicator */}
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isRunning
              ? 'bg-rose-50 dark:bg-red-950/300 animate-ping'
              : isPaused
              ? 'bg-amber-400'
              : 'bg-emerald-400'
          }`}
        />

        {/* Digits or Quick Start Text */}
        <div className="flex flex-col">
          <span className="text-xs font-black font-mono tracking-tight leading-none text-white">
            {isIdle ? '00:00' : formattedTime}
          </span>
          <span className="text-[9px] uppercase tracking-wider font-bold text-[#FBBF24] leading-none mt-0.5">
            {isIdle ? 'Quick Timer' : session.discipline}
          </span>
        </div>

        {/* Play/Pause Toggle Button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          className="p-1 rounded-full text-white/80 hover:text-white hover:bg-card/10 transition-colors ml-0.5"
          title={isIdle ? 'Start Timer' : isRunning ? 'Pause' : 'Resume'}
        >
          {isRunning ? (
            <Pause size={14} weight="fill" />
          ) : (
            <Play size={14} weight="fill" />
          )}
        </button>

        {/* Stop Button (Active/Paused only) */}
        {!isIdle && (
          <button
            type="button"
            onClick={handleEnd}
            className="p-1 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-50 dark:bg-red-950/300/20 transition-colors"
            title="End Session"
          >
            <Square size={12} weight="fill" />
          </button>
        )}
      </div>
    </div>
  )
}
