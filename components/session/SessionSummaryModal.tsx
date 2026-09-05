'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Fire,
  BookOpen,
  Lock,
  ShareNetwork,
  WarningCircle,
  CircleNotch,
  Sparkle,
  Lightning,
  HandsPraying,
  HandWaving,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer, TimerSessionData } from '@/context/TimerContext'
import { invalidateMemoryCache } from '@/lib/cache/clientCache'
import { getLocalDateKey } from '@/lib/utils/date'

export interface SessionSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  sessionData: TimerSessionData | null
  onSaved?: () => void
}

export function SessionSummaryModal({
  isOpen,
  onClose,
  sessionData,
  onSaved,
}: SessionSummaryModalProps) {
  const router = useRouter()
  const { setIsSummaryOpen } = useTimer()

  const [reflection, setReflection] = useState('')
  const [shareToSquare, setShareToSquare] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [todayPrayerMins, setTodayPrayerMins] = useState(0)
  const [todayStudyMins, setTodayStudyMins] = useState(0)
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)
  const [primaryBuddy, setPrimaryBuddy] = useState<{ id: string; connectionId: string; name: string } | null>(null)
  const [nudged, setNudged] = useState(false)

  useEffect(() => {
    setIsSummaryOpen(isOpen)
    if (typeof document !== 'undefined') {
      if (isOpen) {
        document.body.classList.add('modal-open')
      } else {
        document.body.classList.remove('modal-open')
      }
    }
    return () => {
      setIsSummaryOpen(false)
      if (typeof document !== 'undefined') {
        document.body.classList.remove('modal-open')
      }
    }
  }, [isOpen, setIsSummaryOpen])

  useEffect(() => {
    if (!isOpen) return

    async function loadSummaryContext() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single()

        const rawPrefs = (profile?.preferences as any) || {}
        const pTarget = rawPrefs.prayerTarget || rawPrefs.targets?.prayer || 15
        const sTarget = rawPrefs.studyTarget || rawPrefs.wordTarget || rawPrefs.targets?.study || 15
        setPrayerTarget(pTarget)
        setStudyTarget(sTarget)

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const { data: todaySessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds, is_group, group_id')
          .eq('user_id', user.id)
          .gte('started_at', startOfToday.toISOString())

        let pSecs = 0
        let sSecs = 0
        ;(todaySessions || []).forEach((s: any) => {
          // Group sessions are fellowship only and do NOT count toward personal time
          if (s.is_group || s.type === 'group' || s.group_id) return
          if (s.type === 'prayer') pSecs += s.duration_seconds || 0
          if (s.type === 'study' || s.type === 'word') sSecs += s.duration_seconds || 0
        })

        if (sessionData) {
          if (sessionData.discipline === 'prayer') pSecs += sessionData.secondsElapsed
          if (sessionData.discipline === 'study') sSecs += sessionData.secondsElapsed
        }

        setTodayPrayerMins(Math.floor(pSecs / 60))
        setTodayStudyMins(Math.floor(sSecs / 60))

        const { data: buddyRows } = await supabase
          .from('buddies')
          .select(`
            id,
            user_id,
            buddy_id,
            user_profile:profiles!buddies_user_id_fkey(display_name),
            buddy_profile:profiles!buddies_buddy_id_fkey(display_name)
          `)
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
          .limit(1)

        if (buddyRows && buddyRows.length > 0) {
          const row = buddyRows[0] as any
          const isUserSender = row.user_id === user.id
          const partner = isUserSender ? row.buddy_profile : row.user_profile
          const pId = isUserSender ? row.buddy_id : row.user_id
          const pName = (partner?.display_name || 'your buddy').split(' ')[0]

          setPrimaryBuddy({
            id: pId,
            connectionId: row.id,
            name: pName,
          })
        }
      } catch (err) {
        console.error('Summary load context error:', err)
      }
    }

    loadSummaryContext()
  }, [isOpen, sessionData])

  if (!isOpen || !sessionData) return null

  const durationMins = Math.floor(sessionData.secondsElapsed / 60)
  const durationSecs = sessionData.secondsElapsed % 60
  const durationFormatted = `${durationMins}m ${durationSecs}s`

  const isPrayerComplete = todayPrayerMins >= prayerTarget
  const isStudyComplete = todayStudyMins >= studyTarget
  const isBothComplete = isPrayerComplete && isStudyComplete

  const handleNudgeBuddy = async () => {
    if (!primaryBuddy) return
    setNudged(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('notifications').insert({
        user_id: primaryBuddy.id,
        type: 'nudge',
        text: `Your buddy clocked in for ${durationFormatted}! 👊`,
        icon_type: 'nudge',
      })

      await supabase.from('messages').insert({
        chat_id: primaryBuddy.connectionId,
        sender_id: user.id,
        content: `Just finished a ${durationFormatted} ${sessionData.discipline} session! 👊`,
        message_type: 'nudge',
      })
    } catch {}
  }

  const handleComplete = async () => {
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setSaving(false)
        onClose()
        router.push('/login')
        return
      }

      let sessionRecord: any = null

      if (sessionData.sessionId) {
        const { data: updated, error: updateErr } = await supabase
          .from('sessions')
          .update({
            reflection: reflection.trim() || null,
            shared_to_square: Boolean(shareToSquare && isBothComplete),
          })
          .eq('id', sessionData.sessionId)
          .select()
          .maybeSingle()

        if (!updateErr && updated) {
          sessionRecord = updated
        }
      }

      if (!sessionRecord) {
        const { data: inserted, error: sessionErr } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            type: sessionData.discipline,
            duration_seconds: sessionData.secondsElapsed,
            target_duration_seconds: sessionData.targetSeconds,
            is_complete: true,
            reflection: reflection.trim() || null,
            verse_reference: sessionData.verseReference || null,
            focus_type: sessionData.focusType || 'quick',
            focus_timeline: (sessionData.focusTimeline as any) || null,
            shared_to_square: Boolean(shareToSquare && isBothComplete),
            started_at: sessionData.startedAt,
            ended_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (sessionErr) throw sessionErr
        sessionRecord = inserted

        // Update user_stats if this was a fresh insert
        const durationMins = Math.floor(sessionData.secondsElapsed / 60)
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
          } catch {}
        }
      }

      if (shareToSquare && isBothComplete) {
        const postText =
          reflection.trim() ||
          `Completed daily devotion goals: ${todayPrayerMins}m Prayer & ${todayStudyMins}m Scripture Study 🙏`

        try {
          const { error: pErr1 } = await (supabase.from('square_posts') as any).insert({
            user_id: user.id,
            session_id: sessionRecord?.id || null,
            content: postText,
            post_type: 'record',
            verse_reference: sessionData.verseReference || null,
            scripture_reference: sessionData.verseReference || null,
          })

          if (pErr1) {
            const { error: pErr2 } = await (supabase.from('square_posts') as any).insert({
              user_id: user.id,
              content: postText,
              post_type: 'reflection',
              verse_reference: sessionData.verseReference || null,
            })

            if (pErr2) {
              await (supabase.from('square_posts') as any).insert({
                user_id: user.id,
                content: postText,
              })
            }
          }
        } catch (postEx) {
          console.warn('Square post insert note:', postEx)
        }

        // Invalidate cache so the new post appears immediately in Square
        invalidateMemoryCache('square_feed_posts')
      }

      // If both daily targets are complete, lock today's targets in completed_dates
      if (isBothComplete) {
        try {
          const todayKey = getLocalDateKey()
          const { data: prof } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', user.id)
            .single()

          const currPrefs = (prof?.preferences as any) || {}
          const currCompleted = currPrefs.completed_dates || {}
          if (!currCompleted[todayKey]) {
            await supabase
              .from('profiles')
              .update({
                preferences: {
                  ...currPrefs,
                  completed_dates: {
                    ...currCompleted,
                    [todayKey]: {
                      prayerTarget,
                      studyTarget,
                      isFixed: true,
                      completedAt: new Date().toISOString(),
                    },
                  },
                },
              })
              .eq('id', user.id)
          }
        } catch (_) {}
      }

      setSaving(false)
      onClose()
      if (onSaved) onSaved()
      const targetId = sessionRecord?.id || 'latest'
      router.push(`/session-summary/${targetId}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to save session.')
      setSaving(false)
    }
  }

  return (
    <div
      id="session-summary-modal"
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="session-summary-active fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:pb-4"
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 pb-6 space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[88vh] overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center space-y-1 text-center">
          <div className="w-10 h-1.5 bg-[#D1CBC0] rounded-full mb-1 sm:hidden" />
          <h2 className="text-lg font-extrabold text-text-primary tracking-tight">Session Summary</h2>
          <p className="text-xs text-text-secondary">Good job showing up in the presence of God today.</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <WarningCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="faith-card p-3.5 text-center space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Duration</span>
            <p className="text-base font-extrabold text-text-primary font-mono">{durationFormatted}</p>
          </div>

          <div className="faith-card p-3.5 text-center space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Type</span>
            <p className="text-base font-extrabold text-text-primary capitalize flex items-center justify-center gap-1.5">
              {sessionData.discipline === 'prayer' ? (
                <>
                  <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" /> Prayer
                </>
              ) : (
                <>
                  <BookOpen size={16} className="text-[#FBBF24]" /> Study
                </>
              )}
            </p>
          </div>
        </div>

        {/* Daily Checklist */}
        <div className="faith-card p-4 space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
            Today&apos;s Daily Checklist
          </span>

          {/* Prayer Row */}
          <div className="flex items-center justify-between py-1 border-b border-border-light">
            <div className="flex items-center gap-2">
              <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" />
              <span className="text-xs font-bold text-text-primary">Prayer</span>
              <span className="text-[10px] font-mono text-text-secondary">({todayPrayerMins}/{prayerTarget}m)</span>
            </div>

            {isPrayerComplete ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                <Check size={12} weight="bold" /> Done
              </span>
            ) : todayPrayerMins > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/30 dark:border-amber-500/25 text-[10px] font-bold">
                Partial
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-subtle text-text-secondary text-[10px] font-semibold">
                Skipped
              </span>
            )}
          </div>

          {/* Study Row */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[#FBBF24]" />
              <span className="text-xs font-bold text-text-primary">Scripture Study</span>
              <span className="text-[10px] font-mono text-text-secondary">({todayStudyMins}/{studyTarget}m)</span>
            </div>

            {isStudyComplete ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                <Check size={12} weight="bold" /> Done
              </span>
            ) : todayStudyMins > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/30 dark:border-amber-500/25 text-[10px] font-bold">
                Partial
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-subtle text-text-secondary text-[10px] font-semibold">
                Skipped
              </span>
            )}
          </div>
        </div>

        {/* Reflection Logger */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-text-primary">
              Reflection & Takeaways (optional)
            </label>
            <span className="text-[10px] font-mono text-text-secondary">
              {reflection.length}/150
            </span>
          </div>

          <textarea
            maxLength={150}
            rows={3}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What did the Holy Spirit highlight in your time today?"
            className="w-full p-3.5 bg-card border border-border rounded-2xl text-xs text-text-primary placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] focus:ring-1 focus:ring-[#FBBF24] resize-none transition-all shadow-xs"
          />
        </div>

        {/* Accountability Buddy Reciprocity Trigger */}
        <div className="space-y-2">
          {primaryBuddy && (
            <div className="p-3.5 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/40 dark:border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-[#FBBF24] text-[#1A1610] font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {primaryBuddy.name.charAt(0)}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-text-primary truncate">Hold {primaryBuddy.name} accountable</p>
                  <p className="text-[10px] text-text-secondary">Tap to encourage their daily goal</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNudgeBuddy}
                disabled={nudged}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  nudged
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 active:scale-95'
                }`}
              >
                {nudged ? (
                  <>
                    <Check size={14} weight="bold" />
                    <span>Sent! ✓</span>
                  </>
                ) : (
                  <>
                    <HandWaving size={12} weight="fill" className="text-[#FBBF24]" />
                    <span>Nudge</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Share to Community Square with Gamification Lock */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShareNetwork size={16} className="text-[#FBBF24]" />
                <div>
                  <p className="text-xs font-bold text-text-primary">Share to Community Square</p>
                  <p className="text-[10px] text-text-secondary">Post your consistency proof on the Square</p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                disabled={!isBothComplete}
                aria-checked={shareToSquare && isBothComplete}
                onClick={() => isBothComplete && setShareToSquare(!shareToSquare)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  !isBothComplete
                    ? 'opacity-40 cursor-not-allowed bg-[#E5E7EB]'
                    : shareToSquare
                    ? 'bg-[#0E0E0E] cursor-pointer'
                    : 'bg-[#E5E7EB] cursor-pointer'
                }`}
              >
                <div
                  className={`bg-card w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    shareToSquare && isBothComplete ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!isBothComplete && (
              <div className="p-2 rounded-xl bg-subtle/50 border border-border flex items-center gap-2 text-[10px] text-text-secondary font-medium">
                <Lock size={14} className="text-text-muted shrink-0" />
                <span>Complete both daily targets to unlock sharing</span>
              </div>
            )}
          </div>
        </div>

        {/* Complete Button */}
        <button
          type="button"
          disabled={saving}
          onClick={handleComplete}
          className="w-full bg-[#0E0E0E] dark:bg-neutral-800 dark:border dark:border-white/15 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-black/20 hover:bg-[#1f1f1f] dark:hover:bg-neutral-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving ? (
            <>
              <CircleNotch size={16} className="animate-spin" />
              <span>Saving Session...</span>
            </>
          ) : (
            <>
              <Sparkle size={16} weight="fill" className="text-[#FBBF24]" />
              <span>Complete Clock-in</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
