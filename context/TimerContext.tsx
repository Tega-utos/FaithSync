'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { DisciplineType } from '@/types/database.types'

export type TimerMode = 'stopwatch' | 'countdown'
export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED'

export interface TimelineSegment {
  id: string
  type: 'scripture' | 'reflection'
  durationMinutes: number
  reference?: string
  versionId?: string
  prompt?: string
  verseText?: string
}

export interface ActiveSession {
  discipline: DisciplineType
  mode: TimerMode
  durationSeconds: number
  targetDurationSeconds: number
  secondsElapsed: number
  targetSeconds: number
  isActive: boolean
  isPaused: boolean
  startedAt: string | null
  focusType?: 'quick' | 'timeline'
  focusText?: string
  focusTimeline?: TimelineSegment[]
  sessionMood?: string
}

export interface TimerSessionData {
  discipline: DisciplineType
  secondsElapsed: number
  targetSeconds: number
  durationSeconds: number
  targetDurationSeconds: number
  startedAt: string
  endedAt: string
  isComplete: boolean
  focusType?: 'quick' | 'timeline'
  focusText?: string
  focusTimeline?: TimelineSegment[]
  sessionMood?: string
  notes?: string
  verseReference?: string
}

interface TimerContextValue {
  session: ActiveSession
  state: TimerState
  seconds: number
  mode: TimerMode
  setMode: (mode: TimerMode) => void
  startTimer: (
    discipline?: DisciplineType,
    mode?: TimerMode,
    targetMinutes?: number,
    focusText?: string,
    sessionMood?: string,
    focusType?: 'quick' | 'timeline',
    focusTimeline?: TimelineSegment[]
  ) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => TimerSessionData
  resetTimer: () => void
  setDiscipline: (discipline: DisciplineType) => void
  setTargetMinutes: (minutes: number) => void
  formattedTime: string
  progressPercentage: number
  lapNumber: number
}

const STORAGE_KEY = 'faithsync_active_timer_v1'

const initialSession: ActiveSession = {
  discipline: 'prayer',
  mode: 'stopwatch',
  durationSeconds: 0,
  targetDurationSeconds: 900, // 15 mins default
  secondsElapsed: 0,
  targetSeconds: 900,
  isActive: false,
  isPaused: false,
  startedAt: null,
  focusType: 'quick',
  focusText: '',
  focusTimeline: [],
  sessionMood: 'Seeking',
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveSession>(initialSession)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Restore timer from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: ActiveSession = JSON.parse(saved)
        if (parsed.isActive && !parsed.isPaused && parsed.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(parsed.startedAt).getTime()) / 1000)
          parsed.durationSeconds = Math.max(0, elapsed)
          parsed.secondsElapsed = parsed.durationSeconds
        }
        setSession(parsed)
      }
    } catch (e) {
      console.error('Failed to parse timer session:', e)
    }
  }, [])

  // 2. Persist active state to localStorage whenever it changes
  useEffect(() => {
    try {
      if (session.isActive) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.error('Failed to save timer session:', e)
    }
  }, [session])

  // 3. Ticking interval logic
  useEffect(() => {
    if (session.isActive && !session.isPaused) {
      intervalRef.current = setInterval(() => {
        setSession((prev) => {
          const newSecs = prev.durationSeconds + 1
          return {
            ...prev,
            durationSeconds: newSecs,
            secondsElapsed: newSecs,
          }
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [session.isActive, session.isPaused])

  const startTimer = useCallback(
    (
      discipline: DisciplineType = 'prayer',
      mode: TimerMode = 'stopwatch',
      targetMinutes: number = 15,
      focusText: string = '',
      sessionMood: string = 'Seeking',
      focusType: 'quick' | 'timeline' = 'quick',
      focusTimeline: TimelineSegment[] = []
    ) => {
      const targetSecs = targetMinutes * 60
      setSession({
        discipline,
        mode,
        durationSeconds: 0,
        targetDurationSeconds: targetSecs,
        secondsElapsed: 0,
        targetSeconds: targetSecs,
        isActive: true,
        isPaused: false,
        startedAt: new Date().toISOString(),
        focusType,
        focusText,
        focusTimeline,
        sessionMood,
      })
    },
    []
  )

  const pauseTimer = useCallback(() => {
    setSession((prev) => ({ ...prev, isPaused: true }))
  }, [])

  const resumeTimer = useCallback(() => {
    setSession((prev) => ({ ...prev, isPaused: false }))
  }, [])

  const stopTimer = useCallback((): TimerSessionData => {
    const endedAt = new Date().toISOString()
    const result: TimerSessionData = {
      discipline: session.discipline,
      secondsElapsed: session.durationSeconds,
      targetSeconds: session.targetDurationSeconds,
      durationSeconds: session.durationSeconds,
      targetDurationSeconds: session.targetDurationSeconds,
      startedAt: session.startedAt || endedAt,
      endedAt,
      isComplete: session.durationSeconds >= (session.targetDurationSeconds || 0),
      focusType: session.focusType,
      focusText: session.focusText,
      focusTimeline: session.focusTimeline,
      sessionMood: session.sessionMood,
    }

    setSession({
      ...initialSession,
      discipline: session.discipline,
    })
    localStorage.removeItem(STORAGE_KEY)

    return result
  }, [session])

  const resetTimer = useCallback(() => {
    setSession((prev) => ({
      ...initialSession,
      discipline: prev.discipline,
    }))
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setDiscipline = useCallback((discipline: DisciplineType) => {
    setSession((prev) => ({ ...prev, discipline }))
  }, [])

  const setTargetMinutes = useCallback((minutes: number) => {
    const secs = minutes * 60
    setSession((prev) => ({
      ...prev,
      targetDurationSeconds: secs,
      targetSeconds: secs,
    }))
  }, [])

  const setMode = useCallback((mode: TimerMode) => {
    setSession((prev) => ({ ...prev, mode }))
  }, [])

  // Derived state values
  const displaySeconds =
    session.mode === 'countdown'
      ? Math.max(0, session.targetDurationSeconds - session.durationSeconds)
      : session.durationSeconds

  const mins = Math.floor(displaySeconds / 60)
  const secs = displaySeconds % 60
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  const targetSecs = session.targetDurationSeconds || 900
  const lapNumber = Math.max(1, Math.floor(session.durationSeconds / targetSecs) + 1)
  const currentLapProgressSecs = session.durationSeconds % targetSecs
  const progressPercentage = Math.min(100, Math.round((currentLapProgressSecs / targetSecs) * 100))

  const state: TimerState = !session.isActive ? 'IDLE' : session.isPaused ? 'PAUSED' : 'RUNNING'

  return (
    <TimerContext.Provider
      value={{
        session,
        state,
        seconds: session.durationSeconds,
        mode: session.mode,
        setMode,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        resetTimer,
        setDiscipline,
        setTargetMinutes,
        formattedTime,
        progressPercentage,
        lapNumber,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}
