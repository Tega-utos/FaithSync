'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ActiveSession, getSessionElapsedSeconds } from '@/context/TimerContext'
import { TimelineSegment } from '@/components/timer/PrayerFocusTimelineBuilder'
import { ScriptureText } from '@/components/scripture/ScriptureText'
import { onTimelineSegmentChanged } from '@/lib/sessionLockScreen'

interface ActiveTimelineFocusProps {
  session: ActiveSession
  soundMuted: boolean
}

export function ActiveTimelineFocus({ session, soundMuted }: ActiveTimelineFocusProps) {
  const activeTimeline = session.focusTimeline || []
  const isTimelineSession = session.focusType === 'timeline' && activeTimeline.length > 0

  const [elapsedSecs, setElapsedSecs] = useState<number>(() =>
    getSessionElapsedSeconds(session)
  )

  useEffect(() => {
    setElapsedSecs(getSessionElapsedSeconds(session))

    if (!session.isActive || session.isPaused) return

    const interval = setInterval(() => {
      setElapsedSecs(getSessionElapsedSeconds(session))
    }, 1000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setElapsedSecs(getSessionElapsedSeconds(session))
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [session.isActive, session.isPaused, session.lastResumeTimestamp, session.accumulatedSeconds])

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
        elapsedSecs >= accumulatedSecs &&
        elapsedSecs < accumulatedSecs + segSecs
      ) {
        currentSegment = activeTimeline[i]
        currentSegmentIndex = i
        segmentElapsedSecs = elapsedSecs - accumulatedSecs
        segmentTotalSecs = segSecs
        break
      }
      accumulatedSecs += segSecs
    }

    if (!currentSegment && elapsedSecs >= accumulatedSecs) {
      isFreePrayerPastTimeline = true
    }
  }

  // Segment Transition Handler (Audio Chime + Lock-Screen Media + OS Notification)
  const prevSegmentIndexRef = useRef<number>(-1)
  useEffect(() => {
    if (isTimelineSession && session.isActive && !session.isPaused) {
      if (prevSegmentIndexRef.current !== currentSegmentIndex) {
        if (prevSegmentIndexRef.current !== -1) {
          onTimelineSegmentChanged(currentSegment, soundMuted, session.discipline)
        }
        prevSegmentIndexRef.current = currentSegmentIndex
      }
    }
  }, [currentSegmentIndex, isTimelineSession, session.isActive, session.isPaused, currentSegment, soundMuted, session.discipline])

  if (!isTimelineSession && !session.focusText) {
    return null
  }

  return (
    <div className="px-4 py-2 max-w-sm mx-auto w-full">
      {isTimelineSession ? (
        isFreePrayerPastTimeline ? (
          <div className="p-3.5 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/30 dark:border-amber-500/25 text-center space-y-1 animate-in fade-in">
            <span className="text-[10px] font-bold uppercase text-[#FBBF24] tracking-wider">
              Timeline Complete
            </span>
            <p className="text-xs font-bold text-text-primary">
              Free Prayer & Open Meditation
            </p>
            <p className="text-[10px] text-text-secondary italic">
              Rest in God&apos;s presence as long as you desire.
            </p>
          </div>
        ) : currentSegment ? (
          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                Segment {currentSegmentIndex + 1} of {activeTimeline.length}:{' '}
                <span className="text-text-primary">
                  {currentSegment.type === 'scripture' ? 'Scripture' : 'Reflection'}
                </span>
              </span>

              <span className="text-[10px] font-mono font-bold text-[#FBBF24]">
                {Math.max(0, Math.ceil((segmentTotalSecs - segmentElapsedSecs) / 60))}m left
              </span>
            </div>

            {/* Progress bar inside active segment */}
            <div className="w-full bg-subtle rounded-full h-1 overflow-hidden">
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
              <p className="text-xs text-text-primary italic leading-relaxed font-serif">
                &ldquo;{currentSegment.prompt}&rdquo;
              </p>
            )}
          </div>
        ) : null
      ) : session.focusText ? (
        <div className="text-center px-4 py-2">
          <p className="text-xs font-serif italic text-text-secondary max-w-xs mx-auto">
            &ldquo;{session.focusText}&rdquo;
          </p>
        </div>
      ) : null}
    </div>
  )
}
