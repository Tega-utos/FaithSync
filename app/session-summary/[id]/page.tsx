'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  Fire,
  BookOpen,
  ShareNetwork,
  Sparkle,
  CaretLeft,
  CircleNotch,
  Quotes,
  Clock,
  House,
  Globe,
  Lock,
  HandsPraying,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { invalidateMemoryCache } from '@/lib/cache/clientCache'
import { fetchDashboardData } from '@/features/dashboard/services/dashboardService'

export default function SessionSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [includeReflection, setIncludeReflection] = useState(false)
  const [todayPrayerMins, setTodayPrayerMins] = useState(0)
  const [todayStudyMins, setTodayStudyMins] = useState(0)
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)
  const [session, setSession] = useState<{
    id: string
    type: string
    duration_seconds: number
    reflection: string | null
    verse_reference: string | null
    focus_type?: string | null
    focus_timeline?: Array<{
      id?: string
      type: 'scripture' | 'reflection'
      durationMinutes: number
      reference?: string
      versionId?: string
      prompt?: string
      verseText?: string
    }> | null
    created_at: string
  }>({
    id: sessionId,
    type: 'prayer',
    duration_seconds: 900,
    reflection: 'Staying anchored in His grace and seeking divine guidance.',
    verse_reference: 'Hebrews 6:19',
    focus_type: 'quick',
    focus_timeline: null,
    created_at: new Date().toISOString(),
  })

  useEffect(() => {
    async function loadSession() {
      try {
        const supabase = createClient()
        if (sessionId && sessionId !== 'latest' && sessionId !== 'temp') {
          const { data: found } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single()

          if (found) {
            setSession(found as any)
          }
        }

        // Fetch fresh devotion totals & targets
        const dashData = await fetchDashboardData(true)
        if (dashData) {
          setTodayPrayerMins(dashData.prayerMinutes || 0)
          setTodayStudyMins(dashData.studyMinutes || 0)
          setPrayerTarget(dashData.prayerTarget || 15)
          setStudyTarget(dashData.studyTarget || 15)
        }
      } catch (err) {
        console.error('Session summary load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId])

  const mins = Math.floor(session.duration_seconds / 60)
  const secs = session.duration_seconds % 60
  const formattedDuration = `${mins}m ${secs > 0 ? `${secs}s` : ''}`

  const isPrayerComplete = todayPrayerMins >= prayerTarget
  const isStudyComplete = todayStudyMins >= studyTarget
  const isBothComplete = isPrayerComplete && isStudyComplete

  const handleShareToSquare = async () => {
    if (!isBothComplete) return
    setSharing(true)
    try {
      const res = await fetch('/api/session/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          includeReflection,
          customReflection: includeReflection ? session.reflection : null,
        }),
      })

      invalidateMemoryCache('square_feed_posts')
      router.push('/square')
    } catch {
      invalidateMemoryCache('square_feed_posts')
      router.push('/square')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-4 pb-28 min-h-[92vh] space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary">Session Summary</h1>
        <div className="w-8" />
      </div>

      {/* Success Badge */}
      <div className="text-center space-y-2 pt-2">
        <div className="w-16 h-16 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 border-2 border-[#FBBF24] text-[#FBBF24] flex items-center justify-center mx-auto shadow-md">
          <Check size={28} weight="bold" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-text-primary tracking-tight">Session Logged!</h2>
          <p className="text-xs text-text-secondary">
            Your time has been recorded to your daily accountability ledger.
          </p>
        </div>
      </div>

      {/* Session Receipt Card */}
      <div className="faith-card p-6 space-y-5 bg-surface border border-border shadow-lg">
        {/* Receipt Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            {session.type === 'prayer' ? (
              <div className="w-9 h-9 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/30 dark:border-amber-500/25 flex items-center justify-center font-bold">
                <HandsPraying size={20} weight="fill" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-[#FBBF24]/20 text-[#FBBF24] flex items-center justify-center font-bold">
                <BookOpen size={20} />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-text-primary capitalize">{session.type} Session</h3>
              <p className="text-[10px] text-text-secondary">Official Proof of Devotion</p>
            </div>
          </div>

          <span className="text-base font-black font-mono text-[#FBBF24] bg-card px-3 py-1 rounded-xl border border-border">
            {formattedDuration}
          </span>
        </div>

        {/* Focus / Reflection Text */}
        {session.reflection && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
              <Quotes size={14} className="text-[#FBBF24]" /> Your Reflection (Private)
            </span>
            <div className="p-3.5 bg-card rounded-2xl border-l-4 border-[#234537] dark:border-emerald-700 text-xs text-text-primary italic leading-relaxed shadow-sm">
              &ldquo;{session.reflection}&rdquo;
            </div>
          </div>
        )}

        {/* Scripture Reference */}
        {session.verse_reference && (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FBBF24] bg-card px-3 py-1 rounded-xl border border-border">
            <BookOpen size={14} />
            <span>{session.verse_reference}</span>
          </div>
        )}

        {/* Used Timeline Segments */}
        {Array.isArray(session.focus_timeline) && session.focus_timeline.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                <Clock size={13} className="text-[#FBBF24]" />
                Prayer Focus Timeline ({session.focus_timeline.length} Segments)
              </span>
              <span className="text-[10px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] dark:bg-amber-950/30 px-2 py-0.5 rounded-lg border border-[#FBBF24]/30 dark:border-amber-500/25">
                {session.focus_timeline.reduce((sum, seg) => sum + (seg.durationMinutes || 1), 0)}m Guided
              </span>
            </div>

            <div className="space-y-2 pl-2 border-l-2 border-border">
              {session.focus_timeline.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="p-3 rounded-xl bg-card border border-border space-y-1 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {seg.type === 'scripture' ? (
                        <>
                          <BookOpen size={14} className="text-[#FBBF24]" weight="fill" />
                          <span className="text-text-primary text-xs">
                            {seg.reference || 'Scripture Passage'}
                          </span>
                          {seg.versionId && (
                            <span className="text-[9px] font-mono uppercase bg-subtle text-text-secondary px-1.5 py-0.5 rounded">
                              {seg.versionId}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Sparkle size={14} className="text-rose-500" weight="fill" />
                          <span className="text-text-primary text-xs">Reflection Prompt</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-text-secondary font-semibold">
                      {seg.durationMinutes || 1} min
                    </span>
                  </div>

                  {seg.type === 'scripture' && seg.verseText && (
                    <p className="text-xs text-text-secondary italic leading-snug">
                      &ldquo;{seg.verseText}&rdquo;
                    </p>
                  )}

                  {seg.type === 'reflection' && seg.prompt && (
                    <p className="text-xs text-text-primary italic leading-snug">
                      &ldquo;{seg.prompt}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Privacy-First Reflection Sharing Toggle (Only active if unlocked) */}
      <div className={`faith-card p-4 space-y-2 border border-border transition-opacity ${
        isBothComplete ? 'bg-[#FDF9F1] dark:bg-amber-950/30' : 'bg-card-hover opacity-60'
      }`}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-text-primary">Include personal reflection on Square</p>
            <p className="text-[10px] text-text-secondary">Default is OFF — share consistency stats only</p>
          </div>

          <input
            type="checkbox"
            disabled={!isBothComplete}
            checked={includeReflection && isBothComplete}
            onChange={(e) => isBothComplete && setIncludeReflection(e.target.checked)}
            className="w-4 h-4 rounded text-[#FBBF24] cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center gap-1.5 text-[10px] text-text-muted">
          <Lock size={12} className="text-[#FBBF24]" />
          <span>Your personal reflection notes remain completely confidential unless toggled on.</span>
        </div>
      </div>

      {/* Target Lock Notice */}
      {!isBothComplete && (
        <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 text-xs text-text-primary shadow-xs">
          <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-text-secondary shrink-0">
            <Lock size={16} />
          </div>
          <div className="space-y-0.5">
            <p className="font-bold text-text-primary">Sharing Locked</p>
            <p className="text-[11px] text-text-secondary">
              Complete both daily targets to unlock sharing: {todayPrayerMins}/{prayerTarget}m Prayer, {todayStudyMins}/{studyTarget}m Study.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleShareToSquare}
          disabled={!isBothComplete || sharing}
          className={`w-full py-4 px-6 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
            !isBothComplete
              ? 'bg-[#E5E7EB] text-text-muted cursor-not-allowed shadow-none'
              : 'bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 active:scale-95 cursor-pointer shadow-black/15'
          }`}
        >
          {sharing ? (
            <>
              <CircleNotch size={16} className="animate-spin" />
              <span>Publishing Record...</span>
            </>
          ) : !isBothComplete ? (
            <>
              <Lock size={18} className="text-text-muted" />
              <span>Complete Both Targets to Share</span>
            </>
          ) : (
            <>
              <Globe size={18} className="text-[#FBBF24]" />
              <span>Share to Community Square</span>
            </>
          )}
        </button>

        <Link href="/" className="block">
          <button
            type="button"
            className="w-full bg-card border border-border text-text-primary py-3.5 rounded-2xl font-bold text-xs hover:bg-surface transition-all flex items-center justify-center gap-2 shadow-2xs"
          >
            <House size={16} className="text-text-secondary" />
            <span>Back to Dashboard</span>
          </button>
        </Link>
      </div>
    </div>
  )
}
