'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { DisciplineType } from '@/types/database.types'
import {
  playGentleChime,
  startSilentMediaLoop,
  stopSilentMediaLoop,
} from '@/components/audio/Chime'
import {
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from '@/lib/sessionLockScreen'
import { createClient } from '@/lib/supabase/client'
import { invalidateMemoryCache } from '@/lib/cache/clientCache'

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
  lastResumeTimestamp: number | null
  accumulatedSeconds: number
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
  sessionId?: string
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
  isSummaryOpen: boolean
  setIsSummaryOpen: (open: boolean) => void
}

const STORAGE_KEY = 'faithsync_active_timer_v2'

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
  lastResumeTimestamp: null,
  accumulatedSeconds: 0,
  focusType: 'quick',
  focusText: '',
  focusTimeline: [],
  sessionMood: 'Seeking',
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveSession>(initialSession)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Restore timer from localStorage on client mount with absolute timestamp sync
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: ActiveSession = JSON.parse(saved)
        if (parsed.isActive) {
          if (!parsed.isPaused && parsed.lastResumeTimestamp) {
            const runningSecs = Math.max(0, Math.floor((Date.now() - parsed.lastResumeTimestamp) / 1000))
            const exactTotal = (parsed.accumulatedSeconds || 0) + runningSecs
            parsed.durationSeconds = exactTotal
            parsed.secondsElapsed = exactTotal
          } else {
            const exactTotal = parsed.accumulatedSeconds ?? parsed.durationSeconds ?? 0
            parsed.durationSeconds = exactTotal
            parsed.secondsElapsed = exactTotal
          }
        }
        setSession(parsed)
      }
    } catch (e) {
      console.error('Failed to restore timer session:', e)
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

// Helper: Auto-save running session directly to database ledger on minimize or target completion
async function autoSaveSessionToRecord(sessionToSave: ActiveSession): Promise<void> {
  const runSecs =
    sessionToSave.lastResumeTimestamp && !sessionToSave.isPaused
      ? Math.max(0, Math.floor((Date.now() - sessionToSave.lastResumeTimestamp) / 1000))
      : 0
  const totalSeconds = (sessionToSave.accumulatedSeconds || 0) + runSecs

  // Require at least 20 seconds of devotion to save as a valid ledger record
  if (totalSeconds < 20) return

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const targetSecs = sessionToSave.targetDurationSeconds || totalSeconds
    const isComplete = totalSeconds >= targetSecs && targetSecs > 0

    await (supabase.from('sessions') as any).insert({
      user_id: user.id,
      type: sessionToSave.discipline,
      duration_seconds: totalSeconds,
      target_duration_seconds: targetSecs,
      is_complete: isComplete,
      focus_type: sessionToSave.focusType || 'quick',
      focus_timeline: (sessionToSave.focusTimeline as any) || null,
      shared_to_square: false,
      started_at: sessionToSave.startedAt || new Date().toISOString(),
      ended_at: new Date().toISOString(),
    })

    // Invalidate client caches so Ledger and Dashboard immediately reflect the new session
    invalidateMemoryCache('history_summaries')
    invalidateMemoryCache(`dashboard_data_${user.id}`)
  } catch (err) {
    console.warn('Auto-save session note:', err)
  }
}

  // 3. Absolute Timestamp-Based Sync Interval & Event Listeners for Background Recovery & Minimize Auto-Save
  useEffect(() => {
    if (!session.isActive || session.isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const syncElapsed = () => {
      setSession((prev) => {
        if (!prev.isActive || prev.isPaused || !prev.lastResumeTimestamp) return prev
        const currentRunSecs = Math.max(0, Math.floor((Date.now() - prev.lastResumeTimestamp) / 1000))
        const exactTotalSecs = (prev.accumulatedSeconds || 0) + currentRunSecs

        // Anti-Sleep Runaway Prevention: Auto-complete & save when reaching target
        const targetSecs = prev.targetDurationSeconds || 900
        const maxAllowedSecs = prev.mode === 'countdown' ? targetSecs : targetSecs + 60

        if (exactTotalSecs >= maxAllowedSecs) {
          playGentleChime(false)
          autoSaveSessionToRecord({
            ...prev,
            durationSeconds: targetSecs,
            secondsElapsed: targetSecs,
          })
          stopSilentMediaLoop()
          releaseScreenWakeLock()
          localStorage.removeItem(STORAGE_KEY)
          return {
            ...initialSession,
            discipline: prev.discipline,
          }
        }

        if (exactTotalSecs === prev.durationSeconds) return prev
        return {
          ...prev,
          durationSeconds: exactTotalSecs,
          secondsElapsed: exactTotalSecs,
        }
      })
    }

    // High frequency interval (500ms) for smooth second updates
    intervalRef.current = setInterval(syncElapsed, 500)

    // Minimize & App Departure Handler: When minimizing or leaving the app, auto-stop and save to record
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setSession((prev) => {
          if (!prev.isActive || prev.isPaused) return prev
          autoSaveSessionToRecord(prev)
          stopSilentMediaLoop()
          releaseScreenWakeLock()
          localStorage.removeItem(STORAGE_KEY)
          return {
            ...initialSession,
            discipline: prev.discipline,
          }
        })
      } else if (document.visibilityState === 'visible') {
        syncElapsed()
        requestScreenWakeLock()
      }
    }

    const handlePageHide = () => {
      setSession((prev) => {
        if (!prev.isActive || prev.isPaused) return prev
        autoSaveSessionToRecord(prev)
        stopSilentMediaLoop()
        releaseScreenWakeLock()
        localStorage.removeItem(STORAGE_KEY)
        return {
          ...initialSession,
          discipline: prev.discipline,
        }
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    window.addEventListener('focus', syncElapsed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      window.removeEventListener('focus', syncElapsed)
    }
  }, [session.isActive, session.isPaused])

  const pauseTimer = useCallback(() => {
    setSession((prev) => {
      if (!prev.isActive || prev.isPaused) return prev
      const runSecs = prev.lastResumeTimestamp
        ? Math.max(0, Math.floor((Date.now() - prev.lastResumeTimestamp) / 1000))
        : 0
      const newAccumulated = (prev.accumulatedSeconds || 0) + runSecs
      return {
        ...prev,
        isPaused: true,
        lastResumeTimestamp: null,
        accumulatedSeconds: newAccumulated,
        durationSeconds: newAccumulated,
        secondsElapsed: newAccumulated,
      }
    })
  }, [])

  const resumeTimer = useCallback(() => {
    setSession((prev) => {
      if (!prev.isActive || !prev.isPaused) return prev
      return {
        ...prev,
        isPaused: false,
        lastResumeTimestamp: Date.now(),
      }
    })
  }, [])

  // 4. Background Audio & Screen Wake Lock Lifecycle (Runs ONLY on state change, NOT every second)
  useEffect(() => {
    if (session.isActive && !session.isPaused) {
      startSilentMediaLoop()
      requestScreenWakeLock()

      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing'
          navigator.mediaSession.setActionHandler('play', () => {
            resumeTimer()
          })
          navigator.mediaSession.setActionHandler('pause', () => {
            pauseTimer()
          })
        } catch (e) {
          console.warn('MediaSession handler error:', e)
        }
      }
    } else if (session.isPaused) {
      releaseScreenWakeLock()
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused'
        } catch {}
      }
    } else {
      stopSilentMediaLoop()
      releaseScreenWakeLock()
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none'
        } catch {}
      }
    }
  }, [session.isActive, session.isPaused, resumeTimer, pauseTimer])

  // 5. Periodic MediaSession Metadata Title Sync (Without re-starting audio or resetting handlers)
  useEffect(() => {
    if (!session.isActive || session.isPaused) return
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    try {
      const disc = session.discipline === 'prayer' ? 'Prayer' : 'Scripture Study'
      const title = session.focusText ? `${disc}: ${session.focusText}` : `${disc} Clock-In`
      const mins = Math.floor(session.durationSeconds / 60)
      const secs = session.durationSeconds % 60
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

      navigator.mediaSession.metadata = new (window as any).MediaMetadata({
        title: `${title} (${timeStr})`,
        artist: 'FaithSync Clock-In • Active',
        album: 'FaithSync',
        artwork: [
          { src: '/assets/welcome-hero.png', sizes: '512x512', type: 'image/png' },
        ],
      })
    } catch (_) {}
  }, [session.durationSeconds, session.isActive, session.isPaused, session.discipline, session.focusText])

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
      const now = Date.now()
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
        startedAt: new Date(now).toISOString(),
        lastResumeTimestamp: now,
        accumulatedSeconds: 0,
        focusType,
        focusText,
        focusTimeline,
        sessionMood,
      })
      startSilentMediaLoop()
      requestScreenWakeLock()
    },
    []
  )

  const stopTimer = useCallback((): TimerSessionData => {
    const now = Date.now()
    const runSecs =
      session.lastResumeTimestamp && !session.isPaused
        ? Math.max(0, Math.floor((now - session.lastResumeTimestamp) / 1000))
        : 0
    const totalElapsed = (session.accumulatedSeconds || 0) + runSecs
    const endedAt = new Date(now).toISOString()

    const result: TimerSessionData = {
      discipline: session.discipline,
      secondsElapsed: totalElapsed,
      targetSeconds: session.targetDurationSeconds,
      durationSeconds: totalElapsed,
      targetDurationSeconds: session.targetDurationSeconds,
      startedAt: session.startedAt || endedAt,
      endedAt,
      isComplete: totalElapsed >= (session.targetDurationSeconds || 0),
      focusType: session.focusType,
      focusText: session.focusText,
      focusTimeline: session.focusTimeline,
      sessionMood: session.sessionMood,
    }

    setSession({
      ...initialSession,
      discipline: session.discipline,
    })
    stopSilentMediaLoop()
    releaseScreenWakeLock()
    localStorage.removeItem(STORAGE_KEY)

    return result
  }, [session])

  const resetTimer = useCallback(() => {
    setSession((prev) => ({
      ...initialSession,
      discipline: prev.discipline,
    }))
    stopSilentMediaLoop()
    releaseScreenWakeLock()
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
        isSummaryOpen,
        setIsSummaryOpen,
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
